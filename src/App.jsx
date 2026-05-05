import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, ArrowLeft, ArrowRightLeft, X, ChevronDown, Plus, Repeat, Moon, Sun, AlertCircle, Copy, Check, HelpCircle, Move, RefreshCcw, Square, Circle, AlignLeft, Diamond, MessageSquare, MousePointer, Settings, Play, Pause, StepForward, Square as StopSquare } from 'lucide-react';
import { parseDrawioToPseudocode } from './parsers/diagramToPseudocode';
import { parsePseudocodeToDrawio } from './parsers/pseudocodeToDiagram';
import { parsePseudocodeToPython } from './parsers/pseudocodeToPython';
import { DiagramRunner } from './utils/runner';
import { drawioToReactFlow } from './utils/diagramConverter';
import DiagramEditor from './components/diagramEditor';

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

const LineNumberedTextarea = ({ value, onChange, readOnly, placeholder, hasErrors, blocks = [], highlightLines = [], runtimeActiveLine = null, onCursorChange }) => {
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
        onChange={onChange}
        onScroll={handleScroll}
        onClick={handleInteraction}
        onKeyUp={handleInteraction}
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
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><HelpCircle size={20} className="text-indigo-500"/> Nápověda k editoru</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1"><X size={20} /></button>
        </div>
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 overflow-x-auto">
          <button onClick={() => setTab('zaklady')} className={`px-4 py-3 text-sm font-semibold transition-colors shrink-0 ${tab === 'zaklady' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>Základní bloky</button>
          <button onClick={() => setTab('spojovani')} className={`px-4 py-3 text-sm font-semibold transition-colors shrink-0 ${tab === 'spojovani' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>Spojování & Cykly</button>
          <button onClick={() => setTab('klavesy')} className={`px-4 py-3 text-sm font-semibold transition-colors shrink-0 ${tab === 'klavesy' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>Klávesové zkratky</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh] text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-6">
          {tab === 'zaklady' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-fuchsia-200 bg-fuchsia-50 dark:bg-fuchsia-900/20 p-4 rounded-lg flex items-start gap-3">
                <Circle size={24} className="text-fuchsia-600 mt-1 shrink-0" />
                <div><h4 className="font-bold text-fuchsia-800 dark:text-fuchsia-400">Start / Konec</h4><p className="text-xs mt-1">Povinné bloky.</p></div>
              </div>
              <div className="border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3">
                <Square size={24} className="text-blue-600 mt-1 shrink-0" />
                <div><h4 className="font-bold text-blue-800 dark:text-blue-400">Akce (Operace)</h4><p className="text-xs mt-1">Matematika a výpisy.</p></div>
              </div>
            </div>
          )}
          {tab === 'spojovani' && (<div><p>Zde je nápověda pro spojování...</p></div>)}
          {tab === 'klavesy' && (<div><p>Klávesové zkratky...</p></div>)}
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

  // --- RUNTIME STATE ---
  const [runner, setRunner] = useState(null);
  const [runtimeActiveNodeId, setRuntimeActiveNodeId] = useState(null);
  const [runtimeVars, setRuntimeVars] = useState({});
  const [runtimeOutput, setRuntimeOutput] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const playIntervalRef = useRef(null);
  const activeWindow = useRef('pseudocode'); 

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
        if (!pseudocode || pseudocode.trim() === '') {
            setParseErrors(["Kód je prázdný. Diagram nebyl přepsán, aby nedošlo ke ztrátě dat."]);
            return;
        }

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

  // --- RUNTIME CONTROLS ---
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
        <div
          className="flex-1 flex flex-col relative w-full h-full"
          onMouseEnter={() => { activeWindow.current = 'drawio'; }}
          onFocusCapture={() => { activeWindow.current = 'drawio'; }}
        >
          <DiagramEditor
            xml={diagramXml}
            edgeStyle={edgeStyle}
            colorMode={colorMode}
            groupColoring={groupColoring}
            onSelectionChange={handleSelectionChange}
            externalSelectedIds={runtimeActiveNodeId ? [runtimeActiveNodeId] : externalSelectedIds}
            activeRuntimeNodeId={runtimeActiveNodeId}
            onXmlChange={(xml) => {
              if (flow === 'diagram-to-code' || (flow === 'bidirectional' && activeWindow.current === 'drawio')) {
                setDiagramXml(xml);
              }
            }}
            onImportXml={(xml) => {
                activeWindow.current = 'drawio'; 
                setDiagramXml(xml);
            }}
            readOnly={flow === 'code-to-diagram' || isPlaying || runner !== null}
          />
          
          {showDebugger && (
            <div className="absolute top-20 left-4 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-30 flex flex-col overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-900 px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span>Debugger</span>
                    <div className={`w-2 h-2 rounded-full ${runner && !runner.isFinished ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} title={runner && !runner.isFinished ? 'Běží' : 'Zastaveno'}></div>
                </div>
                <div className="flex flex-col h-[180px] text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex-1 p-3 overflow-y-auto border-b border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between font-mono text-xs border-b border-gray-200 dark:border-gray-700 pb-1 mb-2">
                            <span className="font-semibold text-gray-500">Proměnná</span>
                            <span className="font-semibold text-gray-500">Hodnota</span>
                        </div>
                        {Object.keys(runtimeVars).length === 0 ? (
                             <div className="flex justify-center items-center h-full text-xs text-gray-400 italic mt-6">
                                Watch list je prázdný
                             </div>
                        ) : (
                             Object.keys(runtimeVars).map(k => (
                                 <div key={k} className="flex justify-between text-xs font-mono mb-1">
                                     <span>{k}</span>
                                     <span className="font-bold text-indigo-600 dark:text-indigo-400">{runtimeVars[k]}</span>
                                 </div>
                             ))
                        )}
                    </div>
                    <div className="h-[70px] p-2 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                         <div className="font-bold mb-1 text-[10px] text-gray-400 uppercase">Výstup</div>
                         {runtimeOutput.map((o,i) => <div key={i} className="text-xs font-mono text-gray-800 dark:text-gray-200">{`> ${o}`}</div>)}
                    </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-2 flex gap-3 justify-center border-t border-gray-200 dark:border-gray-700">
                    <button onClick={doStep} disabled={isPlaying || (runner && runner.isFinished)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 disabled:opacity-30 transition-colors" title="Krok (Step)"><StepForward size={16} /></button>
                    <button onClick={togglePlay} disabled={runner && runner.isFinished} className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors ${isPlaying ? 'text-amber-500' : 'text-green-600 dark:text-green-500'}`} title={isPlaying ? "Pauza" : "Spustit"}>
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button onClick={stopDebugger} disabled={!runner} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-red-600 dark:text-red-500 disabled:opacity-30 transition-colors" title="Zastavit (Stop)"><StopSquare size={16} /></button>
                </div>
            </div>
          )}
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
              <h4 className="text-red-700 dark:text-red-400 font-bold text-sm flex items-center gap-2 mb-2"><AlertCircle size={16} /> Upozornění</h4>
              <ul className="text-xs text-red-600 dark:text-red-300 list-inside">
                {parseErrors.map((e, i) => <ErrorItem key={i} error={e} />)}
              </ul>
            </div>
          )}

          <LineNumberedTextarea
            value={pseudocode}
            onChange={(e) => setPseudocode(e.target.value)}
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
            <div className={`flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 relative transition-all ${activeDropdown === index || settingsDropdown === index ? 'z-50 overflow-visible' : 'z-10 overflow-hidden'}`}>
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