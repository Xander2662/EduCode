import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  ReactFlow, 
  ReactFlowProvider, 
  Background, 
  MarkerType, 
  ConnectionLineType, 
  useNodesState, 
  useEdgesState, 
  useReactFlow 
} from '@xyflow/react';
import { 
  X, 
  Settings, 
  MousePointer2, 
  Keyboard, 
  Check, 
  ChevronDown, 
  RotateCcw, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Palette,
  AlertTriangle,
  Plus,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  ClipboardPaste,
  CheckSquare,
  Bug,
  Play,
  Pause,
  StepForward,
  Square,
  Edit3,
  Move,
  MousePointerClick,
  BoxSelect,
  Mouse
} from 'lucide-react';

import { StartEndNode, ConditionNode, ActionNode, GroupBgNode, LoopContainerNode } from './diagram/CustomNodes';
import { CustomEdge } from './diagram/CustomEdge';
import { edgeLabels } from './diagram/constants';
import { Tooltip } from './Tooltip';
import { getGroupDefs, computeGroupBounds } from '../utils/grouping';

// Node and Edge types defined outside component to avoid React Flow warnings
const previewNodeTypes = {
  START_END: StartEndNode,
  CONDITION: ConditionNode,
  ACTION: ActionNode,
  GROUP_BG: GroupBgNode,
  LOOP_CONTAINER: LoopContainerNode
};

const previewEdgeTypes = {
  customEdge: CustomEdge
};

// Action definitions for Hotkeys Manager (all fully customizable with slots)
const ACTION_DEFINITIONS = [
  {
    key: 'undo',
    label: 'Krok zpět (Undo)',
    desc: 'Vrátí zpět poslední provedenou úpravu v diagramu',
    icon: Undo2,
    badge: 'Historie'
  },
  {
    key: 'redo',
    label: 'Krok vpřed (Redo)',
    desc: 'Znovu provede vrácenou úpravu v diagramu',
    icon: Redo2,
    badge: 'Historie'
  },
  {
    key: 'delete',
    label: 'Smazat vybrané',
    desc: 'Odstraní označený blok nebo hranu z diagramu',
    icon: Trash2,
    badge: 'Úpravy'
  },
  {
    key: 'rename',
    label: 'Přejmenovat / Editovat text',
    desc: 'Okamžitě aktivuje editaci textu vybraného bloku na plátně',
    icon: Edit3,
    badge: 'Úpravy'
  },
  {
    key: 'copy',
    label: 'Kopírovat',
    desc: 'Zkopíruje označené bloky včetně jejich vazeb',
    icon: Copy,
    badge: 'Schránka'
  },
  {
    key: 'paste',
    label: 'Vložit',
    desc: 'Vloží zkopírované bloky na pozici kurzoru',
    icon: ClipboardPaste,
    badge: 'Schránka'
  },
  {
    key: 'contextMenu',
    label: 'Nabídka bloků / Kontextové menu',
    desc: 'Otevře nabídku pro rychlé vložení nového bloku na pozici kurzoru (neposouvá pohled)',
    icon: Plus,
    badge: 'Plátno & Myš'
  },
  {
    key: 'selectAll',
    label: 'Vybrat vše',
    desc: 'Označí všechny bloky a hrany na plátně',
    icon: CheckSquare,
    badge: 'Výběr'
  },
  {
    key: 'multiSelect',
    label: 'Vícenásobný výběr bloků',
    desc: 'Postupné přidávání a odebírání jednotlivých bloků nebo hran z výběru',
    icon: MousePointerClick,
    badge: 'Výběr & Myš'
  },
  {
    key: 'lassoSelect',
    label: 'Laso / Obdélníkový výběr',
    desc: 'Hromadný výběr bloků tažením obdélníku (velmi užitečné uvnitř kontejnerů cyklů, kde běžné tažení posouvá celý kontejner)',
    icon: BoxSelect,
    badge: 'Výběr & Myš'
  },
  {
    key: 'zoomIn',
    label: 'Přiblížit (Zoom In)',
    desc: 'Plynule zvětší pohled na diagramové plátno',
    icon: ZoomIn,
    badge: 'Pohled'
  },
  {
    key: 'zoomOut',
    label: 'Oddálit (Zoom Out)',
    desc: 'Plynule zmenší pohled na diagramové plátno',
    icon: ZoomOut,
    badge: 'Pohled'
  },
  {
    key: 'pan',
    label: 'Posun celého plátna (Pan)',
    desc: 'Stisknutím prostředního tlačítka (kolečka) myši uchopíte a posunete celé plátno',
    icon: Move,
    badge: 'Pohled & Myš'
  }
];

