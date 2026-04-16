import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, ArrowLeft, ArrowRightLeft, X, ChevronDown, Plus, Repeat, Moon, Sun, AlertCircle, Copy, Check, HelpCircle, Move, ArrowUpCircle } from 'lucide-react';
import { parseDrawioToPseudocode } from './parsers/diagramToPseudocode';
import { parsePseudocodeToDrawio } from './parsers/pseudocodeToDiagram';
import { parsePseudocodeToPython } from './parsers/pseudocodeToPython';
import DiagramEditor from './components/diagramEditor';

const PANEL_TYPES = {
  drawio: { id: 'drawio', label: 'Diagram', title: 'Vizuální návrh' },
  pseudocode: { id: 'pseudocode', label: 'Pseudokód', title: 'Pseudokód' },
  python: { id: 'python', label: 'Python', title: 'Python Kód' }
};

const LineNumberedTextarea = ({ value, onChange, readOnly, placeholder, hasErrors, blocks = [], highlightLines = [] }) => {
  const lineCount = value?.split('\n').length || 1;
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const overlayRef = useRef(null);
  const highlightRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleScroll = (e) => {
    const top = e.target.scrollTop;
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = top;
    if (overlayRef.current) overlayRef.current.scrollTop = top;
    if (highlightRef.current) highlightRef.current.scrollTop = top;
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

      <div ref={highlightRef} className="absolute inset-y-0 right-0 left-12 overflow-hidden pointer-events-none z-0">
        <div className="relative w-full" style={{ height: `${Math.max(lineCount * 24 + 32, 100)}px` }}>
           {highlightLines.map((line, idx) => (
             <div key={idx} className="absolute left-0 right-0 bg-indigo-500/20 dark:bg-indigo-400/20 transition-all" style={{ top: `${16 + line * 24}px`, height: '24px' }}></div>
           ))}
        </div>
      </div>

      <div ref={overlayRef} className="absolute inset-y-0 right-0 left-12 overflow-hidden pointer-events-none z-10">
        <div className="relative w-full" style={{ height: `${Math.max(lineCount * 24 + 32, 100)}px` }}>
          {blocks.map((b, i) => (
            <div key={i} className="absolute left-0 right-0 bg-indigo-500/10 dark:bg-indigo-400/10 border-y border-indigo-300/50 dark:border-indigo-700/50 pointer-events-none transition-colors"
              style={{ top: `${16 + b.startLine * 24}px`, height: `${(b.endLine - b.startLine + 1) * 24}px` }}>
            </div>
          ))}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className={`flex-1 w-full p-4 resize-none focus:outline-none font-mono text-sm bg-transparent leading-6 whitespace-pre relative z-10 ${hasErrors ? 'text-red-700 dark:text-red-300' : 'text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/50'}`}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    </div>
  );
};

