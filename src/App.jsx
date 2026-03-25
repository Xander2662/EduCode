import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, ArrowRightLeft, X, ChevronDown, Plus, Repeat, Moon, Sun, AlertCircle, Copy, Check, ExternalLink, Settings } from 'lucide-react';
import { parseDrawioToPseudocode } from './parsers/diagramToPseudocode';
import { parsePseudocodeToDrawio } from './parsers/pseudocodeToDiagram';
import { parsePseudocodeToPython } from './parsers/pseudocodeToPython';
import DiagramEditor from './components/diagramEditor';

const PANEL_TYPES = {
  drawio: { id: 'drawio', label: 'Diagram', title: 'Vizuální návrh' },
  pseudocode: { id: 'pseudocode', label: 'Pseudokód', title: 'Pseudokód' },
  python: { id: 'python', label: 'Python', title: 'Python Kód' }
};

const LineNumberedTextarea = ({ value, onChange, readOnly, placeholder, hasErrors, blocks = [], onExport }) => {
  const lineCount = value?.split('\n').length || 1;
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const overlayRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleScroll = (e) => {
    const top = e.target.scrollTop;
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = top;
    if (overlayRef.current) overlayRef.current.scrollTop = top;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex-1 flex overflow-hidden bg-white dark:bg-gray-900 relative transition-all duration-300 group ${hasErrors ? 'shadow-[0_0_20px_rgba(239,68,68,0.3)] border border-red-500 rounded-lg m-2' : ''}`}>
      <button onClick={handleCopy} className="absolute top-2 right-4 p-2 bg-white/90 dark:bg-gray-800/90 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md shadow-sm border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-20">
        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
      </button>

      <div ref={lineNumbersRef} className="w-12 bg-gray-50 dark:bg-gray-800 text-gray-400 text-right pr-3 py-4 font-mono text-sm overflow-hidden select-none border-r border-gray-200 dark:border-gray-700 z-10">
        {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => <div key={i} className="leading-6">{i + 1}</div>)}
      </div>

      <div ref={overlayRef} className="absolute inset-y-0 right-0 left-12 overflow-hidden pointer-events-none z-10">
        <div className="relative w-full" style={{ height: `${Math.max(lineCount * 24 + 32, 100)}px` }}>
          {blocks.map((b, i) => (
            <div key={i} className="absolute left-0 right-0 bg-indigo-500/10 dark:bg-indigo-400/10 border-y border-indigo-300/50 dark:border-indigo-700/50 pointer-events-none transition-colors"
              style={{ top: `${16 + b.startLine * 24}px`, height: `${(b.endLine - b.startLine + 1) * 24}px` }}>
              <button
                onClick={() => onExport(b.name, b.startLine, b.endLine)}
                className="absolute top-2 right-14 p-1.5 bg-indigo-600 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm hover:bg-indigo-700 transition-colors pointer-events-auto"
              >
                <ExternalLink size={14} /> Do záložky
              </button>
            </div>
          ))}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className={`flex-1 w-full p-4 resize-none focus:outline-none font-mono text-sm bg-transparent leading-6 whitespace-pre relative z-0 ${hasErrors ? 'text-red-700 dark:text-red-300' : 'text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/50'}`}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    </div>
  );
};

export default function App() {
  const [flow, setFlow] = useState('bidirectional');
  const [panels, setPanels] = useState(['drawio', 'pseudocode']);

  const [diagramXml, setDiagramXml] = useState('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
  const [pseudocode, setPseudocode] = useState('');
  const [pythonCode, setPythonCode] = useState('');

  const [tabs, setTabs] = useState(['Hlavní']);
  const [activeTab, setActiveTab] = useState('Hlavní');
  const [tabContents, setTabContents] = useState({});

  const [parseErrors, setParseErrors] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dialog, setDialog] = useState(null);

  const [edgeStyle, setEdgeStyle] = useState(localStorage.getItem('edgeStyle') || 'ano-ne');

  const activeWindow = useRef('pseudocode'); 

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // Diagram -> Pseudocode Sync
  useEffect(() => {
    if (flow === 'code-to-diagram') return;
    if (flow === 'bidirectional' && activeWindow.current !== 'drawio') return;

    const timeoutId = setTimeout(() => {
      try {
        const result = parseDrawioToPseudocode(diagramXml);
        setPseudocode(result?.code || '');
        setParseErrors(result?.errors || []);
      } catch (err) {
        setParseErrors([err.message]);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [diagramXml, flow]);

  // Pseudocode -> Diagram Sync
  useEffect(() => {
    if (flow === 'diagram-to-code') return;
    if (flow === 'bidirectional' && activeWindow.current !== 'pseudocode') return;

    const timeoutId = setTimeout(() => {
      try {
        let fullCode = activeTab === 'Hlavní' ? pseudocode : tabContents[activeTab];
        // Přidáno posílání current diagramXml a edgeStyle do parseru pro recyklaci pozic a styl
        const generatedXml = parsePseudocodeToDrawio(fullCode || '', diagramXml, edgeStyle);
        if (diagramXml !== generatedXml) {
            setDiagramXml(generatedXml);
        }
        setParseErrors([]);
      } catch (err) {
        setParseErrors([err.message]);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [pseudocode, tabContents, activeTab, flow, edgeStyle]);

  // Pseudocode -> Python Sync
  useEffect(() => {
    if (panels.includes('python')) {
      const timeoutId = setTimeout(() => {
        try {
          let fullCode = activeTab === 'Hlavní' ? pseudocode : tabContents[activeTab];
          const pyCode = parsePseudocodeToPython(fullCode || '');
          setPythonCode(pyCode);
        } catch (err) {
          console.error("Python parsing error:", err);
        }
      }, 400);
      return () => clearTimeout(timeoutId);
    }
  }, [pseudocode, tabContents, activeTab, panels]);

  const requestFlowChange = (e) => {
    e.stopPropagation();
    const nextFlow = flow === 'bidirectional' ? 'diagram-to-code' : flow === 'diagram-to-code' ? 'code-to-diagram' : 'bidirectional';
    setFlow(nextFlow);
  };

  const exportToTab = (funcName, startLine, endLine) => {
    if (!tabs.includes(funcName)) {
      setTabs([...tabs, funcName]);
      const lines = pseudocode.split('\n');
      const targetBlock = lines.slice(startLine, endLine + 1).join('\n');
      setTabContents(prev => ({ ...prev, [funcName]: targetBlock.trim() }));
    }
    setActiveTab(funcName);
  };

  const blocksToHighlight = [];
  if (activeTab === 'Hlavní') {
    const lines = pseudocode.split('\n');
    let currentBlock = null;

    lines.forEach((line, index) => {
      const match = line.match(/^(?:FUNCTION|CLASS)\s+([a-zA-Z0-9_]+)/);
      if (match) {
        if (!tabs.includes(match[1])) {
          currentBlock = { name: match[1], startLine: index, endLine: index };
          blocksToHighlight.push(currentBlock);
        }
      } else if (currentBlock && /^(?:ENDFUNCTION|ENDCLASS)/.test(line)) {
        currentBlock.endLine = index;
        currentBlock = null;
      } else if (currentBlock) {
        currentBlock.endLine = index;
      }
    });
  }

  const renderPanelContent = (type) => {
    if (type === 'drawio') {
      return (
        <div
          className="flex-1 flex flex-col relative w-full h-full"
          onMouseEnter={() => { activeWindow.current = 'drawio'; }}
          onFocusCapture={() => { activeWindow.current = 'drawio'; }}
        >
          <DiagramEditor
            xml={diagramXml}
            edgeStyle={edgeStyle} // Předání nastavení hran do editoru
            onXmlChange={(xml) => {
              if (flow === 'diagram-to-code' || (flow === 'bidirectional' && activeWindow.current === 'drawio')) {
                setDiagramXml(xml);
              }
            }}
            readOnly={flow === 'code-to-diagram'}
          />
        </div>
      );
    }

    if (type === 'python') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-gray-900">
          <LineNumberedTextarea
            value={pythonCode}
            readOnly={true}
            placeholder={`// Zde bude ${PANEL_TYPES[type].label}...`}
          />
        </div>
      );
    }

    if (type === 'pseudocode') {
      return (
        <div 
          className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-gray-900"
          onMouseEnter={() => { activeWindow.current = 'pseudocode'; }}
          onFocusCapture={() => { activeWindow.current = 'pseudocode'; }}
        >
          {parseErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-500 p-3 z-10">
              <h4 className="text-red-700 dark:text-red-400 font-bold text-sm flex items-center gap-2 mb-1"><AlertCircle size={16} /> Detekovány chyby</h4>
              <ul className="text-xs text-red-600 dark:text-red-300 list-disc list-inside space-y-1">
                {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {tabs.length > 1 && (
            <div className="flex bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 pt-2 gap-1 overflow-x-auto shrink-0 z-10">
              {tabs.map(tab => (
                <div key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-bold cursor-pointer rounded-t-lg border border-b-0 transition-colors flex items-center gap-2 ${activeTab === tab ? 'bg-white dark:bg-gray-900 text-indigo-600 border-gray-200 dark:border-gray-700' : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {tab}
                  {tab !== 'Hlavní' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTabs(tabs.filter(t => t !== tab));
                        if (activeTab === tab) setActiveTab('Hlavní');
                      }}
                      className="hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <LineNumberedTextarea
            value={activeTab === 'Hlavní' ? pseudocode : (tabContents[activeTab] || '')}
            onChange={(e) => {
              const newVal = e.target.value;
              if (activeTab === 'Hlavní') {
                setPseudocode(newVal);
              } else {
                setTabContents(prev => ({ ...prev, [activeTab]: newVal }));
                const regex = new RegExp(`(?:FUNCTION|CLASS)\\s+${activeTab}\\b[\\s\\S]*?(?:ENDFUNCTION|ENDCLASS)`, 'g');
                setPseudocode(prev => prev.replace(regex, newVal));
              }
            }}
            readOnly={flow === 'diagram-to-code'}
            placeholder={`// Zde bude ${PANEL_TYPES[type].label}...`}
            blocks={activeTab === 'Hlavní' ? blocksToHighlight : []}
            onExport={exportToTab}
          />
        </div>
      );
    }
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-950 flex flex-col font-sans overflow-hidden transition-colors" onClick={() => setActiveDropdown(null)}>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{dialog.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{dialog.desc}</p>
            <div className="flex justify-end gap-3">
              <button onClick={(e) => { e.stopPropagation(); setDialog(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">Zrušit</button>
              <button onClick={(e) => { e.stopPropagation(); dialog.onConfirm(); }} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm transition-colors">Potvrdit</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-800 px-6 py-3 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">EduCode</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 inline-block">
            {panels.map(p => PANEL_TYPES[p].label).join(' ⇄ ')}
          </span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"><Sun size={20} /></button>
      </header>

      <main className="flex-1 flex p-4 gap-4" style={{ overflow: 'hidden' }}>
        {panels.map((type, index) => (
          <React.Fragment key={type}>
            <div className={`flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 relative transition-all ${activeDropdown === index ? 'z-50 overflow-visible' : 'z-10 overflow-hidden'}`}>
              <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 flex justify-between items-center relative z-50">
                <span>{PANEL_TYPES[type].title}</span>
                <div className="flex items-center gap-2">
                  
                  {/* Select stylů hran je vložený přímo sem */}
                  {type === 'drawio' && (
                    <select
                      value={edgeStyle}
                      onChange={(e) => {
                        setEdgeStyle(e.target.value);
                        localStorage.setItem('edgeStyle', e.target.value);
                      }}
                      className="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded outline-none text-gray-600 dark:text-gray-400 cursor-pointer p-1"
                    >
                      <option value="ano-ne">Ano / Ne</option>
                      <option value="+-">+ / -</option>
                      <option value="yes-no">Yes / No</option>
                      <option value="check-cross">✔ / ✖</option>
                      <option value="true-false">True / False</option>
                    </select>
                  )}

                  <div className="relative ml-1">
                    <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === index ? null : index); }} className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 transition-colors">
                      <ChevronDown size={16} />
                    </button>
                    {activeDropdown === index && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-20 py-1 overflow-visible">
                        {Object.values(PANEL_TYPES).map(t => {
                          const isCurrent = panels[index] === t.id;
                          const isUsed = panels.includes(t.id) && !isCurrent;
                          return (
                            <button key={t.id} disabled={isUsed} onClick={(e) => { e.stopPropagation(); const newPanels = [...panels]; newPanels[index] = t.id; setPanels(newPanels); setActiveDropdown(null); }} className={`w-full px-4 py-2 text-sm flex justify-between items-center transition-colors ${isUsed ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50'}`}>
                              <span>{t.label}</span>
                              {isCurrent && <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {panels.length > 1 && (
                    <button onClick={() => {
                      const isEmpty = type === 'pseudocode' ? pseudocode.trim() === '' : false;
                      if (!isEmpty) setDialog({ title: 'Zavřít okno', desc: `Opravdu chcete zavřít okno ${PANEL_TYPES[type].label}?`, onConfirm: () => { setPanels(panels.filter((_, i) => i !== index)); setDialog(null); } });
                      else setPanels(panels.filter((_, i) => i !== index));
                    }} className="w-6 h-6 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 rounded text-gray-600 dark:text-gray-400 transition-colors">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              {renderPanelContent(type)}
            </div>

            {index === 0 && panels.length === 2 && (
              <div className="w-12 flex flex-col items-center justify-center shrink-0 gap-4">
                <button onClick={(e) => { e.stopPropagation(); setPanels([panels[1], panels[0]]); }} className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm text-gray-600 dark:text-gray-300 transition-colors">
                  <ArrowRightLeft size={18} />
                </button>
                
                {panels.includes('python') ? (
                  <button 
                    className="p-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    title="Převod do Pythonu je jednosměrný"
                  >
                    {panels[0] === 'python' ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
                  </button>
                ) : (
                  <button onClick={requestFlowChange} className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm text-gray-600 dark:text-gray-300 transition-colors" title="Změnit směr synchronizace">
                    {flow === 'bidirectional' && <Repeat size={20} />}
                    {flow === 'diagram-to-code' && (panels[0] === 'drawio' ? <ArrowRight size={20} /> : <ArrowLeft size={20} />)}
                    {flow === 'code-to-diagram' && (panels[0] === 'drawio' ? <ArrowLeft size={20} /> : <ArrowRight size={20} />)}
                  </button>
                )}
              </div>
            )}
          </React.Fragment>
        ))}

        {panels.length === 1 && (
          <div className="w-16 flex flex-col items-center justify-center shrink-0">
            <button onClick={() => {
              const available = Object.keys(PANEL_TYPES).find(t => !panels.includes(t)) || 'pseudocode';
              setPanels([...panels, available]);
            }} className="p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 border-dashed rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm text-gray-500 dark:text-gray-400 transition-colors">
              <Plus size={24} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};