// Custom Select matching EduCode app style
const CustomSelect = ({ label, value, options, onChange, description }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  return (
    <div className="relative mb-5" ref={containerRef}>
      {label && (
        <div className="mb-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
            {label}
          </label>
          {description && <p className="text-xs text-gray-400 dark:text-gray-500">{description}</p>}
        </div>
      )}
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-sm bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg outline-none px-3.5 py-2.5 flex items-center justify-between text-gray-700 dark:text-gray-200 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors shadow-sm"
      >
        <span className="font-medium truncate">{selectedOption?.label}</span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full text-left px-3.5 py-2.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors flex items-center justify-between ${
                opt.value === value 
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/60 dark:bg-indigo-900/25' 
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex flex-col">
                <span>{opt.label}</span>
                {opt.subtext && <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">{opt.subtext}</span>}
              </div>
              {opt.value === value && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Toggle switch matching EduCode app style
const ToggleSwitch = ({ checked, onChange, label, description }) => (
  <label className="flex items-center justify-between cursor-pointer group py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800">
    <div className="pr-4">
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block">
        {label}
      </span>
      {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
    </div>
    <div className="relative shrink-0">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <div className={`block w-11 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-5' : ''} shadow-sm`}></div>
    </div>
  </label>
);

// 1:1 Live Diagram Canvas Preview Component
function DiagramPreviewCanvas({ settings, activeTab }) {
  const isDark = settings.isDarkMode;
  const isSimple = settings.editorMode === 'simple';

  // Appearance Tab: Full function matching the user's camera setup + 2 new blocks + group coloring
  const getAppearanceNodes = useCallback(() => {
    const list = [
      {
        id: 'start-node',
        type: 'START_END',
        position: { x: 130, y: 20 },
        data: {
          mode: 'start',
          label: 'main',
          readOnly: true,
          colorMode: settings.colorMode,
          entityType: 'FUNCTION'
        }
      },
      {
        id: 'cond-node',
        type: 'CONDITION',
        position: { x: 105, y: 115 },
        data: {
          label: 'x > 0',
          readOnly: true,
          conditionShape: settings.conditionShape,
          edgeStyle: settings.edgeStyle,
          colorMode: settings.colorMode
        }
      },
      {
        id: 'act-node-1',
        type: 'ACTION',
        position: { x: 30, y: 240 },
        data: {
          label: 'x = x - 1',
          readOnly: true,
          colorMode: settings.colorMode
        }
      },
      {
        id: 'act-node-2',
        type: 'ACTION',
        position: { x: 30, y: 325 },
        data: {
          label: 'print(x)',
          readOnly: true,
          colorMode: settings.colorMode
        }
      },
      {
        id: 'end-node-bottom',
        type: 'START_END',
        position: { x: 30, y: 445 },
        data: {
          mode: 'end',
          label: 'KONEC',
          readOnly: true,
          colorMode: settings.colorMode,
          entityType: 'FUNCTION'
        }
      },
      {
        id: 'end-node-right',
        type: 'START_END',
        position: { x: 235, y: 240 },
        data: {
          mode: 'end',
          label: 'KONEC',
          readOnly: true,
          colorMode: settings.colorMode,
          entityType: 'FUNCTION'
        }
      }
    ];
    return list;
  }, [settings.colorMode, settings.conditionShape, settings.edgeStyle]);

  const getAppearanceEdges = useCallback(() => {
    const p = edgeLabels[settings.edgeStyle || 'true-false'] || { t: 'True', f: 'False' };
    return [
      {
        id: 'e-start-cond',
        source: 'start-node',
        target: 'cond-node',
        sourceHandle: 's-bottom',
        targetHandle: 't-top',
        type: 'customEdge',
        data: { readOnly: true }
      },
      {
        id: 'e-cond-act1',
        source: 'cond-node',
        target: 'act-node-1',
        sourceHandle: 's-bottom',
        targetHandle: 't-top',
        type: 'customEdge',
        data: {
          label: p.t,
          isCondition: true,
          edgeStyle: settings.edgeStyle,
          readOnly: true
        }
      },
      {
        id: 'e-act1-act2',
        source: 'act-node-1',
        target: 'act-node-2',
        sourceHandle: 's-bottom',
        targetHandle: 't-top',
        type: 'customEdge',
        data: { readOnly: true }
      },
      {
        id: 'e-act2-end',
        source: 'act-node-2',
        target: 'end-node-bottom',
        sourceHandle: 's-bottom',
        targetHandle: 't-top',
        type: 'customEdge',
        data: { readOnly: true }
      },
      {
        id: 'e-cond-endright',
        source: 'cond-node',
        target: 'end-node-right',
        sourceHandle: 's-right',
        targetHandle: 't-top',
        type: 'customEdge',
        data: {
          label: p.f,
          isCondition: true,
          edgeStyle: settings.edgeStyle,
          readOnly: true
        }
      }
    ];
  }, [settings.edgeStyle]);

  // Controls Tab: While loop container for Simple mode, condition loopback for Advanced mode + debugger stepping
  const getControlsNodes = useCallback((currentActiveId = null) => {
    if (isSimple) {
      // Simple (Začátečník) mode: Loop container (while loop) wrapping actions
      return [
        {
          id: 'ctrl-start',
          type: 'START_END',
          position: { x: 130, y: -30 },
          data: {
            mode: 'start',
            label: 'main',
            readOnly: true,
            colorMode: settings.colorMode,
            entityType: 'FUNCTION',
            isRuntimeActive: currentActiveId === 'ctrl-start'
          }
        },
        {
          id: 'ctrl-init',
          type: 'ACTION',
          position: { x: 130, y: 70 },
          data: {
            label: 'i = 0',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-init'
          }
        },
        {
          id: 'ctrl-loop-bg',
          type: 'LOOP_CONTAINER',
          position: { x: 10, y: 160 },
          style: { width: 190, height: 430, zIndex: -1 },
          data: {
            label: 'i < 5',
            colorMode: settings.colorMode,
            doWhile: false,
            readOnly: true,
            isRuntimeActive: currentActiveId === 'ctrl-loop-bg'
          }
        },
        {
          id: 'ctrl-act1',
          type: 'ACTION',
          position: { x: 35, y: 210 },
          data: {
            label: 'krok_1()',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-act1'
          }
        },
        {
          id: 'ctrl-act2',
          type: 'ACTION',
          position: { x: 35, y: 300 },
          data: {
            label: 'krok_2()',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-act2'
          }
        },
        {
          id: 'ctrl-act3',
          type: 'ACTION',
          position: { x: 35, y: 390 },
          data: {
            label: 'vypocet()',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-act3'
          }
        },
        {
          id: 'ctrl-act4',
          type: 'ACTION',
          position: { x: 35, y: 480 },
          data: {
            label: 'i = i + 1',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-act4'
          }
        },
        {
          id: 'ctrl-end',
          type: 'START_END',
          position: { x: 130, y: 620 },
          data: {
            mode: 'end',
            label: 'KONEC',
            readOnly: true,
            colorMode: settings.colorMode,
            entityType: 'FUNCTION',
            isRuntimeActive: currentActiveId === 'ctrl-end'
          }
        },
        // Invisible spacer ensuring clear separation between the function and the bottom debugger panel
        {
          id: 'ctrl-bottom-spacer',
          type: 'GROUP_BG',
          position: { x: 130, y: 760 },
          style: { width: 1, height: 1, opacity: 0, pointerEvents: 'none' },
          data: { bgColor: 'transparent', borderColor: 'transparent' },
          selectable: false,
          draggable: false
        }
      ];
    } else {
      // Advanced (Pokročilý) mode: Flowchart while loop with Condition block and loopback arrow
      return [
        {
          id: 'ctrl-start',
          type: 'START_END',
          position: { x: 130, y: -30 },
          data: {
            mode: 'start',
            label: 'main',
            readOnly: true,
            colorMode: settings.colorMode,
            entityType: 'FUNCTION',
            isRuntimeActive: currentActiveId === 'ctrl-start'
          }
        },
        {
          id: 'ctrl-init',
          type: 'ACTION',
          position: { x: 130, y: 70 },
          data: {
            label: 'i = 0',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-init'
          }
        },
        {
          id: 'ctrl-cond',
          type: 'CONDITION',
          position: { x: 105, y: 175 },
          data: {
            label: 'i < 5',
            readOnly: true,
            conditionShape: settings.conditionShape,
            edgeStyle: settings.edgeStyle,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-cond'
          }
        },
        {
          id: 'ctrl-act1',
          type: 'ACTION',
          position: { x: 25, y: 295 },
          data: {
            label: 'krok_1()',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-act1'
          }
        },
        {
          id: 'ctrl-act2',
          type: 'ACTION',
          position: { x: 25, y: 385 },
          data: {
            label: 'krok_2()',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-act2'
          }
        },
        {
          id: 'ctrl-act3',
          type: 'ACTION',
          position: { x: 25, y: 475 },
          data: {
            label: 'vypocet()',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-act3'
          }
        },
        {
          id: 'ctrl-act4',
          type: 'ACTION',
          position: { x: 25, y: 565 },
          data: {
            label: 'i = i + 1',
            readOnly: true,
            colorMode: settings.colorMode,
            isRuntimeActive: currentActiveId === 'ctrl-act4'
          }
        },
        {
          id: 'ctrl-end',
          type: 'START_END',
          position: { x: 300, y: 280 },
          data: {
            mode: 'end',
            label: 'KONEC',
            readOnly: true,
            colorMode: settings.colorMode,
            entityType: 'FUNCTION',
            isRuntimeActive: currentActiveId === 'ctrl-end'
          }
        },
        // Invisible spacer ensuring clear separation between the function and the bottom debugger panel
        {
          id: 'ctrl-bottom-spacer',
          type: 'GROUP_BG',
          position: { x: 130, y: 720 },
          style: { width: 1, height: 1, opacity: 0, pointerEvents: 'none' },
          data: { bgColor: 'transparent', borderColor: 'transparent' },
          selectable: false,
          draggable: false
        }
      ];
    }
  }, [isSimple, settings.colorMode, settings.conditionShape, settings.edgeStyle]);

  const getControlsEdges = useCallback(() => {
    const p = edgeLabels[settings.edgeStyle || 'true-false'] || { t: 'True', f: 'False' };
    if (isSimple) {
      // Simple (Začátečník) mode: Sequential edges inside LOOP_CONTAINER
      return [
        {
          id: 'ec-start-init',
          source: 'ctrl-start',
          target: 'ctrl-init',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-init-act1',
          source: 'ctrl-init',
          target: 'ctrl-act1',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-act1-act2',
          source: 'ctrl-act1',
          target: 'ctrl-act2',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-act2-act3',
          source: 'ctrl-act2',
          target: 'ctrl-act3',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-act3-act4',
          source: 'ctrl-act3',
          target: 'ctrl-act4',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-act4-end',
          source: 'ctrl-act4',
          target: 'ctrl-end',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        }
      ];
    } else {
      // Advanced (Pokročilý) mode: Loopback and condition edges
      return [
        {
          id: 'ec-start-init',
          source: 'ctrl-start',
          target: 'ctrl-init',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-init-cond',
          source: 'ctrl-init',
          target: 'ctrl-cond',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-cond-act1',
          source: 'ctrl-cond',
          target: 'ctrl-act1',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: {
            label: p.t,
            isCondition: true,
            edgeStyle: settings.edgeStyle,
            readOnly: true
          }
        },
        {
          id: 'ec-act1-act2',
          source: 'ctrl-act1',
          target: 'ctrl-act2',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-act2-act3',
          source: 'ctrl-act2',
          target: 'ctrl-act3',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-act3-act4',
          source: 'ctrl-act3',
          target: 'ctrl-act4',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true }
        },
        {
          id: 'ec-loop-back',
          source: 'ctrl-act4',
          target: 'ctrl-cond',
          sourceHandle: 's-bottom',
          targetHandle: 't-top',
          type: 'customEdge',
          data: { readOnly: true, edgeStyle: 'while-do' }
        },
        {
          id: 'ec-cond-end',
          source: 'ctrl-cond',
          target: 'ctrl-end',
          sourceHandle: 's-right',
          targetHandle: 't-top',
          type: 'customEdge',
          data: {
            label: p.f,
            isCondition: true,
            edgeStyle: settings.edgeStyle,
            readOnly: true
          }
        }
      ];
    }
  }, [isSimple, settings.edgeStyle]);

  // Stepping paths for Debugger
  const simpleStepPath = useMemo(() => [
    'ctrl-start',
    'ctrl-init',
    'ctrl-act1',
    'ctrl-act2',
    'ctrl-act3',
    'ctrl-act4',
    'ctrl-act1',
    'ctrl-act2',
    'ctrl-act3',
    'ctrl-act4',
    'ctrl-end'
  ], []);

  const advancedStepPath = useMemo(() => [
    'ctrl-start',
    'ctrl-init',
    'ctrl-cond',
    'ctrl-act1',
    'ctrl-act2',
    'ctrl-act3',
    'ctrl-act4',
    'ctrl-cond',
    'ctrl-act1',
    'ctrl-act2',
    'ctrl-act3',
    'ctrl-act4',
    'ctrl-cond',
    'ctrl-end'
  ], []);

  const stepPath = isSimple ? simpleStepPath : advancedStepPath;

  const [debugStepIndex, setDebugStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(!!settings.showDebugger);

  // Automatically start playing when debugger toggle turns on
  useEffect(() => {
    if (settings.showDebugger && activeTab === 'controls') {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setDebugStepIndex(0);
    }
  }, [settings.showDebugger, activeTab]);

  // Real-time debugger auto-play loop
  useEffect(() => {
    if (!settings.showDebugger || !isPlaying || activeTab !== 'controls') return;

    const delay = Math.max(120, Math.round(1200 * (100 / Math.max(15, settings.debugSpeedPercent || 100))));
    const timer = setInterval(() => {
      setDebugStepIndex(prev => (prev + 1) % stepPath.length);
    }, delay);

    return () => clearInterval(timer);
  }, [settings.showDebugger, isPlaying, activeTab, settings.debugSpeedPercent, stepPath.length]);

  const activeNodeId = (settings.showDebugger && activeTab === 'controls') ? stepPath[debugStepIndex] : null;

  const [nodes, setNodes, onNodesChange] = useNodesState(
    activeTab === 'appearance' ? getAppearanceNodes() : getControlsNodes(null)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    activeTab === 'appearance' ? getAppearanceEdges() : getControlsEdges()
  );
  const reactFlowInstance = useReactFlow();

  // Dynamic color grouping using EduCode's grouping.js
  const groupDefs = useMemo(() => {
    if (!settings.groupColoring || !Array.isArray(nodes) || !Array.isArray(edges) || nodes.length === 0) return [];
    return getGroupDefs(nodes, edges);
  }, [nodes, edges, settings.groupColoring]);

  const bgNodes = useMemo(() => {
    if (!settings.groupColoring || !Array.isArray(nodes) || groupDefs.length === 0) return [];
    return computeGroupBounds(nodes, groupDefs, settings.colorMode);
  }, [nodes, groupDefs, settings.groupColoring, settings.colorMode]);

  const allNodes = useMemo(() => [...(bgNodes || []), ...(nodes || [])], [bgNodes, nodes]);

  // Only switch full layout when activeTab or editorMode actually changes
  const prevTabRef = useRef(activeTab);
  const prevEditorModeRef = useRef(settings.editorMode);

  useEffect(() => {
    const tabChanged = prevTabRef.current !== activeTab;
    const modeChanged = prevEditorModeRef.current !== settings.editorMode;
    prevTabRef.current = activeTab;
    prevEditorModeRef.current = settings.editorMode;

    if (tabChanged || (activeTab === 'controls' && modeChanged)) {
      if (activeTab === 'appearance') {
        setNodes(getAppearanceNodes());
        setEdges(getAppearanceEdges());
      } else {
        setNodes(getControlsNodes(null));
        setEdges(getControlsEdges());
      }
      if (reactFlowInstance) {
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.25, duration: 250 });
        }, 60);
      }
    }
  }, [activeTab, settings.editorMode, getAppearanceNodes, getAppearanceEdges, getControlsNodes, getControlsEdges, reactFlowInstance, setNodes, setEdges]);

  // Update node data in-place when settings change (preserving user drags/positions)
  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        colorMode: settings.colorMode,
        ...(n.type === 'CONDITION' ? {
          conditionShape: settings.conditionShape,
          edgeStyle: settings.edgeStyle
        } : {})
      }
    })));
  }, [settings.colorMode, settings.conditionShape, settings.edgeStyle, setNodes]);

  // Update edge labels in-place when edgeStyle changes
  useEffect(() => {
    const p = edgeLabels[settings.edgeStyle || 'true-false'] || { t: 'True', f: 'False' };
    setEdges(eds => eds.map(e => {
      if (e.data?.isCondition) {
        const isPos = e.id.includes('act1') || e.id.includes('act') || ['+', 'Ano', 'Yes', 'True'].includes(e.data?.label);
        return {
          ...e,
          data: {
            ...e.data,
            label: isPos ? p.t : p.f,
            edgeStyle: settings.edgeStyle
          }
        };
      }
      return e;
    }));
  }, [settings.edgeStyle, setEdges]);

  // Update runtime active node for debugger in-place without resetting positions
  useEffect(() => {
    if (activeTab !== 'controls') return;
    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        isRuntimeActive: n.id === activeNodeId
      }
    })));
  }, [activeNodeId, activeTab, setNodes]);

  const handleReset = () => {
    if (activeTab === 'appearance') {
      setNodes(getAppearanceNodes());
      setEdges(getAppearanceEdges());
    } else {
      setDebugStepIndex(0);
      setNodes(getControlsNodes(null));
      setEdges(getControlsEdges());
    }
    if (reactFlowInstance) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.25, duration: 250 });
      }, 50);
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-white dark:bg-gray-900 relative">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-800/80 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[11px]">
            Živý náhled plátna
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            title="Obnovit výchozí pozice"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="preview-canvas-container flex-1 relative w-full h-full overflow-hidden">
        {/* Diagram Debugger Control Panel placed bottom-center matching App.jsx */}
        {settings.showDebugger && activeTab === 'controls' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <div className="flex gap-2 items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow p-1.5 mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex gap-1">
                <Tooltip text="Krokovat vpřed (ignoruje zarážky)">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setDebugStepIndex(prev => (prev + 1) % stepPath.length);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-all"
                    aria-label="Krokovat vpřed (ignoruje zarážky)"
                  >
                    <StepForward size={18} />
                  </button>
                </Tooltip>

                <Tooltip text={isPlaying ? "Pozastavit běh" : "Spustit automaticky (zastaví na zarážkách)"}>
                  <button
                    type="button"
                    onClick={() => setIsPlaying(p => !p)}
                    className={`p-2 rounded transition-all ${
                      isPlaying
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50'
                        : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50'
                    }`}
                    aria-label={isPlaying ? "Pozastavit běh" : "Spustit automaticky (zastaví na zarážkách)"}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                </Tooltip>

                <Tooltip text="Ukončit debugger a vymazat data">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setDebugStepIndex(0);
                    }}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500 dark:text-red-400 transition-all"
                    aria-label="Ukončit debugger a vymazat data"
                  >
                    <Square size={18} />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={allNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={previewNodeTypes}
          edgeTypes={previewEdgeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.4}
          maxZoom={1.6}
          connectionLineType={ConnectionLineType.SmoothStep}
          defaultEdgeOptions={{ type: 'customEdge', markerEnd: { type: MarkerType.ArrowClosed } }}
          selectionMode={settings.selectionMode === 'full' ? 'full' : 'partial'}
          selectionOnDrag={true}
          panOnDrag={[1, 2]}
          panOnScroll={true}
          nodesDraggable={true}
          elementsSelectable={true}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          edgesUpdatable={false}
          deleteKeyCode={null}
          elevateNodesOnSelect={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color={isDark ? "#334155" : "#cbd5e1"} gap={16} />
        </ReactFlow>

        <div className="absolute bottom-3 right-3 z-10 flex gap-1 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => reactFlowInstance?.zoomIn()}
            title="Přiblížit"
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => reactFlowInstance?.zoomOut()}
            title="Oddálit"
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => reactFlowInstance?.fitView({ padding: 0.25 })}
            title="Vycentrovat pohled"
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded transition-colors"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
        <span className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-indigo-500 shrink-0" />
          <span>
            {activeTab === 'appearance' 
              ? 'Plátno ukazuje tvar podmínek, styl popisků hran a skupinové podbarvení akcí.' 
              : 'Vyzkoušejte označení více bloků výběrem Lasso nebo sledujte rychlost krokování debuggeru v cyklu.'}
          </span>
        </span>
      </div>
    </div>
  );
}