const TutorialDialog = ({ onClose }) => {
  const [tab, setTab] = useState('zaklady');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><HelpCircle size={20} className="text-indigo-500"/> Nápověda k editoru diagramů</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1"><X size={20} /></button>
        </div>
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button onClick={() => setTab('zaklady')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'zaklady' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>Základy & Spojování</button>
          <button onClick={() => setTab('cykly')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'cykly' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>Cykly a Podmínky</button>
          <button onClick={() => setTab('klavesy')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'klavesy' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>Klávesové zkratky</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh] text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-6">
          {tab === 'zaklady' && (
            <>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2 text-base">Vkládání bloků (Drag & Drop)</h3>
                <p className="mb-4">Nemusíte složitě mazat a znovu tvořit šipky. Jakýkoliv blok z horního menu můžete kliknutím vložit, a nebo jej přesunout <strong>přímo nad existující šipku</strong>. Šipka se fialově rozsvítí a blok se do ní sám vklíní.</p>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-center gap-4 border border-gray-200 dark:border-gray-700">
                  <div className="w-16 h-10 border-2 border-gray-400 rounded flex items-center justify-center text-xs">Akce 1</div>
                  <div className="flex flex-col items-center gap-1 text-indigo-500">
                    <Move size={20} className="animate-bounce" />
                    <div className="w-16 h-8 bg-indigo-100 dark:bg-indigo-900/50 border-2 border-indigo-400 border-dashed rounded flex items-center justify-center text-xs">Nový</div>
                  </div>
                  <div className="w-16 h-10 border-2 border-gray-400 rounded flex items-center justify-center text-xs">Akce 2</div>
                </div>
              </div>
            </>
          )}
          {tab === 'cykly' && (
            <>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2 text-base">Tvorba cyklu (WHILE / FOR)</h3>
                <p className="mb-4">Do kosočtverce <strong>nemusíte psát slovo WHILE</strong> (ale můžete, systém to pochopí). Stačí napsat pouze samotnou podmínku (např. <code>x &lt; 10</code>).</p>
                <p className="mb-4">Systém automaticky pozná, že jde o cyklus, jakmile vezmete šipku z konce akce a <strong>propojíte ji zpět nahoru</strong> nad kosočtverec.</p>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 flex flex-col items-center justify-center gap-4 border border-gray-200 dark:border-gray-700 relative">
                  <div className="w-20 h-20 border-2 border-gray-400 rotate-45 flex items-center justify-center bg-white dark:bg-gray-900"><span className="-rotate-45 text-xs font-bold">x &lt; 10</span></div>
                  <div className="w-24 h-10 border-2 border-gray-400 rounded flex items-center justify-center text-xs bg-white dark:bg-gray-900 relative">Akce
                     <ArrowUpCircle size={24} className="absolute -right-10 text-indigo-500" />
                  </div>
                </div>
              </div>
            </>
          )}
          {tab === 'klavesy' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <kbd className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono text-gray-800 dark:text-gray-200">Delete</kbd> nebo <kbd className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono text-gray-800 dark:text-gray-200">Backspace</kbd>
                <p className="mt-2 text-xs">Smaže vybraný blok nebo hranu.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <kbd className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono text-gray-800 dark:text-gray-200">Ctrl + C</kbd> a <kbd className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono text-gray-800 dark:text-gray-200">Ctrl + V</kbd>
                <p className="mt-2 text-xs">Zkopíruje a vloží vybrané bloky (včetně jejich propojení).</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <kbd className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono text-gray-800 dark:text-gray-200">F2</kbd>
                <p className="mt-2 text-xs">Okamžitě začne upravovat text vybraného bloku.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <kbd className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded text-xs mr-2 shadow-sm font-mono text-gray-800 dark:text-gray-200">Ctrl + A</kbd>
                <p className="mt-2 text-xs">Vybere všechny bloky a hrany v diagramu.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [flow, setFlow] = useState('bidirectional');
  const [panels, setPanels] = useState(['drawio', 'pseudocode']);

  const [diagramXml, setDiagramXml] = useState('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
  const [pseudocode, setPseudocode] = useState('');
  const [pythonCode, setPythonCode] = useState('');

  const [parseErrors, setParseErrors] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const [edgeStyle, setEdgeStyle] = useState(localStorage.getItem('edgeStyle') || '+-');
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [nodeLineMap, setNodeLineMap] = useState({});

  const activeWindow = useRef('pseudocode'); 

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const handleSelectionChange = useCallback((ids) => {
    setSelectedNodeIds(prev => {
      if (prev.length !== ids.length) return ids;
      const sortedPrev = [...prev].sort();
      const sortedIds = [...ids].sort();
      for (let i = 0; i < sortedPrev.length; i++) {
        if (sortedPrev[i] !== sortedIds[i]) return ids;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (flow === 'code-to-diagram') return;
    if (flow === 'bidirectional' && activeWindow.current !== 'drawio') return;

    const timeoutId = setTimeout(() => {
      try {
        const result = parseDrawioToPseudocode(diagramXml);
        setPseudocode(result?.code || '');
        setParseErrors(result?.errors || []);
        setNodeLineMap(result?.nodeLineMap || {});
      } catch (err) {
        setParseErrors([err.message]);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [diagramXml, flow]);

  useEffect(() => {
    if (flow === 'diagram-to-code') return;
    if (flow === 'bidirectional' && activeWindow.current !== 'pseudocode') return;

    const timeoutId = setTimeout(() => {
      try {
        const { xml: generatedXml, errors: genErrors } = parsePseudocodeToDrawio(pseudocode || '', diagramXml, edgeStyle);
        if (diagramXml !== generatedXml) {
            setDiagramXml(generatedXml);
        }
        setParseErrors(genErrors || []);
      } catch (err) {
        setParseErrors([err.message]);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [pseudocode, flow, edgeStyle]);

  useEffect(() => {
    if (panels.includes('python')) {
      const timeoutId = setTimeout(() => {
        try {
          const pyCode = parsePseudocodeToPython(pseudocode || '');
          setPythonCode(pyCode);
        } catch (err) {
          console.error("Python parsing error:", err);
        }
      }, 400);
      return () => clearTimeout(timeoutId);
    }
  }, [pseudocode, panels]);

  const requestFlowChange = (e) => {
    e.stopPropagation();
    const nextFlow = flow === 'bidirectional' ? 'diagram-to-code' : flow === 'diagram-to-code' ? 'code-to-diagram' : 'bidirectional';
    setFlow(nextFlow);
  };

  const blocksToHighlight = [];
  const lines = pseudocode.split('\n');
  let currentBlock = null;

  lines.forEach((line, index) => {
    const match = line.match(/^\s*(?:FUNCTION|CLASS)\s+([a-zA-Z0-9_]+)/i);
    if (match) {
      if (currentBlock) currentBlock.endLine = index - 1; 
      currentBlock = { name: match[1], startLine: index, endLine: index };
      blocksToHighlight.push(currentBlock);
    } else if (currentBlock && /^\s*(?:ENDFUNCTION|ENDCLASS)/i.test(line)) {
      currentBlock.endLine = index;
      currentBlock = null;
    } else if (currentBlock) {
      currentBlock.endLine = index;
    }
  });

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
            edgeStyle={edgeStyle}
            onSelectionChange={handleSelectionChange}
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
              <h4 className="text-red-700 dark:text-red-400 font-bold text-sm flex items-center gap-2 mb-1"><AlertCircle size={16} /> Upozornění</h4>
              <ul className="text-xs text-red-600 dark:text-red-300 list-disc list-inside space-y-1">
                {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <LineNumberedTextarea
            value={pseudocode}
            onChange={(e) => setPseudocode(e.target.value)}
            readOnly={flow === 'diagram-to-code'}
            placeholder={`// Zde bude ${PANEL_TYPES[type].label}...`}
            blocks={blocksToHighlight}
            highlightLines={selectedNodeIds.map(id => nodeLineMap[id]).filter(l => l !== undefined && l !== null)}
          />
        </div>
      );
    }
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-950 flex flex-col font-sans overflow-hidden transition-colors" onClick={() => setActiveDropdown(null)}>

      {showTutorial && <TutorialDialog onClose={() => setShowTutorial(false)} />}

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
                <div className="flex items-center gap-2">
                  <span>{PANEL_TYPES[type].title}</span>
                  {type === 'drawio' && (
                    <button onClick={(e) => { e.stopPropagation(); setShowTutorial(true); }} className="text-indigo-500 hover:text-indigo-600 transition-colors bg-indigo-50 dark:bg-indigo-900/30 rounded-full p-1 ml-1" title="Nápověda k editoru">
                      <HelpCircle size={16} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  
                  {type === 'drawio' && (
                    <select
                      value={edgeStyle}
                      onChange={(e) => {
                        setEdgeStyle(e.target.value);
                        localStorage.setItem('edgeStyle', e.target.value);
                      }}
                      className="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded outline-none text-gray-600 dark:text-gray-400 cursor-pointer p-1"
                    >
                      <option value="+-">+ / -</option>
                      <option value="ano-ne">Ano / Ne</option>
                      <option value="yes-no">Yes / No</option>
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
}