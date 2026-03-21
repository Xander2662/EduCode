import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, ArrowRightLeft, X, ChevronDown, Plus, Repeat, Moon, Sun, AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { parseDrawioToPseudocode } from './parsers/diagramToPseudocode';
import { parsePseudocodeToDrawio } from './parsers/pseudocodeToDiagram';
import DiagramEditor from './components/diagramEditor';

const PANEL_TYPES = {
  drawio: { id: 'drawio', label: 'Diagram', title: 'Vizuální návrh' },
  pseudocode: { id: 'pseudocode', label: 'Pseudokód', title: 'Pseudokód' },
  python: { id: 'python', label: 'Python', title: 'Python Kód' }
};

const LineNumberedTextarea = ({ value, onChange, readOnly, placeholder, hasErrors }) => {
  const lineCount = value?.split('\n').length || 1;
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex-1 flex overflow-hidden bg-white dark:bg-gray-900 relative transition-all duration-300 group ${hasErrors ? 'shadow-[0_0_20px_rgba(239,68,68,0.3)] border border-red-500 rounded-lg m-2' : ''}`}>
      <button onClick={handleCopy} className="absolute top-2 right-4 p-2 bg-white/90 dark:bg-gray-800/90 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md shadow-sm border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10">
        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
      </button>
      <div ref={lineNumbersRef} className="w-12 bg-gray-50 dark:bg-gray-800 text-gray-400 text-right pr-3 py-4 font-mono text-sm overflow-hidden select-none border-r border-gray-200 dark:border-gray-700">
        {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => <div key={i} className="leading-6">{i + 1}</div>)}
      </div>
      <textarea ref={textareaRef} className={`flex-1 w-full p-4 resize-none focus:outline-none font-mono text-sm bg-transparent leading-6 whitespace-pre ${hasErrors ? 'text-red-700 dark:text-red-300' : 'text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/50'}`} value={value} onChange={onChange} onScroll={handleScroll} readOnly={readOnly} placeholder={placeholder} />
    </div>
  );
};

export default function App() {
  const [flow, setFlow] = useState('bidirectional');
  const [panels, setPanels] = useState(['drawio', 'pseudocode']);
  
  const [diagramXml, setDiagramXml] = useState('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
  const [pseudocode, setPseudocode] = useState('');
  
  const [tabs, setTabs] = useState(['Hlavní']);
  const [activeTab, setActiveTab] = useState('Hlavní');
  const [tabContents, setTabContents] = useState({});

  const [parseErrors, setParseErrors] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dialog, setDialog] = useState(null);

  const lastSource = useRef(null);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    if (flow === 'bidirectional' || flow === 'diagram-to-code') {
      if (flow === 'bidirectional' && lastSource.current === 'pseudocode') return;

      const timeoutId = setTimeout(() => {
        try {
          const result = parseDrawioToPseudocode(diagramXml);
          // Tady by měl parser vracet raw text do 'Hlavní', taby řešíme vizuálně
          setPseudocode(result?.code || '');
          setParseErrors(result?.errors || []);
        } catch(err) {
          setParseErrors([err.message]);
        }
      }, 400);
      return () => clearTimeout(timeoutId);
    }
  }, [diagramXml, flow]);

  useEffect(() => {
    if (flow === 'bidirectional' || flow === 'code-to-diagram') {
      if (flow === 'bidirectional' && lastSource.current === 'diagram') return;

      const timeoutId = setTimeout(() => {
        try {
          // Pseudocode generuje XML pro diagram
          let fullCode = activeTab === 'Hlavní' ? pseudocode : tabContents[activeTab];
          const generatedXml = parsePseudocodeToDrawio(fullCode || '');
          setDiagramXml(generatedXml);
          setParseErrors([]); 
        } catch (err) {
          setParseErrors([err.message]);
        }
      }, 400); 
      return () => clearTimeout(timeoutId);
    }
  }, [pseudocode, tabContents, activeTab, flow]);

  const requestFlowChange = (e) => {
    e.stopPropagation();
    const nextFlow = flow === 'bidirectional' ? 'diagram-to-code' : flow === 'diagram-to-code' ? 'code-to-diagram' : 'bidirectional';
    setFlow(nextFlow);
  };

  const exportToTab = (funcName) => {
    if (!tabs.includes(funcName)) {
      setTabs([...tabs, funcName]);
      // Extrahuje daný blok z kódu pro novou záložku
      const blocks = pseudocode.split('# ----------------------');
      const targetBlock = blocks.find(b => b.includes(`FUNCTION ${funcName}`) || b.includes(`CLASS ${funcName}`)) || '';
      setTabContents(prev => ({...prev, [funcName]: targetBlock.trim()}));
    }
    setActiveTab(funcName);
  };

  // Detekce bloků pro export z Hlavní záložky
  const detectedBlocks = [];
  if (activeTab === 'Hlavní') {
    const matches = pseudocode.matchAll(/(?:FUNCTION|CLASS)\s+([a-zA-Z0-9_]+)/g);
    for (const match of matches) {
      if (!tabs.includes(match[1])) detectedBlocks.push(match[1]);
    }
  }

  const renderPanelContent = (type) => {
    if (type === 'drawio') {
      return (
        <div className="flex-1 flex flex-col relative w-full h-full">
          <DiagramEditor 
            xml={diagramXml} 
            onXmlChange={(xml) => {
              lastSource.current = 'diagram';
              setDiagramXml(xml);
            }} 
            readOnly={flow === 'code-to-diagram'} 
          />
        </div>
      );
    }
    
    if (type === 'pseudocode') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-gray-900">
          {parseErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-500 p-3 z-10">
              <h4 className="text-red-700 dark:text-red-400 font-bold text-sm flex items-center gap-2 mb-1"><AlertCircle size={16}/> Detekovány chyby</h4>
              <ul className="text-xs text-red-600 dark:text-red-300 list-disc list-inside space-y-1">
                {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* Tab Bar */}
          {tabs.length > 1 && (
            <div className="flex bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 pt-2 gap-1 overflow-x-auto shrink-0">
              {tabs.map(tab => (
                <div key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-bold cursor-pointer rounded-t-lg border border-b-0 transition-colors flex items-center gap-2 ${activeTab === tab ? 'bg-white dark:bg-gray-900 text-indigo-600 border-gray-200 dark:border-gray-700' : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {tab}
                  {tab !== 'Hlavní' && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setTabs(tabs.filter(t => t !== tab)); 
                        if(activeTab === tab) setActiveTab('Hlavní'); 
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

          {/* Rychlý export detected bloků */}
          {activeTab === 'Hlavní' && detectedBlocks.length > 0 && (
            <div className="flex gap-2 p-2 bg-indigo-50/50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 shrink-0">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center">Detekováno:</span>
              {detectedBlocks.map(b => (
                <button key={b} onClick={() => exportToTab(b)} className="text-xs bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-200 dark:hover:bg-indigo-700 flex items-center gap-1 font-bold">
                  <ExternalLink size={12} /> {b}
                </button>
              ))}
            </div>
          )}

          <LineNumberedTextarea 
            value={activeTab === 'Hlavní' ? pseudocode : (tabContents[activeTab] || '')}
            onChange={(e) => {
              lastSource.current = 'pseudocode';
              if (activeTab === 'Hlavní') {
                setPseudocode(e.target.value);
              } else {
                setTabContents(prev => ({...prev, [activeTab]: e.target.value}));
              }
            }}
            readOnly={type !== 'pseudocode' || flow === 'diagram-to-code'}
            placeholder={`// Zde bude ${PANEL_TYPES[type].label}...`}
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

      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        {panels.map((type, index) => (
          <React.Fragment key={type}>
            <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden relative">
              <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 flex justify-between items-center">
                <span>{PANEL_TYPES[type].title}</span>
                <div className="flex items-center gap-1">
                  <div className="relative">
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
                        if (!isEmpty) setDialog({ title: 'Zavřít okno', desc: `Opravdu chcete zavřít okno ${PANEL_TYPES[type].label}?`, onConfirm: () => { setPanels(panels.filter((_, i) => i !== index)); setDialog(null); }});
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
                <button onClick={requestFlowChange} className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm text-gray-600 dark:text-gray-300 transition-colors">
                  {flow === 'bidirectional' && <Repeat size={20} />}
                  {flow === 'diagram-to-code' && <ArrowRight size={20} />}
                  {flow === 'code-to-diagram' && <ArrowLeft size={20} />}
                </button>
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
}