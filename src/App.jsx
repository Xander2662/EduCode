import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, ArrowLeft, ArrowRightLeft, X, ChevronDown, Plus, Repeat, Moon, Sun, AlertCircle, Copy, Check, HelpCircle, Settings, Play, Pause, StepForward, Square as StopSquare } from 'lucide-react';
import { parseDrawioToPseudocode } from './parsers/diagramToPseudocode';
import { parsePseudocodeToDrawio } from './parsers/pseudocodeToDiagram';
import { parsePseudocodeToPython } from './parsers/pseudocodeToPython';
import { DiagramRunner } from './utils/runner';
import { drawioToReactFlow } from './utils/diagramConverter';
import DiagramEditor from './components/diagramEditor';
import TutorialDialog from './components/TutorialDialog';

const PANEL_TYPES = {
  drawio: { id: 'drawio', label: 'Diagram', title: 'Vizuální návrh' },
  pseudocode: { id: 'pseudocode', label: 'Pseudokód', title: 'Pseudokód' },
  python: { id: 'python', label: 'Python', title: 'Python Kód' }
};

const ErrorItem = ({ error }) => {
    const [expanded, setExpanded] = useState(false);
    
    const getErrorExplanation = (err) => {
        if (err.includes("mimo svůj Scope") || err.includes("před deklarací")) {
            return "Proměnná (např. 'x') musí být vytvořena (např. 'x = 5' nebo 'Vstup x'), než s ní začnete pracovat v podmínce nebo pro výpis. Pokud proměnnou vytvoříte uvnitř větve (např. uvnitř IF), přestane po skončení větve existovat (tzv. Scope). Mimo tento blok už proměnnou nelze použít.";
        }
        if (err.includes("počáteční blok")) {
            return "Algoritmus musí mít vždy jasně definovaný začátek. Přidejte na plátno fialový blok START a napojte ho na první krok vašeho programu.";
        }
        if (err.includes("neměla koncový blok")) {
            return "Program by měl být korektně ukončen blokem KONEC, aby bylo jasné, kde končí jeho běh.";
        }
        if (err.includes("Duplicitní název")) {
            return "Každá funkce nebo třída musí mít unikátní název. Použili jste stejný název vícekrát.";
        }
        return "Zkontrolujte logiku vašeho diagramu a ujistěte se, že všechny bloky jsou správně propojené a dávají smysl.";
    };

    return (
        <li className="flex flex-col gap-1 mb-1">
            <div className="flex justify-between items-start gap-2">
                <span className="flex-1">{error}</span>
                <button onClick={() => setExpanded(!expanded)} className="text-red-500 hover:text-red-700 bg-red-100/50 dark:bg-red-800/30 p-1 rounded transition-colors shrink-0" title="Vysvětlení chyby">
                    <HelpCircle size={14} />
                </button>
            </div>
            {expanded && (
                <div className="text-[11px] bg-red-100 dark:bg-red-900/60 p-2 rounded border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 mt-1 leading-relaxed">
                    {getErrorExplanation(error)}
                </div>
            )}
        </li>
    );
};