// Preview Canvas Wrapper with isolated ReactFlowProvider
const PreviewCanvas = ({ settings, activeTab }) => {
  return (
    <ReactFlowProvider>
      <DiagramPreviewCanvas settings={settings} activeTab={activeTab} />
    </ReactFlowProvider>
  );
};

// Full-featured Hotkeys Manager Component
const HotkeysManager = ({ hotkeys, onUpdate }) => {
  const [recording, setRecording] = useState(null); // { actionKey, slotIndex }
  const [conflictWarning, setConflictWarning] = useState(null); // { newKey, conflictWith, targetAction, targetSlot }
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const getActionSlots = useCallback((actionKey) => {
    const val = hotkeys?.[actionKey];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim() !== '') return [val];
    return [];
  }, [hotkeys]);

  const applyHotkey = useCallback((actionKey, slotIndex, hotkeyString) => {
    const currentSlots = [...getActionSlots(actionKey)];
    if (slotIndex >= 0 && slotIndex < currentSlots.length) {
      currentSlots[slotIndex] = hotkeyString;
    } else {
      currentSlots.push(hotkeyString);
    }
    onUpdate('hotkeys', { ...hotkeys, [actionKey]: currentSlots });
    setRecording(null);
    setConflictWarning(null);
  }, [getActionSlots, hotkeys, onUpdate]);

  const handleAssign = useCallback((hotkeyString) => {
    if (!recording) return;

    // Check for conflicts across all actions and slots
    let conflict = null;
    ACTION_DEFINITIONS.forEach(def => {
      const slots = getActionSlots(def.key);
      slots.forEach((s, sIdx) => {
        if (s.toLowerCase() === hotkeyString.toLowerCase()) {
          if (def.key !== recording.actionKey || sIdx !== recording.slotIndex) {
            conflict = {
              actionKey: def.key,
              actionLabel: def.label,
              slotIndex: sIdx,
              key: hotkeyString
            };
          }
        }
      });
    });

    if (conflict) {
      setConflictWarning({
        newKey: hotkeyString,
        conflictWith: conflict,
        targetAction: recording.actionKey,
        targetSlot: recording.slotIndex
      });
      return;
    }

    // No conflict - apply directly
    applyHotkey(recording.actionKey, recording.slotIndex, hotkeyString);
  }, [recording, getActionSlots, applyHotkey]);

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === 'Escape') {
        setRecording(null);
        setConflictWarning(null);
        return;
      }

      // Ignore bare modifiers
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      let keys = [];
      if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');

      let key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (key === ' ') key = 'Space';
      if (key === '=' || key === '+') key = '+';
      if (key === '-') key = '-';

      keys.push(key);
      const hotkeyString = keys.join('+');

      handleAssign(hotkeyString);
    };

    const handleMouseDown = (e) => {
      // Direct mouse 3 (wheel click) or mouse 2 (right click) assignment
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        handleAssign('Mouse 3');
      } else if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        handleAssign('Mouse 2');
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
    };
  }, [recording, handleAssign]);

  const handleConfirmOverwrite = () => {
    if (!conflictWarning) return;
    const { newKey, conflictWith, targetAction, targetSlot } = conflictWarning;
    const updated = { ...hotkeys };

    // Remove from the conflicting action
    const oldSlots = [...getActionSlots(conflictWith.actionKey)].filter(
      k => k.toLowerCase() !== newKey.toLowerCase()
    );
    updated[conflictWith.actionKey] = oldSlots;

    // Add or replace in the target action
    const targetSlots = [...getActionSlots(targetAction)];
    if (targetSlot >= 0 && targetSlot < targetSlots.length) {
      targetSlots[targetSlot] = newKey;
    } else {
      targetSlots.push(newKey);
    }
    updated[targetAction] = targetSlots;

    onUpdate('hotkeys', updated);
    setRecording(null);
    setConflictWarning(null);
  };

  const handleRemoveSlot = (actionKey, slotIndex) => {
    const currentSlots = [...getActionSlots(actionKey)];
    currentSlots.splice(slotIndex, 1);
    onUpdate('hotkeys', { ...hotkeys, [actionKey]: currentSlots });
  };

  useEffect(() => {
    if (!showResetConfirm) return;
    const handleConfirmKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowResetConfirm(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onUpdate('resetHotkeys', true);
        setShowResetConfirm(false);
      }
    };
    window.addEventListener('keydown', handleConfirmKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleConfirmKeyDown, { capture: true });
  }, [showResetConfirm, onUpdate]);

  return (
    <div className="flex-1 h-full p-6 md:p-8 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/40 space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Keyboard size={19} className="text-indigo-500" />
            Správce klávesových zkratek
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Každá akce může mít více alternativních zkratek (např. <strong>Ctrl+Z</strong> i <strong>Alt+Z</strong> pro Krok zpět).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-all shrink-0"
        >
          <RotateCcw size={13} className="text-indigo-500" />
          <span>Obnovit výchozí zkratky</span>
        </button>
      </div>

      {/* Warning pop-up for Reset to Default Hotkeys */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowResetConfirm(false)}>
          <div 
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3 text-amber-600 dark:text-amber-400">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <AlertTriangle size={22} />
              </div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">Obnovit výchozí zkratky?</h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              Všechna vaše vlastní přiřazení kláves budou smazána a nahrazena výchozí sadou zkratek. Tuto akci nelze vzít zpět.
            </p>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Zrušit (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdate('resetHotkeys', true);
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
              >
                Obnovit výchozí (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Warning Banner */}
      {conflictWarning && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-150 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Konflikt zkratky: {conflictWarning.newKey}
              </h4>
              <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-300">
                Tato zkratka je již přiřazena k akci <strong>{conflictWarning.conflictWith.actionLabel}</strong>. Přejete si ji odebrat z původní akce a přepsat sem?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <button
              type="button"
              onClick={() => { setConflictWarning(null); setRecording(null); }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleConfirmOverwrite}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm"
            >
              Přepsat a přiřadit
            </button>
          </div>
        </div>
      )}

      {/* Grid of Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ACTION_DEFINITIONS.map(action => {
          const slots = getActionSlots(action.key);
          const Icon = action.icon;

          return (
            <div 
              key={action.key}
              className="bg-white dark:bg-gray-800/80 p-4 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      <Icon size={16} />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{action.label}</span>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200/60 dark:border-gray-700/60">
                    {action.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 pl-8">
                  {action.desc}
                </p>
              </div>

              {/* Slots Row */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800/70">
                {slots.map((hotkey, sIdx) => {
                  const isThisRecording = recording?.actionKey === action.key && recording?.slotIndex === sIdx;

                  if (isThisRecording) {
                    return (
                      <div key={sIdx} className="flex flex-col gap-1.5 py-1">
                        <span 
                          className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-indigo-600 text-white animate-pulse ring-2 ring-indigo-400 flex items-center gap-1.5 shadow-sm"
                        >
                          <span>Stiskněte klávesy nebo myš... (Esc)</span>
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-gray-400 font-medium">Volba:</span>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Mouse 3'); }}
                            className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                          >
                            Mouse 3
                          </button>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Mouse 2'); }}
                            className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                          >
                            Mouse 2
                          </button>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Ctrl+Klik'); }}
                            className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                          >
                            Ctrl+Klik
                          </button>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Shift+Tažení'); }}
                            className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                          >
                            Shift+Tažení
                          </button>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Alt+Tažení'); }}
                            className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                          >
                            Alt+Tažení
                          </button>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Ctrl+Tažení'); }}
                            className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                          >
                            Ctrl+Tažení
                          </button>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Mouse 1'); }}
                            className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                          >
                            Mouse 1
                          </button>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Tažení'); }}
                            className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                          >
                            Tažení
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={sIdx}
                      className="group flex items-center gap-1 bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 rounded-lg pl-2.5 pr-1.5 py-1 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => { setConflictWarning(null); setRecording({ actionKey: action.key, slotIndex: sIdx }); }}
                        title="Klikněte pro změnu zkratky"
                        className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        {hotkey}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(action.key, sIdx)}
                        title="Odstranit tuto zkratku"
                        className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}

                {/* Add Slot Button or New Recording Badge */}
                {recording?.actionKey === action.key && recording?.slotIndex === -1 ? (
                  <div className="flex flex-col gap-1.5 py-1">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-indigo-600 text-white animate-pulse ring-2 ring-indigo-400 flex items-center gap-1.5 shadow-sm">
                      <span>Stiskněte klávesy nebo myš... (Esc)</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-gray-400 font-medium">Volba:</span>
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Mouse 3'); }}
                        className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        Mouse 3
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Mouse 2'); }}
                        className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        Mouse 2
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Ctrl+Klik'); }}
                        className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        Ctrl+Klik
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Shift+Tažení'); }}
                        className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        Shift+Tažení
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Alt+Tažení'); }}
                        className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        Alt+Tažení
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Ctrl+Tažení'); }}
                        className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        Ctrl+Tažení
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Mouse 1'); }}
                        className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        Mouse 1
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAssign('Tažení'); }}
                        className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        Tažení
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setConflictWarning(null); setRecording({ actionKey: action.key, slotIndex: -1 }); }}
                    title="Přidat další klávesovou zkratku pro tuto akci"
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-dashed border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1.5 transition-colors font-semibold"
                  >
                    <Plus size={13} />
                    <span>Přidat</span>
                  </button>
                )}

                {slots.length === 0 && recording?.actionKey !== action.key && (
                  <span className="text-xs text-gray-400 italic">Žádná zkratka nepřiřazena</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export const SettingsDialog = ({ isOpen, onClose, settings, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('appearance');

  // Close on Escape key press, matching EduCode standard modal behavior
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-all" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 w-full max-w-5xl h-[85vh] max-h-[700px] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Top Header Bar matching EduCode TutorialDialog & Panels */}
        <div className="flex justify-between items-center px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Nastavení diagramu
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Přizpůsobte si vzhled bloků, chování výběru a klávesové zkratky
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Zavřít (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Left Navigation + Content View */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Column 1: Left Navigation Sidebar */}
          <div className="w-full md:w-56 bg-gray-50/70 dark:bg-gray-900/60 border-r border-gray-200 dark:border-gray-800 p-3 flex flex-col justify-between shrink-0">
            <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0" style={{ scrollbarWidth: 'none' }}>
              
              <button 
                onClick={() => setActiveTab('appearance')} 
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap ${
                  activeTab === 'appearance' 
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-200/60 dark:border-indigo-800/60' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Palette size={16} className={activeTab === 'appearance' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} /> 
                <div>
                  <span>Vzhled diagramu</span>
                  <span className="block text-[10px] font-normal opacity-70">Tvary, popisky, barvy</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('controls')} 
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap ${
                  activeTab === 'controls' 
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-200/60 dark:border-indigo-800/60' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <MousePointer2 size={16} className={activeTab === 'controls' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} /> 
                <div>
                  <span>Ovládání a výběr</span>
                  <span className="block text-[10px] font-normal opacity-70">Lasso, režim editoru</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('hotkeys')} 
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap ${
                  activeTab === 'hotkeys' 
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-200/60 dark:border-indigo-800/60' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Keyboard size={16} className={activeTab === 'hotkeys' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} /> 
                <div>
                  <span>Klávesové zkratky</span>
                  <span className="block text-[10px] font-normal opacity-70">Mapování akcí</span>
                </div>
              </button>
            </nav>

            <div className="hidden md:flex flex-col gap-1 text-[11px] text-gray-400 dark:text-gray-500 pt-3 border-t border-gray-200/80 dark:border-gray-800">
              <span className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-500" />
                Změny se ukládají ihned
              </span>
            </div>
          </div>

          {/* Main Area: Either full-width Hotkeys or Split Form+Canvas */}
          {activeTab === 'hotkeys' ? (
            <HotkeysManager hotkeys={settings.hotkeys} onUpdate={onUpdate} />
          ) : (
            <>
              {/* Settings Configuration Column */}
              <div className="w-full md:w-[350px] p-6 overflow-y-auto shrink-0 border-r border-gray-200 dark:border-gray-800">
                {activeTab === 'appearance' && (
                  <div className="animate-in fade-in slide-in-from-right-2 duration-200 space-y-5">
                    <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                        Vzhled diagramu
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Nastavení geometrie a textu pro vizuální prvky
                      </p>
                    </div>
                    
                    <CustomSelect 
                      label="Tvar podmínky (If / While)"
                      description="Zvolte tvar bloku pro rozhodovací podmínky v diagramu."
                      value={settings.conditionShape}
                      onChange={(v) => onUpdate('conditionShape', v)}
                      options={[
                        { value: 'hexagon', label: 'Šestiúhelník (Hexagon)', subtext: 'Doporučený standard pro moderní diagramy' },
                        { value: 'diamond', label: 'Kosočtverec (Diamond)', subtext: 'Klasický tvar podle starší normy ČSN/ISO' }
                      ]}
                    />

                    <CustomSelect 
                      label="Popisky hran (Pravda / Nepravda)"
                      description="Způsob označení větví vycházejících z podmínek."
                      value={settings.edgeStyle}
                      onChange={(v) => onUpdate('edgeStyle', v)}
                      options={[
                        { value: 'true-false', label: 'True / False', subtext: 'Výchozí programátorské označení' },
                        { value: 'ano-ne', label: 'Ano / Ne', subtext: 'České slovní označení' },
                        { value: 'yes-no', label: 'Yes / No', subtext: 'Anglické slovní označení' },
                        { value: '+-', label: '+ / -', subtext: 'Kompaktní matematické symboly' }
                      ]}
                    />

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
                      <ToggleSwitch 
                        checked={settings.colorMode} 
                        onChange={(e) => onUpdate('colorMode', e.target.checked)} 
                        label="Barevné bloky"
                        description="Každý typ bloku má vlastní rozpoznatelnou barvu."
                      />
                      <ToggleSwitch 
                        checked={settings.groupColoring} 
                        onChange={(e) => onUpdate('groupColoring', e.target.checked)} 
                        label="Zbarvení skupin"
                        description="Zvýrazňuje vnitřní bloky cyklů a větvení jemným podbarvením."
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'controls' && (
                  <div className="animate-in fade-in slide-in-from-right-2 duration-200 space-y-5">
                    <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                        Ovládání a výběr
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Přizpůsobení chování myši a úrovně rozhraní
                      </p>
                    </div>
                    
                    <CustomSelect 
                      label="Režim výběru bloků (Lasso)"
                      description="Jakým způsobem reaguje obdélníkový výběr tažením myši."
                      value={settings.selectionMode}
                      onChange={(v) => onUpdate('selectionMode', v)}
                      options={[
                        { value: 'partial', label: 'Částečný (Stačí zavadit o okraj)', subtext: 'Rychlejší pro výběr více bloků najednou' },
                        { value: 'full', label: 'Celý blok (Musí obsáhnout celý blok)', subtext: 'Přesnější, zabraňuje nechtěnému označení sousedů' }
                      ]}
                    />

                    <div>
                      <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                        Režim editoru
                      </label>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                        Ovlivňuje dostupné bloky v horní liště diagramu.
                      </p>
                      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200/70 dark:border-gray-700/70">
                        <button 
                          onClick={() => onUpdate('editorMode', 'simple')}
                          className={`flex-1 text-xs py-2 px-3 rounded-lg font-semibold transition-all ${
                            settings.editorMode === 'simple' 
                              ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' 
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}
                        >
                          Začátečník
                        </button>
                        <button 
                          onClick={() => onUpdate('editorMode', 'advanced')}
                          className={`flex-1 text-xs py-2 px-3 rounded-lg font-semibold transition-all ${
                            settings.editorMode === 'advanced' 
                              ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' 
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}
                        >
                          Pokročilý
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                      <ToggleSwitch 
                        checked={settings.showDebugger} 
                        onChange={(e) => onUpdate('showDebugger', e.target.checked)} 
                        label="Panel Debuggeru"
                        description="Zobrazí ovládací prvky krokování a sledování proměnných."
                      />

                      {settings.showDebugger && (
                        <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                          <div className="flex justify-between items-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                            <span>Rychlost automatického běhu</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded">
                              {settings.debugSpeedPercent}%
                            </span>
                          </div>
                          <input 
                            type="range" min="0" max="500" step="10" 
                            value={settings.debugSpeedPercent} 
                            onChange={(e) => onUpdate('debugSpeedPercent', parseInt(e.target.value))} 
                            className="w-full accent-indigo-500 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 1:1 Live Diagram Canvas Preview Column */}
              <div className="flex-1 h-full min-h-[300px] flex flex-col bg-gray-50/50 dark:bg-gray-900/50 overflow-hidden">
                <PreviewCanvas settings={settings} activeTab={activeTab} />
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
