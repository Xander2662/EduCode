import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, ArrowLeft, ArrowRightLeft, X, ChevronDown, Plus, Repeat, Moon, Sun, AlertCircle, Copy, Check, Info, HelpCircle, Settings, Play, Pause, StepForward, Square as StopSquare, Bug, RefreshCcw, Download, Terminal, Maximize2, Minimize2 } from 'lucide-react';
import { parseDrawioToPseudocode } from './parsers/diagramToPseudocode';
import { parsePseudocodeToDrawio } from './parsers/pseudocodeToDiagram';
import { parseDrawioToPython } from './parsers/diagramToPython';
import { parsePythonToPseudocode } from './parsers/pythonToPseudocode';
import { Tooltip } from './components/Tooltip';
import { DiagramRunner } from './utils/runner';
import { drawioToReactFlow } from './utils/diagramConverter';
import DiagramEditor from './components/diagramEditor';
import TutorialDialog from './components/TutorialDialog';

const DebuggerConsole = ({ events }) => {
    const [expanded, setExpanded] = useState(true);
    const [showInfo, setShowInfo] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events, expanded]);

    useEffect(() => {
        const handleClickOutside = () => setShowInfo(false);
        if (showInfo) {
            window.addEventListener('click', handleClickOutside);
            return () => window.removeEventListener('click', handleClickOutside);
        }
    }, [showInfo]);

    if (!expanded) {
        return (
            <Tooltip text="Zobrazit konzoli" position="left">
                <button 
                    onClick={() => setExpanded(true)} 
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 h-10 w-10 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-700 transition-all pointer-events-auto flex items-center justify-center"
                >
                    <Terminal size={18} />
                </button>
            </Tooltip>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow w-full pointer-events-auto flex flex-col transition-all duration-300 relative" style={{ maxHeight: '200px' }}>
            <div className="flex justify-between items-center px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 rounded-t">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 relative">
                    <Terminal size={12} />
                    Konzole
                    <div className="relative flex items-center">
                        <Tooltip text="Nápověda pro Debugger Konzoli">
                            <button onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }} className="text-indigo-500 hover:text-indigo-600 transition-colors bg-indigo-50 dark:bg-indigo-900/30 rounded-full p-0.5 ml-1 flex items-center justify-center">
                                <HelpCircle size={10} />
                            </button>
                        </Tooltip>
                        
                        {showInfo && (
                            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 w-72 z-[9999] text-xs text-gray-700 dark:text-gray-300 font-normal normal-case text-left cursor-default" onClick={e => e.stopPropagation()}>
                                <p className="mb-2 text-sm text-gray-800 dark:text-gray-100 font-semibold border-b border-gray-100 dark:border-gray-700 pb-2">Debugger Konzole</p>
                                <p className="mb-3 text-gray-600 dark:text-gray-400">Tento panel zachycuje veškerý výstup běžícího programu.</p>
                                <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                                    <li className="flex items-start gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0"></span> 
                                        <div><strong className="text-gray-800 dark:text-gray-200">Standardní výstup:</strong> (např. PRINT "Ahoj")</div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1 shrink-0"></span> 
                                        <div><strong className="text-gray-800 dark:text-gray-200">Zprávy debuggeru:</strong> (např. přeskočené cykly)</div>
                                    </li>
                                </ul>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 transform rotate-45"></div>
                            </div>
                        )}
                    </div>
                </div>
                <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                    <Minimize2 size={14} />
                </button>
            </div>
            
            <div 
                ref={scrollRef}
                className="p-3 font-mono text-sm flex flex-col gap-1 overflow-y-auto no-scrollbar"
                style={{ 
                    minHeight: '36px', 
                    maxHeight: '130px' 
                }}
            >
                {events.length === 0 ? (
                    <div className="text-gray-400 dark:text-gray-500 italic text-xs">Čekání na výstup...</div>
                ) : (
                    events.map((ev, i) => (
                        <div key={i} className={`flex items-start gap-2 leading-relaxed ${ev.type === 'insight' ? 'text-indigo-500/90 dark:text-indigo-400/90 italic' : 'text-green-700 dark:text-green-400 font-semibold'}`}>
                            <span className="opacity-50 select-none">{'>'}</span>
                            <span className="break-words">{ev.msg}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const PANEL_TYPES = {
  drawio: { id: 'drawio', label: 'Diagram', title: 'Vizuální návrh' },
  pseudocode: { id: 'pseudocode', label: 'Pseudokód', title: 'Pseudokód' },
  python: { id: 'python', label: 'Python', title: 'Python Kód' }
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  
  handleDownloadLogs = () => {
    const errorStr = this.state.error ? (this.state.error.stack || this.state.error.toString()) : 'Unknown Error';
    const errorInfoStr = this.state.errorInfo && this.state.errorInfo.componentStack ? this.state.errorInfo.componentStack : 'No stack trace';
    
    const crashData = {
        crashTime: new Date().toISOString(),
        userAgent: navigator.userAgent,
        error: errorStr,
        componentStack: errorInfoStr,
        actionLogs: window.__LAST_ACTION_LOGS__ || []
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(crashData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `educode_crash_log_${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-red-50 dark:bg-gray-950 text-red-900 dark:text-red-400 p-6">
          <AlertCircle size={48} className="mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Něco se pokazilo</h1>
          <p className="text-sm mb-6 opacity-80 max-w-md text-center">V aplikaci došlo k neočekávané chybě. Omlouváme se za potíže.</p>
          <div className="flex gap-4">
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">Znovu načíst aplikaci</button>
            <button onClick={this.handleDownloadLogs} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center gap-2">
              <Download size={16} />
              Stáhnout záznam o chybě
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ErrorItem = ({ error }) => {
    const [expanded, setExpanded] = useState(false);
    
    const errorText = typeof error === 'object' && error !== null ? error.message : error;
    const errorPrefix = (typeof error === 'object' && error !== null && error.line) ? `Řádek ${error.line}: ` : '';
    
    const getErrorExplanation = (errText) => {
        if (!errText) return "";
        if (errText.includes("mimo svůj Scope") || errText.includes("před deklarací")) {
            return "Proměnná (např. 'x') musí být vytvořena (např. 'x = 5' nebo 'Vstup x'), než s ní začnete pracovat v podmínce nebo pro výpis. Pokud proměnnou vytvoříte uvnitř větve (např. uvnitř IF), přestane po skončení větve existovat (tzv. Scope). Mimo tento blok už proměnnou nelze použít.";
        }
        if (errText.includes("počáteční blok")) {
            return "Algoritmus musí mít vždy jasně definovaný začátek. Přidejte na plátno fialový blok START a napojte ho na první krok vašeho programu.";
        }
        if (errText.includes("neměla koncový blok")) {
            return "Program by měl být korektně ukončen blokem KONEC, aby bylo jasné, kde končí jeho běh.";
        }
        if (errText.includes("Duplicitní název")) {
            return "Každá funkce nebo třída musí mít unikátní název. Použili jste stejný název vícekrát.";
        }
        if (errText.includes("Očekáváno přiřazení")) {
            return "Napsali jste název proměnné bez =. Pokud se má načíst hodnota, napište např. x = INPUT().";
        }
        return "Zkontrolujte logiku vašeho diagramu a ujistěte se, že všechny bloky jsou správně propojené a dávají smysl.";
    };

    return (
        <li className="flex flex-col gap-1 mb-1">
            <div className="flex justify-between items-start gap-2">
                <span className="flex-1">{errorPrefix}{errorText}</span>
                <Tooltip text="Vysvětlení chyby">
                    <button onClick={() => setExpanded(!expanded)} className="text-red-500 hover:text-red-700 bg-red-100/50 dark:bg-red-800/30 p-1 rounded transition-colors shrink-0">
                        <HelpCircle size={14} />
                    </button>
                </Tooltip>
            </div>
            {expanded && (
                <div className="text-[11px] bg-red-100/80 dark:bg-red-900/50 p-2 rounded text-red-800 dark:text-red-200 mt-1 leading-relaxed">
                    {getErrorExplanation(errorText)}
                </div>
            )}
        </li>
    );
};

const LineNumberedTextarea = ({ value, onChange, readOnly, placeholder, hasErrors, blocks = [], highlightLines = [], runtimeActiveLine = null, onCursorChange, onInteract, onBlur, breakpoints = [], nodeLineMap = {}, onBreakpointToggle, showDebugger }) => {
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
    if (e.type === 'keydown' && e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const spaces = '    ';
      const newValue = value.substring(0, start) + spaces + value.substring(end);
      if (onChange) onChange({ target: { value: newValue } });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + spaces.length;
        }
      }, 0);
      return;
    }

    if (onInteract) onInteract();
    if (onCursorChange) {
      setTimeout(() => {
        if (textareaRef.current) {
          const pos = textareaRef.current.selectionStart;
          const linesUntilCursor = textareaRef.current.value.substring(0, pos).split('\n').length - 1;
          onCursorChange(linesUntilCursor);
        }
      }, 0);
    }
  };

  const handleLineClick = (lineIndex) => {
     if (!showDebugger) return;
     const nodeId = Object.keys(nodeLineMap).find(id => Array.isArray(nodeLineMap[id]) ? nodeLineMap[id].includes(lineIndex) : nodeLineMap[id] === lineIndex);
     if (nodeId && onBreakpointToggle) onBreakpointToggle(nodeId);
  };

  return (
    <div className={`flex-1 flex overflow-hidden bg-white dark:bg-gray-900 relative transition-all duration-300 group ${hasErrors ? 'shadow-[0_0_20px_rgba(239,68,68,0.3)] border border-red-500 rounded-lg m-2' : ''}`}>
      <button onClick={handleCopy} className="absolute top-2 right-[21px] p-2 bg-white/90 dark:bg-gray-800/90 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md shadow-sm border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-20">
        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
      </button>

      <div ref={lineNumbersRef} className="w-12 bg-gray-50 dark:bg-gray-800 text-gray-400 text-right pr-3 py-4 font-mono text-sm overflow-hidden select-none border-r border-gray-200 dark:border-gray-700 z-10">
        {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => {
          const nodeId = Object.keys(nodeLineMap).find(id => Array.isArray(nodeLineMap[id]) ? nodeLineMap[id].includes(i) : nodeLineMap[id] === i);
          const isBp = nodeId && breakpoints.includes(nodeId);
          const hasMapping = !!nodeId && showDebugger;

          return (
             <div key={i} className={`leading-6 relative group ${hasMapping ? 'cursor-pointer hover:text-gray-900 dark:hover:text-gray-100' : ''}`} onClick={() => handleLineClick(i)}>
                {isBp && <div className="absolute left-2 top-2 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.8)]" />}
                {!isBp && hasMapping && <div className="absolute left-2 top-2 w-2 h-2 bg-red-500/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />}
                {i + 1}
             </div>
          );
        })}
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
        onBlur={() => { if(onBlur) onBlur(); }}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    </div>
  );
};

const ToggleSwitch = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between cursor-pointer w-full group py-1.5">
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{label}</span>
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
    </div>
  </label>
);

const CustomSelect = ({ value, options, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative mb-5">
      {label && <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">{label}</label>}
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-full text-sm bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg outline-none px-3 py-2 flex items-center justify-between text-gray-700 dark:text-gray-300 hover:border-indigo-400 transition-colors"
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden border">
            {options.map(opt => (
              <button 
                key={opt.value}
                onClick={(e) => { e.stopPropagation(); onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

function AppContent() {
  const [flow, setFlow] = useState('bidirectional');
  const [panels, setPanels] = useState(['drawio', 'pseudocode']);

  const [diagramXml, setDiagramXml] = useState('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
  const [pseudocode, setPseudocode] = useState('');
  const [pythonCode, setPythonCode] = useState('');

  const [parseErrors, setParseErrors] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [settingsDropdown, setSettingsDropdown] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('educode_theme_pref');
    if (saved !== null) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [dialog, setDialog] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialType, setTutorialType] = useState('drawio');
  const [tutorialFocusedBlock, setTutorialFocusedBlock] = useState(null);
  const [syncTrigger, setSyncTrigger] = useState(0);

  const [edgeStyle, setEdgeStyle] = useState(localStorage.getItem('edgeStyle') || 'true-false');
  const [colorMode, setColorMode] = useState(localStorage.getItem('colorMode') !== 'false');
  const [groupColoring, setGroupColoring] = useState(localStorage.getItem('groupColoring') === 'true');
  const [showDebugger, setShowDebugger] = useState(localStorage.getItem('showDebugger') === 'true');
  const [conditionShape, setConditionShape] = useState(localStorage.getItem('conditionShape') || 'hexagon');
  const [editorMode, setEditorMode] = useState(localStorage.getItem('editorMode') || 'simple');

  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [externalSelectedIds, setExternalSelectedIds] = useState([]);
  const [pseudoNodeLineMap, setPseudoNodeLineMap] = useState({});
  const [pythonNodeLineMap, setPythonNodeLineMap] = useState({});
  const [breakpoints, setBreakpoints] = useState([]);

  // Proměnné debuggeru
  const [isDebuggerActive, setIsDebuggerActive] = useState(false); // OPRAVA: Chybějící deklarace
  const [runner, setRunner] = useState(null);
  const runnerRef = useRef(null); 
  const [runtimeActiveNodeId, setRuntimeActiveNodeId] = useState(null);
  const [runtimeVars, setRuntimeVars] = useState({});
  const [, setRuntimeOutput] = useState([]);
  const [runtimeEvents, setRuntimeEvents] = useState([]);
  
  const [debugSpeedPercent, setDebugSpeedPercent] = useState(100);
  const [showWatcherInfo, setShowWatcherInfo] = useState(false);
  const [inputRequest, setInputRequest] = useState(null);
  
  const [isPlayingState, setIsPlayingState] = useState(false);
  const isPlayingRef = useRef(false);
  const playTimeoutRef = useRef(null);
  const breakpointsRef = useRef(breakpoints);
  const debugSpeedRef = useRef(800);

  const activeWindow = useRef('drawio'); 
  const lastEdited = useRef('drawio'); 

  // --- Záznamník akcí (Testing) ---
  const [actionLogs, setActionLogs] = useState([]);
  const lastLogRef = useRef({ time: 0, type: '' });
  const currentStateRef = useRef({ panels: [], diagramXml: '', pseudocode: '', pythonCode: '' });
  
  const isExperimental = window.location.pathname.includes('/experimental');
  const appVersion = isExperimental ? 'experimental' : 'safe';
  
  useEffect(() => {
      currentStateRef.current = { panels, diagramXml, pseudocode, pythonCode };
  }, [panels, diagramXml, pseudocode, pythonCode]);

  const logAction = useCallback((actionType, details = {}) => {
      const now = Date.now();
      if (lastLogRef.current.type === actionType && (now - lastLogRef.current.time) < 50) return;
      lastLogRef.current = { time: now, type: actionType };
      
      const fullDetails = {
          ...details,
          appVersion,
          appState: currentStateRef.current
      };
      setActionLogs(prev => {
          const newLogs = [...prev, { time: new Date().toISOString(), type: actionType, details: fullDetails }];
          window.__LAST_ACTION_LOGS__ = newLogs;
          return newLogs;
      });
  }, [appVersion]);

  const downloadLogs = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(actionLogs, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `educode_debug_log_${new Date().getTime()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  // MCP WebSocket Bridge for Dev Mode
  // Currently disabled to prevent console connection errors since the external bridge server (port 8080) is not running.
  // Uncomment and configure port if you need the AI to read the live diagram state.
  /*
  useEffect(() => {
    if (import.meta.env && import.meta.env.DEV) {
      let ws;
      let reconnectTimer;
      
      const connect = () => {
        ws = new WebSocket('ws://localhost:8080');
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'GET_STATE') {
              const payload = {
                xml: diagramXml,
                pseudocode: pseudocode,
                pythonCode: pythonCode,
                panels: panels,
                isDebuggerActive: isDebuggerActive,
                isPlaying: isPlayingState
              };
              ws.send(JSON.stringify({ type: 'STATE_RESPONSE', payload }));
            }
          } catch (err) {}
        };
        
        ws.onclose = () => {
            reconnectTimer = setTimeout(connect, 3000);
        };
        
        ws.onerror = () => {};
      };
      
      connect();
      
      return () => {
        if (ws) ws.close();
        clearTimeout(reconnectTimer);
      };
    }
  }, []);
  */

  useEffect(() => { breakpointsRef.current = breakpoints; }, [breakpoints]);
  


  useEffect(() => {
      const handleClickOutside = (e) => {
          if (e.target.closest('.speed-adjuster-panel') ||
              e.target.closest('.dropdown-container') ||
              e.target.closest('.interactive-popup') ||
              e.target.closest('.watcher-panel') ||
              e.target.closest('.settings-panel')) {
              return;
          }
          setShowWatcherInfo(false);
          setActiveDropdown(null);
          setSettingsDropdown(null);
      };
      
      window.addEventListener('pointerdown', handleClickOutside);
      return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  useEffect(() => {
    const seen = localStorage.getItem('eduCodeTutorialSeen');
    if (!seen) {
      setShowTutorial(true);
      localStorage.setItem('eduCodeTutorialSeen', 'true');
    }
    logAction('SESSION_START');
  }, [logAction]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('educode_theme_pref', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Dark Reader Extension detection and defeat
  useEffect(() => {
    const disableDarkReader = () => {
      const darkReaderStyles = document.querySelectorAll('style.darkreader, style[class*="darkreader"]');
      const htmlHasDarkReader = document.documentElement.hasAttribute('data-darkreader-mode');
      
      if (darkReaderStyles.length > 0 || htmlHasDarkReader) {
        setIsDarkMode(true);
        darkReaderStyles.forEach(style => style.remove());
        document.documentElement.removeAttribute('data-darkreader-mode');
        document.documentElement.removeAttribute('data-darkreader-scheme');
      }
    };

    disableDarkReader();

    const observer = new MutationObserver((mutations) => {
      let found = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'STYLE' && node.className && typeof node.className === 'string' && node.className.includes('darkreader')) {
            found = true;
          }
        });
      });
      if (found) disableDarkReader();
    });

    observer.observe(document.head, { childList: true, subtree: true });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-darkreader-mode', 'data-darkreader-scheme'] });

    return () => observer.disconnect();
  }, []);

  const setIsPlaying = useCallback((val) => {
    setIsPlayingState(val);
    isPlayingRef.current = val;
  }, []);

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

  const handlePseudoCursorChange = (lineIdx) => {
    if (lineIdx === null) {
      setExternalSelectedIds([]);
      return;
    }
    const nodeId = Object.keys(pseudoNodeLineMap).find(id => pseudoNodeLineMap[id] === lineIdx);
    if (nodeId) setExternalSelectedIds([nodeId]);
    else setExternalSelectedIds([]);
  };

  const handlePythonCursorChange = (lineIdx) => {
    if (lineIdx === null) {
      setExternalSelectedIds([]);
      return;
    }
    const nodeId = Object.keys(pythonNodeLineMap).find(id => pythonNodeLineMap[id] === lineIdx);
    if (nodeId) setExternalSelectedIds([nodeId]);
    else setExternalSelectedIds([]);
  };

  const toggleBreakpoint = useCallback((id) => {
      setBreakpoints(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  }, []);

  // =========================================================================================
  // CRITICAL WARNING: SYNC STATE ENGINE
  // =========================================================================================
  // The following sync effects (SYNC 1, SYNC 2, SYNC 3) manage the bidirectional state of the app.
  // DO NOT REMOVE, SIMPLIFY, OR "CLEAN UP" THE PANEL INCLUDES CHECKS OR THE LAST-EDITED CHECKS.
  // If the `panels.includes(...)` checks are removed, the app will instantly wipe the diagram
  // with empty text when entering code-to-diagram mode.
  // Modifying `lastEdited.current` here will cause race conditions where passive incoming
  // XML updates steal the user's focus and delete incomplete code input.
  // DO NOT MODIFY THIS LOGIC WITHOUT A THOROUGH UNDERSTANDING OF THE BIDIRECTIONAL SYNC.
  // =========================================================================================

  const latestDiagramXmlRef = useRef(diagramXml);
  useEffect(() => {
    latestDiagramXmlRef.current = diagramXml;
  }, [diagramXml]);

  // SYNC 1: Diagram -> Pseudocode
  useEffect(() => {
    if (!panels.includes('pseudocode')) return;
    if (flow === 'code-to-diagram') return;
    if (flow === 'bidirectional' && lastEdited.current === 'pseudocode') return;

    const timeoutId = setTimeout(() => {
      try {
        const result = parseDrawioToPseudocode(diagramXml);
        setPseudocode(prev => {
            if (prev !== result?.code) {
                logAction('SYNC_DRAWIO_TO_PSEUDOCODE');
                return result?.code || '';
            }
            return prev;
        });
        setParseErrors(result?.errors || []);
        setPseudoNodeLineMap(result?.nodeLineMap || {});
      } catch (err) {
        setParseErrors([err.message]);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [diagramXml, flow, logAction, syncTrigger, panels]);

  // SYNC 2: Pseudocode -> Diagram
  useEffect(() => {
    if (!panels.includes('pseudocode')) return;
    if (flow === 'diagram-to-code') return;
    if (flow === 'bidirectional' && lastEdited.current !== 'pseudocode') return;
    if (flow === 'code-to-diagram' && panels.includes('python') && lastEdited.current === 'python') return; // let python win if it was last edited

    const defaultDiagram = `<mxGraphModel dx="871" dy="541" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
  </root>
</mxGraphModel>`;

    const timeoutId = setTimeout(() => {
      try {
        if (!pseudocode || pseudocode.trim() === '') {
            setDiagramXml('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
            setParseErrors([]);
            return;
        }

        const { xml: generatedXml, errors: genErrors } = parsePseudocodeToDrawio(pseudocode, latestDiagramXmlRef.current, edgeStyle, conditionShape, editorMode);
        
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

        setDiagramXml(prev => {
            if (prev !== finalXml) {
                logAction('SYNC_PSEUDOCODE_TO_DRAWIO');
                return finalXml;
            }
            return prev;
        });
        setParseErrors(genErrors || []);
      } catch (err) {
        setParseErrors([err.message]);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [pseudocode, editorMode, flow, edgeStyle, conditionShape, logAction, syncTrigger, panels]);

  // SYNC 3: Python -> Diagram
  useEffect(() => {
    if (!panels.includes('python')) return;
    if (flow === 'diagram-to-code') return;
    if (flow === 'bidirectional' && lastEdited.current !== 'python') return;
    if (flow === 'code-to-diagram' && panels.includes('pseudocode') && lastEdited.current !== 'python') return; // let pseudocode win unless python was explicitly last edited

    const timeoutId = setTimeout(() => {
      try {
        if (!pythonCode || pythonCode.trim() === '') {
            setDiagramXml('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
            setParseErrors([]);
            return;
        }
        
        const intermediatePseudocode = parsePythonToPseudocode(pythonCode);
        const { xml: generatedXml, errors: genErrors } = parsePseudocodeToDrawio(intermediatePseudocode, latestDiagramXmlRef.current, edgeStyle, conditionShape, editorMode);

        setDiagramXml(prev => {
            if (prev !== generatedXml) {
                logAction('SYNC_PYTHON_TO_DRAWIO');
                return generatedXml;
            }
            return prev;
        });
        setParseErrors(genErrors || []);
      } catch (err) {
        setParseErrors([err.message]);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [pythonCode, editorMode, flow, edgeStyle, conditionShape, logAction, syncTrigger, panels]);

  useEffect(() => {
    if (panels.includes('python')) {
      if (flow === 'code-to-diagram') return;
      if (flow === 'bidirectional' && lastEdited.current === 'python') return;

      const timeoutId = setTimeout(() => {
        try {
          const result = parseDrawioToPython(diagramXml);
          setPythonCode(result?.code || '');
          setPythonNodeLineMap(result?.nodeLineMap || {});
        } catch {
            // Ignore error
        }
      }, 400);
      return () => clearTimeout(timeoutId);
    }
  }, [diagramXml, panels, flow, syncTrigger]);

  // =========================================================================================
  // CRITICAL WARNING: PRIORITIZING NON-EMPTY STATE
  // DO NOT REMOVE THIS LOGIC. If a user switches to bidirectional mode, the source of truth
  // must shift to a panel that actually has data, otherwise existing work will be wiped.
  // =========================================================================================
  const requestFlowChange = (e) => {
    e.stopPropagation();
    const nextFlow = flow === 'bidirectional' ? 'diagram-to-code' : flow === 'diagram-to-code' ? 'code-to-diagram' : 'bidirectional';
    
    if (nextFlow === 'bidirectional') {
        const isDrawioEmpty = !diagramXml || diagramXml.includes('<mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
        const isPseudoEmpty = !pseudocode || pseudocode.trim() === '';
        const isPythonEmpty = !pythonCode || pythonCode.trim() === '';

        if (lastEdited.current === 'pseudocode' && isPseudoEmpty && !isDrawioEmpty) {
            lastEdited.current = 'drawio';
        } else if (lastEdited.current === 'python' && isPythonEmpty && !isDrawioEmpty) {
            lastEdited.current = 'drawio';
        } else if (lastEdited.current === 'drawio' && isDrawioEmpty) {
            if (panels.includes('pseudocode') && !isPseudoEmpty) {
                lastEdited.current = 'pseudocode';
            } else if (panels.includes('python') && !isPythonEmpty) {
                lastEdited.current = 'python';
            }
        }
    }
    
    setFlow(nextFlow);
    logAction('FLOW_DIRECTION_CHANGED', { flow: nextFlow });
  };

  const startDebugger = useCallback(() => {
      const { nodes, edges } = drawioToReactFlow(diagramXml);
      const newRunner = new DiagramRunner(nodes, edges);
      setRunner(newRunner);
      runnerRef.current = newRunner;
      setRuntimeVars({});
      setRuntimeOutput([]);
      setRuntimeEvents([]);
      setRuntimeActiveNodeId(null);
      
      setRuntimeActiveNodeId(newRunner.currentNodeId);
      setIsPlaying(false);
      setIsDebuggerActive(true);
      logAction('DEBUGGER_STARTED');
      return newRunner;
  }, [diagramXml, setIsPlaying, logAction]);

  const stopDebugger = useCallback((clearData = true) => {
      setIsPlaying(false);
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      setRunner(null);
      runnerRef.current = null;
      setRuntimeActiveNodeId(null);
      setInputRequest(null);
      setIsDebuggerActive(false);
      if (clearData) {
          setRuntimeVars({});
          setRuntimeOutput([]);
          setRuntimeEvents([]);
      }
      logAction('DEBUGGER_STOPPED');
  }, [setIsPlaying, logAction]);

  const doStep = useCallback((isManualStep = false, inputValue = undefined) => {
      let currentRunner = runnerRef.current;
      if (!currentRunner) { 
          currentRunner = startDebugger(); 
          if (!currentRunner) return; 
      }
      
      const res = currentRunner.step(inputValue);

      if (res.requiresInput) {
          const wasPlaying = isPlayingRef.current;
          setIsPlaying(false);
          setInputRequest({ message: `Zadejte hodnotu proměnné: ${res.variableName || '?'}`, wasPlaying });
          runnerRef.current = currentRunner;
          return; 
      }

      setRuntimeVars({ ...res.variables });
      setRuntimeOutput([...res.output]);
      setRuntimeEvents([...(res.events || [])]);

      if (res.finished) {
          stopDebugger(false);
      } else {
          setRuntimeActiveNodeId(res.nextNodeId); 
      }
      
      if (!res.finished) {
          runnerRef.current = currentRunner;
      }
  }, [startDebugger, setIsPlaying, stopDebugger]);

  const executeAutoPlay = useCallback(function play(skipBreakpointCheckForCurrent = false) {
      if (!isPlayingRef.current) return;
      
      const currentRunner = runnerRef.current;
      if (!skipBreakpointCheckForCurrent && currentRunner && breakpointsRef.current.includes(currentRunner.currentNodeId)) {
          setIsPlaying(false);
          return;
      }

      doStep(false);
      if (isPlayingRef.current) {
          playTimeoutRef.current = setTimeout(() => play(false), debugSpeedRef.current);
      }
  }, [doStep, setIsPlaying]);

  useEffect(() => {
      debugSpeedRef.current = debugSpeedPercent === 0 ? 3000 : Math.max(50, 800 * (100 / debugSpeedPercent));
      if (isPlayingRef.current && !inputRequest) {
          if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
          playTimeoutRef.current = setTimeout(() => executeAutoPlay(false), debugSpeedRef.current);
      }
  }, [debugSpeedPercent, executeAutoPlay, inputRequest]);

  const togglePlay = useCallback(() => {
      const isNew = !runnerRef.current;
      if (isNew) startDebugger();
      if (isPlayingRef.current) {
          setIsPlaying(false);
          if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      } else {
          setIsPlaying(true);
          playTimeoutRef.current = setTimeout(() => executeAutoPlay(!isNew), debugSpeedRef.current);
      }
  }, [startDebugger, executeAutoPlay, setIsPlaying]);

  const handleInputSubmit = (val) => {
      const resumePlay = inputRequest.wasPlaying;
      setInputRequest(null);
      doStep(!resumePlay, val);
      
      if (resumePlay && runnerRef.current && !runnerRef.current.isFinished) {
          setIsPlaying(true);
          playTimeoutRef.current = setTimeout(() => executeAutoPlay(false), debugSpeedRef.current);
      }
  };

  const handleInputCancel = () => {
      setInputRequest(null);
      stopDebugger(true);
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
        <div className="flex-1 flex flex-col relative w-full h-full">
          <DiagramEditor
            editorMode={editorMode}
            xml={diagramXml}
            isDarkMode={isDarkMode}
            edgeStyle={edgeStyle}
            colorMode={colorMode}
            groupColoring={groupColoring}
            showDebugger={showDebugger}
            conditionShape={conditionShape}
            onSelectionChange={handleSelectionChange}
            externalSelectedIds={isDebuggerActive && runtimeActiveNodeId ? [runtimeActiveNodeId] : externalSelectedIds}
            activeRuntimeNodeId={runtimeActiveNodeId}
            breakpoints={showDebugger ? breakpoints : []}
            onBreakpointToggle={toggleBreakpoint}
            onInteract={() => { 
                activeWindow.current = 'drawio'; 
                lastEdited.current = 'drawio'; 
                setActiveDropdown(null);
                setSettingsDropdown(null);
            }}
            onPaneClick={() => { 
                setActiveDropdown(null);
                setSettingsDropdown(null);
            }}
            onLogAction={logAction}
            onXmlChange={(xml, isUserInteraction) => { 
                if (isUserInteraction) lastEdited.current = 'drawio'; 
                setDiagramXml(xml); 
            }}
            onImportXml={(xml) => { activeWindow.current = 'drawio'; lastEdited.current = 'drawio'; setDiagramXml(xml); logAction('XML_IMPORTED'); }}
            readOnly={flow === 'code-to-diagram' || isPlayingState || runner !== null || inputRequest !== null}
            onRequestTutorial={(blockType) => {
                setTutorialType('drawio');
                setTutorialFocusedBlock(blockType);
                setShowTutorial(true);
            }}
          />
          
          {inputRequest && (
              <div className="absolute inset-0 z-[200] flex items-center justify-center bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
                      <h2 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">Vyžadován vstup</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{inputRequest.message}</p>
                      <input 
                          type="text" 
                          autoFocus
                          className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 mb-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') handleInputSubmit(e.target.value);
                              if (e.key === 'Escape') handleInputCancel();
                          }}
                          id="debug-input-field"
                      />
                      <div className="flex justify-end gap-2">
                          <button onClick={handleInputCancel} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 transition-colors">Zrušit běh</button>
                          <button onClick={() => handleInputSubmit(document.getElementById('debug-input-field').value)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition-colors">Potvrdit</button>
                      </div>
                  </div>
              </div>
          )}

          {showDebugger && (
            <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden flex flex-col justify-between p-4">
                <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                
                <div className="absolute top-20 left-4 pointer-events-auto">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 dark:border-gray-700 w-64 flex flex-col">
                       <div className="flex justify-between items-center px-1 pb-2 mb-2 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-2 relative">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Paměť (Variables)</span>
                              <div className="relative flex items-center">
                                  <Tooltip text="Nápověda pro Paměť (Variables)">
                                      <button onClick={(e) => { e.stopPropagation(); setShowWatcherInfo(!showWatcherInfo); }} className="text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full p-1 transition-colors flex items-center justify-center">
                                          <HelpCircle size={12} />
                                      </button>
                                  </Tooltip>
                                  {showWatcherInfo && (
                                      <div className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 w-64 z-[9999] text-xs text-gray-700 dark:text-gray-300 font-normal normal-case cursor-default" onClick={e => e.stopPropagation()}>
                                          <p className="mb-2 text-sm text-gray-800 dark:text-gray-100 font-semibold border-b border-gray-100 dark:border-gray-700 pb-2">Paměť (Variables)</p>
                                          <p className="mb-3 text-gray-600 dark:text-gray-400">Zobrazuje aktuální stav proměnných během krokování kódu.</p>
                                          <p className="text-[10px] text-gray-500">Změny uvidíte okamžitě, jakmile proběhne operace jako <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200 font-mono">x = 1</code>.</p>
                                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 border-t border-l border-gray-200 dark:border-gray-700 transform rotate-45"></div>
                                      </div>
                                  )}
                              </div>
                          </div>
                          <span className={`w-2 h-2 rounded-full ${runner && !runner.isFinished ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                       </div>
                       <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto no-scrollbar px-1">
                          {Object.keys(runtimeVars).length === 0 ? (
                              <div className="text-xs text-gray-400 italic text-center py-2">Zatím prázdné</div>
                          ) : (
                              Object.keys(runtimeVars).map(k => {
                                  const val = runtimeVars[k];
                                  let vType = 'Any';
                                  if (Array.isArray(val)) vType = 'Array';
                                  else if (typeof val === 'number') vType = Number.isInteger(val) ? 'Int' : 'Float';
                                  else if (typeof val === 'boolean') vType = 'Bool';
                                  else if (typeof val === 'string') vType = 'String';

                                  return (
                                     <div key={k} className="grid grid-cols-[1fr_auto_1fr] items-center text-sm font-mono hover:bg-gray-50 dark:hover:bg-gray-700/50 px-2 py-0.5 rounded transition-colors gap-2">
                                         <span className="text-gray-700 dark:text-gray-300 flex items-baseline gap-1.5 truncate">
                                             {k}
                                             <span className="text-[10px] text-gray-400 dark:text-gray-500 italic font-normal tracking-wide shrink-0">
                                                 {vType}
                                             </span>
                                         </span>
                                         <span className="text-gray-400 dark:text-gray-500 font-light select-none text-xs text-center px-1">=</span>
                                         <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate text-right" title={val}>
                                             {typeof val === 'boolean' ? (val ? 'True' : 'False') : val}
                                         </span>
                                     </div>
                                   );
                              })
                          )}
                       </div>
                    </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4 flex items-end pointer-events-none gap-4">
                    <div className="flex-1 hidden md:block" />
                    
                    <div className="flex gap-2 items-end pointer-events-auto relative">
                       <div className="flex gap-2 items-center pointer-events-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow p-1.5 mx-auto">
                        <div className="flex gap-1">

                            <Tooltip text="Krokovat vpřed (ignoruje zarážky)">
                                <button onClick={() => doStep(true)} disabled={isPlayingState || (runner && runner.isFinished)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 disabled:opacity-30 transition-all" aria-label="Krokovat vpřed (ignoruje zarážky)"><StepForward size={18} /></button>
                            </Tooltip>
                            <Tooltip text={isPlayingState ? "Pozastavit běh" : "Spustit automaticky (zastaví na zarážkách)"}>
                                <button onClick={togglePlay} disabled={runner && runner.isFinished} className={`p-2 rounded transition-all ${isPlayingState ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50' : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50'}`} aria-label={isPlayingState ? "Pozastavit běh" : "Spustit automaticky (zastaví na zarážkách)"}>
                                    {isPlayingState ? <Pause size={18} /> : <Play size={18} />}
                                </button>
                            </Tooltip>
                            <Tooltip text="Ukončit debugger a vymazat data">
                                <button onClick={() => stopDebugger(true)} disabled={!runner} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500 dark:text-red-400 disabled:opacity-30 transition-all" aria-label="Ukončit debugger a vymazat data"><StopSquare size={18} /></button>
                            </Tooltip>
                        </div>
                       </div>
                    </div>

                    <div className="flex-1 pointer-events-none flex justify-end">
                        <div className="w-64 pointer-events-auto flex justify-end">
                            <DebuggerConsole 
                                 events={runtimeEvents}
                            />
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>
      );
    }

    if (type === 'python') {
      const blocksToHighlightPython = [];
      const linesPython = pythonCode.split('\n');
      let currentBlockPython = null;

      linesPython.forEach((line, index) => {
        const match = line.match(/^\s*(?:def|class)\s+([a-zA-Z0-9_]+)/i);
        if (match) {
          if (currentBlockPython) currentBlockPython.endLine = index - 1; 
          currentBlockPython = { name: match[1], startLine: index, endLine: index };
          blocksToHighlightPython.push(currentBlockPython);
        } else if (currentBlockPython) {
          currentBlockPython.endLine = index;
        }
      });

      return (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-gray-900">
          <LineNumberedTextarea 
            value={pythonCode} 
            onChange={(e) => { lastEdited.current = 'python'; activeWindow.current = 'python'; setPythonCode(e.target.value); }}
            onInteract={() => { activeWindow.current = 'python'; lastEdited.current = 'python'; }}
            onBlur={() => handlePythonCursorChange(null)}
            onCursorChange={handlePythonCursorChange}
            showDebugger={showDebugger}
            breakpoints={showDebugger ? breakpoints : []}
            nodeLineMap={pythonNodeLineMap}
            onBreakpointToggle={toggleBreakpoint}
            readOnly={flow === 'diagram-to-code' || isPlayingState || inputRequest !== null} 
            placeholder={`// Zde bude ${PANEL_TYPES[type].label}...`} 
            blocks={blocksToHighlightPython}
            runtimeActiveLine={isDebuggerActive && runtimeActiveNodeId !== null ? pythonNodeLineMap[runtimeActiveNodeId] : null}
            highlightLines={!isDebuggerActive ? selectedNodeIds.flatMap(id => {
              const val = pythonNodeLineMap[id];
              return Array.isArray(val) ? val : (val !== undefined && val !== null ? [val] : []);
            }) : []}
          />
        </div>
      );
    }

    if (type === 'pseudocode') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-gray-900">
          {parseErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-500 p-3 z-10">
              <h2 className="text-red-700 dark:text-red-400 font-bold text-sm flex items-center gap-2 mb-2"><AlertCircle size={16} /> Upozornění</h2>
              <ul className="text-xs text-red-600 dark:text-red-300 list-inside">
                {parseErrors.map((e, i) => <ErrorItem key={i} error={e} />)}
              </ul>
            </div>
          )}

          <LineNumberedTextarea
            value={pseudocode}
            onChange={(e) => { lastEdited.current = 'pseudocode'; activeWindow.current = 'pseudocode'; setPseudocode(e.target.value); }}
            onInteract={() => { activeWindow.current = 'pseudocode'; lastEdited.current = 'pseudocode'; }}
            onBlur={() => handlePseudoCursorChange(null)}
            onCursorChange={handlePseudoCursorChange}
            showDebugger={showDebugger}
            breakpoints={showDebugger ? breakpoints : []}
            nodeLineMap={pseudoNodeLineMap}
            onBreakpointToggle={toggleBreakpoint}
            readOnly={flow === 'diagram-to-code' || isPlayingState || inputRequest !== null}
            placeholder={`// Zde bude ${PANEL_TYPES[type].label}...`}
            blocks={blocksToHighlight}
            runtimeActiveLine={isDebuggerActive && runtimeActiveNodeId !== null ? pseudoNodeLineMap[runtimeActiveNodeId] : null}
            highlightLines={!isDebuggerActive ? selectedNodeIds.flatMap(id => {
              const val = pseudoNodeLineMap[id];
              return Array.isArray(val) ? val : (val !== undefined && val !== null ? [val] : []);
            }) : []}
          />
        </div>
      );
    }
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-950 flex flex-col font-sans overflow-hidden transition-colors">
      {/* Zpráva o nepodporovaném zobrazení na malých displejích */}
      <div className="flex md:hidden fixed inset-0 bg-gray-900 text-white z-[9999] flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Nepodporované zařízení</h2>
        <p className="text-gray-400">EduCode vyžaduje větší obrazovku. Otevřete prosím aplikaci na tabletu nebo počítači.</p>
      </div>

      <div className="hidden md:flex flex-col h-full overflow-hidden w-full">
      {showTutorial && <TutorialDialog type={tutorialType} focusedBlock={tutorialFocusedBlock} onClose={() => { setShowTutorial(false); setTutorialFocusedBlock(null); }} />}
      {dialog && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{dialog.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">{dialog.desc}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDialog(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors text-sm font-semibold">Zrušit (Esc)</button>
              <button onClick={dialog.onConfirm} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors text-sm font-semibold">{dialog.confirmText || 'Smazat (Enter)'}</button>
            </div>
          </div>
        </div>
      )}
      
      {/* BETA BANNERS & HEADER */}
      <div className="bg-purple-600 dark:bg-purple-800 text-white px-4 py-1.5 text-[11px] flex justify-between items-center z-30 shadow-md">
         <div className="flex items-center gap-2">
            <Bug size={14} />
            <span className="font-bold tracking-wide">TESTING REŽIM</span>
            <span className="hidden sm:inline border-l border-purple-400/50 pl-2 ml-1 text-purple-200">
                Našli jste chybu? Stáhněte si log akcí z tohoto sezení a pošlete nám ho.
            </span>
         </div>
         <button onClick={downloadLogs} className="bg-purple-800 dark:bg-purple-950 hover:bg-purple-900 text-purple-100 px-3 py-1 rounded shadow-sm border border-purple-500/30 transition-colors font-semibold flex items-center gap-1">
             Stáhnout log akcí ({actionLogs.length})
         </button>
      </div>

      <header className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-800 px-4 lg:px-6 py-2 lg:py-3 flex justify-between items-center shrink-0 shadow-sm z-30">
        <div className="flex items-baseline gap-2 lg:gap-3">
          <h1 className="text-lg lg:text-xl font-bold text-gray-800 dark:text-gray-100">EduCode</h1>
          <span className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 inline-block">
            {panels.map(p => PANEL_TYPES[p].label).join(' ⇄ ')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href={isExperimental ? '/EduCode/safe/' : '/EduCode/experimental/'} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors shadow-sm ${isExperimental ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300/50 hover:bg-amber-200' : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-300/50 hover:bg-green-200'}`}>
            {isExperimental ? 'Experimental' : 'Safe Mode'}
          </a>
          <button onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors" aria-label={isDarkMode ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}>{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-2 lg:p-4 gap-2 lg:gap-4" style={{ overflow: 'hidden' }}>
        {panels.map((type, index) => (
          <React.Fragment key={type}>
            <div 
              className={`flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 relative transition-all ${activeDropdown === index || settingsDropdown === index ? 'z-50 overflow-visible' : 'z-10 overflow-hidden'}`}
              onPointerDownCapture={() => { if (type === 'drawio' || type === 'pseudocode') lastEdited.current = type; }}
              onKeyDownCapture={() => { if (type === 'drawio' || type === 'pseudocode') lastEdited.current = type; }}
            >
              <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-semibold text-gray-700 dark:text-gray-300 flex justify-between items-center relative z-50">
                <div className="flex items-center gap-2">
                  <span>{PANEL_TYPES[type].title}</span>
                  <Tooltip text={`Nápověda pro ${PANEL_TYPES[type].title}`} position="bottom">
                    <button onClick={(e) => { e.stopPropagation(); setTutorialType(type); setShowTutorial(true); }} className="text-indigo-500 hover:text-indigo-600 transition-colors bg-indigo-50 dark:bg-indigo-900/30 rounded-full p-1 ml-1">
                      <HelpCircle size={16} />
                    </button>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  
                  {type === 'drawio' && (
                    <div className="relative mr-1 settings-panel">
                      <Tooltip text="Nastavení diagramu" position="bottom">
                        <button onClick={(e) => { e.stopPropagation(); setSettingsDropdown(settingsDropdown === index ? null : index); setActiveDropdown(null); }} className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 transition-colors">
                          <Settings size={16} />
                        </button>
                      </Tooltip>
                      {settingsDropdown === index && (
                        <div className="absolute right-0 top-full mt-3 w-64 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-xl z-50 p-4" onClick={e => e.stopPropagation()}>
                          
                          <CustomSelect 
                            label="Pravda / Nepravda alias"
                            value={edgeStyle}
                            onChange={(val) => { setEdgeStyle(val); localStorage.setItem('edgeStyle', val); logAction('SETTINGS_CHANGED', { edgeStyle: val }); }}
                            options={[
                              {value: 'true-false', label: 'True / False'},
                              {value: 'ano-ne', label: 'Ano / Ne'},
                              {value: 'yes-no', label: 'Yes / No'},
                              {value: '+-', label: '+ / -'}
                            ]}
                          />

                          <CustomSelect 
                            label="Tvar podmínky"
                            value={conditionShape}
                            onChange={(val) => { setConditionShape(val); localStorage.setItem('conditionShape', val); logAction('SETTINGS_CHANGED', { conditionShape: val }); }}
                            options={[
                              {value: 'hexagon', label: 'Šestiúhelník'},
                              {value: 'diamond', label: 'Kosočtverec'}
                            ]}
                          />

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Režim editoru</label>
                            <div className="flex bg-gray-100/80 dark:bg-gray-900/80 rounded-lg p-1 mb-4">
                                <button onClick={() => { setEditorMode('simple'); localStorage.setItem('editorMode', 'simple'); logAction('SETTINGS_CHANGED', { editorMode: 'simple' }); }} className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${editorMode === 'simple' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Začátečník</button>
                                <button onClick={() => { setEditorMode('advanced'); localStorage.setItem('editorMode', 'advanced'); logAction('SETTINGS_CHANGED', { editorMode: 'advanced' }); }} className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${editorMode === 'advanced' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Pokročilý</button>
                            </div>
                            
                            <ToggleSwitch checked={colorMode} onChange={e => { setColorMode(e.target.checked); localStorage.setItem('colorMode', e.target.checked); logAction('SETTINGS_CHANGED', { colorMode: e.target.checked }); }} label="Barevné bloky" />
                            <ToggleSwitch checked={groupColoring} onChange={e => { setGroupColoring(e.target.checked); localStorage.setItem('groupColoring', e.target.checked); logAction('SETTINGS_CHANGED', { groupColoring: e.target.checked }); }} label="Zbarvení skupin" />
                            <ToggleSwitch checked={showDebugger} onChange={e => { 
                                const checked = e.target.checked;
                                setShowDebugger(checked); 
                                localStorage.setItem('showDebugger', checked); 
                                logAction('SETTINGS_CHANGED', { showDebugger: checked });
                                if(!checked) stopDebugger(); 
                            }} label="Debugger (Watch list)" />

                            {showDebugger && (
                                <>
                                    <hr className="my-3 border-gray-200 dark:border-gray-700" />
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 block">Možnosti Debuggeru</label>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-bold text-gray-700 dark:text-gray-100 uppercase tracking-wider mb-2 flex justify-between">
                                            Rychlost <span>{debugSpeedPercent}%</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="500" 
                                            step="10" 
                                            value={debugSpeedPercent} 
                                            onChange={(e) => setDebugSpeedPercent(Number(e.target.value))} 
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="speed-slider w-full h-2 rounded-lg cursor-pointer nodrag touch-action-none mb-1"
                                            style={{
                                                background: `linear-gradient(to right, #4f46e5 ${(debugSpeedPercent / 500) * 100}%, ${isDarkMode ? '#374151' : '#e5e7eb'} ${(debugSpeedPercent / 500) * 100}%)`
                                            }}
                                        />
                                    </div>
                                </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="relative ml-1 dropdown-container">
                    <Tooltip text="Změnit okno" position="bottom"><button onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === index ? null : index); setSettingsDropdown(null); }} className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 transition-colors">
                      <ChevronDown size={16} />
                    </button></Tooltip>
                    {activeDropdown === index && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 py-1 overflow-visible">
                        {Object.values(PANEL_TYPES).map(t => {
                          const isCurrent = panels[index] === t.id;
                          const isUsed = panels.includes(t.id) && !isCurrent;
                          return (
                            <Tooltip key={t.id} text={isUsed ? 'Prohodit okna' : ''} position="left" fullWidth>
                              <button onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (isCurrent) {
                                      setActiveDropdown(null);
                                      return;
                                  }
                                  const newPanels = [...panels]; 
                                  if (isUsed) {
                                      const oldIndex = panels.indexOf(t.id);
                                      newPanels[oldIndex] = panels[index];
                                      newPanels[index] = t.id;
                                  } else {
                                      newPanels[index] = t.id; 
                                  }
                                  setPanels(newPanels); 
                                  setActiveDropdown(null); 
                                  
                                  if (t.id === 'python' && (!pythonCode || pythonCode.trim() === '')) {
                                      const result = parseDrawioToPython(diagramXml);
                                      setPythonCode(result?.code || '');
                                      setPythonNodeLineMap(result?.nodeLineMap || {});
                                  } else if (t.id === 'pseudocode' && (!pseudocode || pseudocode.trim() === '')) {
                                      const result = parseDrawioToPseudocode(diagramXml);
                                      setPseudocode(result?.code || '');
                                      setPseudoNodeLineMap(result?.nodeLineMap || {});
                                  }

                                  if (t.id === 'python' || t.id === 'pseudocode') {
                                      lastEdited.current = t.id;
                                      activeWindow.current = t.id;
                                  } else if (t.id === 'drawio') {
                                      const otherPanel = newPanels.find(p => p !== 'drawio');
                                      if (otherPanel) {
                                          lastEdited.current = otherPanel;
                                          activeWindow.current = otherPanel;
                                      } else {
                                          lastEdited.current = 'drawio';
                                          activeWindow.current = 'drawio';
                                      }
                                  }
                                  setSyncTrigger(s => s + 1);
                                  setSelectedNodeIds([]);
                                  setExternalSelectedIds([]);
                                  logAction('PANEL_CHANGED', { to: t.id, swapped: isUsed }); 
                              }} className={`w-full px-4 py-2 text-sm flex justify-between items-center transition-colors ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                <span>{t.label}</span>
                                {isCurrent && <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>}
                                {isUsed && <RefreshCcw size={14} className="opacity-70" />}
                              </button>
                            </Tooltip>
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
              <div 
                className="flex-1 flex flex-col relative w-full h-full overflow-hidden" 
                onPointerDownCapture={() => { 
                  setActiveDropdown(null); 
                  setSettingsDropdown(null); 
                }}
              >
                {renderPanelContent(type)}
              </div>
            </div>

            {index === 0 && panels.length === 2 && (
              <div className="w-full lg:w-12 flex justify-center lg:flex-col items-center shrink-0 py-2 lg:py-0">
                <Tooltip text="Změnit směr synchronizace" position="bottom">
                  <button onClick={requestFlowChange} className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm text-gray-600 dark:text-gray-300 transition-colors mx-auto">
                    {flow === 'bidirectional' ? <ArrowRightLeft size={18} className="text-indigo-600 dark:text-indigo-400 lg:rotate-0 rotate-90" /> : flow === 'diagram-to-code' ? <ArrowRight size={20} className="text-blue-500 lg:rotate-0 rotate-90" /> : <ArrowLeft size={20} className="text-blue-500 lg:rotate-0 rotate-90" />}
                  </button>
                </Tooltip>
              </div>
            )}
          </React.Fragment>
        ))}

        {panels.length === 1 && (
          <div className="w-16 flex flex-col items-center justify-center shrink-0">
            <button onClick={() => {
              const available = Object.keys(PANEL_TYPES).find(t => !panels.includes(t)) || 'pseudocode';
              setPanels([...panels, available]);
              lastEdited.current = panels[0]; // Prioritize existing panel over the new empty one

              if (available === 'python' && (!pythonCode || pythonCode.trim() === '')) {
                  const result = parseDrawioToPython(diagramXml);
                  setPythonCode(result?.code || '');
                  setPythonNodeLineMap(result?.nodeLineMap || {});
              } else if (available === 'pseudocode' && (!pseudocode || pseudocode.trim() === '')) {
                  const result = parseDrawioToPseudocode(diagramXml);
                  setPseudocode(result?.code || '');
                  setPseudoNodeLineMap(result?.nodeLineMap || {});
              }
            }} className="p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 border-dashed rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm text-gray-500 dark:text-gray-400 transition-colors">
              <Plus size={24} />
            </button>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}