const LineNumberedTextarea = ({ value, onChange, readOnly, placeholder, hasErrors, blocks = [], highlightLines = [], runtimeActiveLine = null, onCursorChange, onInteract }) => {
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

  const handleInteraction = (e) => {
    if (onInteract) onInteract();
    if (onCursorChange) {
      const pos = e.target.selectionStart;
      const linesUntilCursor = value.substring(0, pos).split('\n').length - 1;
      onCursorChange(linesUntilCursor);
    }
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
           {runtimeActiveLine !== null && (
             <div className="absolute left-0 right-0 bg-red-500/30 dark:bg-red-500/30 border-y border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all z-20" style={{ top: `${16 + runtimeActiveLine * 24}px`, height: '24px' }}></div>
           )}
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
        onChange={(e) => { if (onInteract) onInteract(); onChange(e); }}
        onScroll={handleScroll}
        onClick={handleInteraction}
        onKeyDown={handleInteraction}
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

  const [parseErrors, setParseErrors] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [settingsDropdown, setSettingsDropdown] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const [edgeStyle, setEdgeStyle] = useState(localStorage.getItem('edgeStyle') || 'true-false');
  const [colorMode, setColorMode] = useState(localStorage.getItem('colorMode') !== 'false');
  const [groupColoring, setGroupColoring] = useState(localStorage.getItem('groupColoring') === 'true');
  const [showDebugger, setShowDebugger] = useState(localStorage.getItem('showDebugger') === 'true');

  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [externalSelectedIds, setExternalSelectedIds] = useState([]);
  const [nodeLineMap, setNodeLineMap] = useState({});

  const [runner, setRunner] = useState(null);
  const [runtimeActiveNodeId, setRuntimeActiveNodeId] = useState(null);
  const [runtimeVars, setRuntimeVars] = useState({});
  const [runtimeOutput, setRuntimeOutput] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const playIntervalRef = useRef(null);
  const activeWindow = useRef('drawio'); 
  const lastEdited = useRef('drawio'); 

  useEffect(() => {
    const seen = localStorage.getItem('eduCodeTutorialSeen');
    if (!seen) {
      setShowTutorial(true);
      localStorage.setItem('eduCodeTutorialSeen', 'true');
    }
  }, []);

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

  const handleCodeCursorChange = (lineIdx) => {
    const nodeId = Object.keys(nodeLineMap).find(id => nodeLineMap[id] === lineIdx);
    if (nodeId) setExternalSelectedIds([nodeId]);
    else setExternalSelectedIds([]);
  };

  // SYNC 1: Diagram -> Pseudocode
  useEffect(() => {
    if (flow === 'code-to-diagram') return;
    if (flow === 'bidirectional' && lastEdited.current !== 'drawio') return;

    const timeoutId = setTimeout(() => {
      try {
        const result = parseDrawioToPseudocode(diagramXml);
        // Bezpečný zápis do stavu zabraňující infinite-loopům
        setPseudocode(prev => prev !== result?.code ? (result?.code || '') : prev);
        setParseErrors(result?.errors || []);
        setNodeLineMap(result?.nodeLineMap || {});
      } catch (err) {
        setParseErrors([err.message]);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [diagramXml, flow]);

  // SYNC 2: Pseudocode -> Diagram
  useEffect(() => {
    if (flow === 'diagram-to-code') return;
    if (flow === 'bidirectional' && lastEdited.current !== 'pseudocode') return;

    const timeoutId = setTimeout(() => {
      try {
        if (!pseudocode || pseudocode.trim() === '') {
            setParseErrors(["Kód je prázdný. Diagram nebyl přepsán, aby nedošlo ke ztrátě dat."]);
            return;
        }

        const { xml: generatedXml, errors: genErrors } = parsePseudocodeToDrawio(pseudocode, diagramXml, edgeStyle);
        
        // Zásadní čištění: Zbavení se textu "Vstup" generovaného pseudokódem, aby v bloku zůstala jen proměnná
        const parser = new DOMParser();
        const doc = parser.parseFromString(generatedXml, "text/xml");
        let changed = false;
        doc.querySelectorAll('mxCell[style*="shape=parallelogram"]').forEach(cell => {
            let val = cell.getAttribute('value') || '';
            const originalVal = val;
            val = val.replace(/(^|>)\s*Vstup\s+/gi, '$1');
            if (val !== originalVal) {
                cell.setAttribute('value', val);
                changed = true;
            }
        });
        const finalXml = changed ? new XMLSerializer().serializeToString(doc) : generatedXml;

        setDiagramXml(prev => prev !== finalXml ? finalXml : prev);
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

  const stopDebugger = () => {
      setIsPlaying(false);
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      setRunner(null);
      setRuntimeActiveNodeId(null);
      setRuntimeVars({});
      setRuntimeOutput([]);
  };

  const startDebugger = () => {
      const { nodes, edges } = drawioToReactFlow(diagramXml);
      const newRunner = new DiagramRunner(nodes, edges);
      setRunner(newRunner);
      setRuntimeVars({});
      setRuntimeOutput([]);
      setRuntimeActiveNodeId(newRunner.currentNodeId);
      setIsPlaying(false);
      return newRunner;
  };

  const doStep = () => {
      let currentRunner = runner;
      if (!currentRunner) { 
          currentRunner = startDebugger(); 
          if (!currentRunner) return; 
      }
      
      const res = currentRunner.step();
      setRuntimeVars(res.variables);
      setRuntimeOutput(res.output);
      setRuntimeActiveNodeId(res.nextNodeId || res.currentNodeId);

      if (res.finished) {
          setIsPlaying(false);
          if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      }
      setRunner(currentRunner);
  };

  const togglePlay = () => {
      if (!runner) startDebugger();
      if (isPlaying) {
          setIsPlaying(false);
          clearInterval(playIntervalRef.current);
      } else {
          setIsPlaying(true);
          playIntervalRef.current = setInterval(() => {
              doStep();
          }, 800);
      }
  };

  useEffect(() => {
      return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); }
  }, []);

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
        <div className="flex-1 flex flex-col relative w-full h-full">
          <DiagramEditor
            xml={diagramXml}
            edgeStyle={edgeStyle}
            colorMode={colorMode}
            groupColoring={groupColoring}
            onSelectionChange={handleSelectionChange}
            externalSelectedIds={runtimeActiveNodeId ? [runtimeActiveNodeId] : externalSelectedIds}
            activeRuntimeNodeId={runtimeActiveNodeId}
            onInteract={() => { activeWindow.current = 'drawio'; lastEdited.current = 'drawio'; }}
            onXmlChange={(xml) => {
               lastEdited.current = 'drawio';
               setDiagramXml(xml);
            }}
            onImportXml={(xml) => {
               activeWindow.current = 'drawio';
               lastEdited.current = 'drawio';
               setDiagramXml(xml);
            }}
            readOnly={flow === 'code-to-diagram' || isPlaying || runner !== null}
          />
          
          {showDebugger && (
            <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden flex flex-col justify-between p-4">
                <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                <div className="flex justify-end w-full mt-14">
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-xl w-64 pointer-events-auto flex flex-col overflow-hidden transition-all">
                       <div className="px-4 py-3 border-b border-gray-200/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Paměť</span>
                          <span className={`w-2 h-2 rounded-full ${runner && !runner.isFinished ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                       </div>
                       <div className="p-4 flex flex-col gap-2 max-h-[40vh] overflow-y-auto no-scrollbar">
                          {Object.keys(runtimeVars).length === 0 ? (
                              <div className="text-xs text-gray-400 italic text-center">Zatím prázdné</div>
                          ) : (
                              Object.keys(runtimeVars).map(k => (
                                  <div key={k} className="flex justify-between items-center text-sm font-mono bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-1.5 rounded-lg">
                                      <span className="text-gray-600 dark:text-gray-400">{k}</span>
                                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{runtimeVars[k]}</span>
                                  </div>
                              ))
                          )}
                       </div>
                    </div>
                </div>

                <div className="flex justify-between items-end w-full pointer-events-none mb-2">
                    <div className="w-72 pointer-events-auto">
                      {runtimeOutput.length > 0 && (
                        <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-xl p-4 w-full">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Výstup (Console)</div>
                            <div className="font-mono text-sm text-green-400 flex flex-col gap-1 max-h-[20vh] overflow-y-auto no-scrollbar">
                                {runtimeOutput.slice(-5).map((o,i) => <div key={i}>{`> ${o}`}</div>)}
                            </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 rounded-full shadow-2xl p-2 pointer-events-auto flex gap-2">
                        <button onClick={doStep} disabled={isPlaying || (runner && runner.isFinished)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300 disabled:opacity-30 transition-all"><StepForward size={20} /></button>
                        <button onClick={togglePlay} disabled={runner && runner.isFinished} className={`p-3 rounded-full transition-all ${isPlaying ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}>
                            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                        </button>
                        <button onClick={stopDebugger} disabled={!runner} className="p-3 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full text-red-500 disabled:opacity-30 transition-all"><StopSquare size={20} /></button>
                    </div>

                    <div className="w-72" /> 
                </div>
            </div>
          )}
        </div>
      );
    }

    if (type === 'python') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-gray-900">
          <LineNumberedTextarea value={pythonCode} readOnly={true} placeholder={`// Zde bude ${PANEL_TYPES[type].label}...`} />
        </div>
      );
    }

    if (type === 'pseudocode') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-gray-900">
          {parseErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-500 p-3 z-10">
              <h4 className="text-red-700 dark:text-red-400 font-bold text-sm flex items-center gap-2 mb-2"><AlertCircle size={16} /> Upozornění</h4>
              <ul className="text-xs text-red-600 dark:text-red-300 list-inside">
                {parseErrors.map((e, i) => <ErrorItem key={i} error={e} />)}
              </ul>
            </div>
          )}

          <LineNumberedTextarea
            value={pseudocode}
            onChange={(e) => {
               lastEdited.current = 'pseudocode';
               activeWindow.current = 'pseudocode';
               setPseudocode(e.target.value);
            }}
            onInteract={() => { activeWindow.current = 'pseudocode'; lastEdited.current = 'pseudocode'; }}
            onCursorChange={handleCodeCursorChange}
            readOnly={flow === 'diagram-to-code'}
            placeholder={`// Zde bude ${PANEL_TYPES[type].label}...`}
            blocks={blocksToHighlight}
            runtimeActiveLine={runtimeActiveNodeId !== null ? nodeLineMap[runtimeActiveNodeId] : null}
            highlightLines={selectedNodeIds.map(id => nodeLineMap[id]).filter(l => l !== undefined && l !== null)}
          />
        </div>
      );
    }
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-950 flex flex-col font-sans overflow-hidden transition-colors" onClick={() => { setActiveDropdown(null); setSettingsDropdown(null); }}>
      {showTutorial && <TutorialDialog onClose={() => setShowTutorial(false)} />}
      
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
            <div 
              className={`flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 relative transition-all ${activeDropdown === index || settingsDropdown === index ? 'z-50 overflow-visible' : 'z-10 overflow-hidden'}`}
              onPointerDownCapture={() => { activeWindow.current = type; }}
              onKeyDownCapture={() => { activeWindow.current = type; }}
            >
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
                    <div className="relative mr-1">
                      <button onClick={(e) => { e.stopPropagation(); setSettingsDropdown(settingsDropdown === index ? null : index); setActiveDropdown(null); }} className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 transition-colors" title="Nastavení diagramu">
                        <Settings size={16} />
                      </button>
                      {settingsDropdown === index && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 p-3" onClick={e => e.stopPropagation()}>
                          
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Pravda / Nepravda alias</label>
                          <select
                            value={edgeStyle}
                            onChange={(e) => { setEdgeStyle(e.target.value); localStorage.setItem('edgeStyle', e.target.value); }}
                            className="w-full text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded outline-none p-1.5 cursor-pointer text-gray-700 dark:text-gray-300 mb-4"
                          >
                            <option value="true-false">True / False</option>
                            <option value="ano-ne">Ano / Ne</option>
                            <option value="yes-no">Yes / No</option>
                            <option value="+-">+ / -</option>
                          </select>

                          <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={colorMode} onChange={e => { setColorMode(e.target.checked); localStorage.setItem('colorMode', e.target.checked); }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                Barevné bloky
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={groupColoring} onChange={e => { setGroupColoring(e.target.checked); localStorage.setItem('groupColoring', e.target.checked); }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                Zbarvení skupin
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={showDebugger} onChange={e => { setShowDebugger(e.target.checked); localStorage.setItem('showDebugger', e.target.checked); if(!e.target.checked) stopDebugger(); }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                Debugger (Watch list)
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="relative ml-1">
                    <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === index ? null : index); setSettingsDropdown(null); }} className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 transition-colors" title="Změnit okno">
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
                  <button className="p-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm text-gray-400 dark:text-gray-600 cursor-not-allowed" title="Převod do Pythonu je jednosměrný">
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