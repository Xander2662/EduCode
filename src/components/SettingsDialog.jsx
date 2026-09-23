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
  Mouse,
  Info,
  SlidersHorizontal,
  Lock
} from 'lucide-react';

import { StartEndNode, ConditionNode, ActionNode, GroupBgNode, LoopContainerNode } from './diagram/CustomNodes';
import { CustomEdge } from './diagram/CustomEdge';
import { edgeLabels } from './diagram/constants';
import { Tooltip } from './Tooltip';
import { ConfirmDialog } from './ConfirmDialog';
import { getGroupDefs, computeGroupBounds } from '../utils/grouping';
import { normalizeKeyStr, DEFAULT_HOTKEYS } from '../utils/hotkeys';

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
          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
            {label}
          </span>
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
const ToggleSwitch = ({ checked, onChange, label, description, id, name }) => {
  const toggleId = id || `toggle-${(label || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return (
    <label htmlFor={toggleId} className="flex items-center justify-between cursor-pointer group py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800">
      <div className="pr-4">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block">
          {label}
        </span>
        {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="relative shrink-0">
        <input 
          id={toggleId}
          name={name || toggleId}
          type="checkbox" 
          className="sr-only" 
          checked={checked} 
          onChange={onChange} 
        />
        <div className={`block w-11 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-5' : ''} shadow-sm`}></div>
      </div>
    </label>
  );
};

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

  const [isViewportMoved, setIsViewportMoved] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    activeTab === 'appearance' ? getAppearanceNodes() : getControlsNodes(null)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    activeTab === 'appearance' ? getAppearanceEdges() : getControlsEdges()
  );
  const reactFlowInstance = useReactFlow();

  const defaultNodes = useMemo(() => {
    return activeTab === 'appearance' ? getAppearanceNodes() : getControlsNodes(null);
  }, [activeTab, getAppearanceNodes, getControlsNodes]);

  const isNodesMoved = useMemo(() => {
    if (!nodes || !defaultNodes) return false;
    return nodes.some(n => {
      const def = defaultNodes.find(d => d.id === n.id);
      if (!def) return false;
      return Math.abs(n.position.x - def.position.x) > 1 || Math.abs(n.position.y - def.position.y) > 1;
    });
  }, [nodes, defaultNodes]);

  const canReset = isNodesMoved || isViewportMoved;

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
      setIsViewportMoved(false);
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
    if (!canReset) return;
    setIsViewportMoved(false);
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
          <Tooltip text={!canReset ? 'Plátno je již ve výchozím stavu' : 'Obnovit výchozí pozice'} position="bottom-left">
            <button
              type="button"
              disabled={!canReset}
              onClick={handleReset}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors shadow-2xs ${
                !canReset
                  ? 'opacity-40 cursor-default bg-gray-100 dark:bg-gray-800/40 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-800'
                  : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 shadow-sm cursor-pointer'
              }`}
            >
              <RotateCcw size={11} className={!canReset ? 'text-gray-400 dark:text-gray-600' : 'text-indigo-500'} />
              <span>Reset</span>
            </button>
          </Tooltip>
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
          edgesReconnectable={false}
          deleteKeyCode={null}
          elevateNodesOnSelect={false}
          proOptions={{ hideAttribution: true }}
          onMoveEnd={(e) => {
            if (e) setIsViewportMoved(true);
          }}
        >
          <Background color={isDark ? "#334155" : "#cbd5e1"} gap={16} />
        </ReactFlow>

        <div className="absolute bottom-3 right-3 z-10 flex gap-1 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <Tooltip text="Přiblížit" position="top">
            <button
              onClick={() => {
                reactFlowInstance?.zoomIn();
                setIsViewportMoved(true);
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded transition-colors"
            >
              <ZoomIn size={14} />
            </button>
          </Tooltip>
          <Tooltip text="Oddálit" position="top">
            <button
              onClick={() => {
                reactFlowInstance?.zoomOut();
                setIsViewportMoved(true);
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded transition-colors"
            >
              <ZoomOut size={14} />
            </button>
          </Tooltip>
          <Tooltip text="Vycentrovat pohled" position="top-left">
            <button
              onClick={() => {
                reactFlowInstance?.fitView({ padding: 0.25 });
                setIsViewportMoved(false);
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded transition-colors"
            >
              <Maximize2 size={14} />
            </button>
          </Tooltip>
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

// Helper to detect mouse-type hotkeys for badge icon
const isMouseHotkey = (hotkey) => {
  if (!hotkey || typeof hotkey !== 'string') return false;
  const l = hotkey.toLowerCase();
  return l.startsWith('mouse') || l.includes('klik') || l.includes('tažení') || l.includes('tazeni');
};

// Full-featured Hotkeys Manager Component
const HotkeysManager = ({ hotkeys, onUpdate }) => {
  const [recording, setRecording] = useState(null); // { actionKey, slotIndex }
  const [heldModifiers, setHeldModifiers] = useState([]); // ['Ctrl', 'Shift', 'Alt']
  const [conflictWarning, setConflictWarning] = useState(null); // { newKey, conflictWith, targetAction, targetSlot }
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [actionConfirm, setActionConfirm] = useState(null); // { type: 'restore' | 'remove', actionKey, actionLabel, defaultSlots, anchoredSlots }
  const [expandedRow, setExpandedRow] = useState(null); // actionKey of expanded row

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
    setHeldModifiers([]);
    setConflictWarning(null);
  }, [getActionSlots, hotkeys, onUpdate]);

  const handleAssign = useCallback((hotkeyString) => {
    if (!recording) return;
    if (isMouseHotkey(hotkeyString)) return; // Mouse hotkeys cannot be assigned

    const normalizedNew = normalizeKeyStr(hotkeyString);

    // If already in the same action, don't duplicate
    const currentSlots = getActionSlots(recording.actionKey);
    const alreadyInSameAction = currentSlots.some((s, idx) => idx !== recording.slotIndex && normalizeKeyStr(s) === normalizedNew);
    if (alreadyInSameAction) {
      setRecording(null);
      setHeldModifiers([]);
      return;
    }

    // Check for conflicts across all actions and slots
    let conflict = null;
    ACTION_DEFINITIONS.forEach(def => {
      const slots = getActionSlots(def.key);
      slots.forEach((s, sIdx) => {
        if (normalizeKeyStr(s) === normalizedNew) {
          if (def.key !== recording.actionKey || sIdx !== recording.slotIndex) {
            conflict = {
              actionKey: def.key,
              actionLabel: def.label,
              slotIndex: sIdx,
              key: s
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

  // Live modifier tracking & key recording
  useEffect(() => {
    if (!recording) {
      setHeldModifiers([]);
      return;
    }

    const getModifiers = (e) => {
      const mods = [];
      if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
      if (e.altKey) mods.push('Alt');
      if (e.shiftKey) mods.push('Shift');
      return mods;
    };

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === 'Escape') {
        setRecording(null);
        setHeldModifiers([]);
        setConflictWarning(null);
        return;
      }

      // If modifier key is pressed, update held modifiers
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        setHeldModifiers(getModifiers(e));
        return;
      }

      // Non-modifier key pressed - finalize combination
      const mods = getModifiers(e);
      let key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (key === ' ') key = 'Space';
      if (key === '=' || key === '+') key = '+';
      if (key === '-') key = '-';

      const hotkeyString = [...mods, key].join('+');
      setHeldModifiers([]);
      handleAssign(hotkeyString);
    };

    const handleKeyUp = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Modifier key released - update live modifier display
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        setHeldModifiers(getModifiers(e));
      }
    };

    const handleMouseDown = (e) => {
      // Don't intercept clicks on interactive buttons (options, cancel, etc.)
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) {
        return;
      }

      // Clicking outside cancels recording (mouse hotkeys cannot be assigned)
      setRecording(null);
      setHeldModifiers([]);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
    };
  }, [recording, handleAssign]);

  const handleConfirmOverwrite = useCallback(() => {
    if (!conflictWarning) return;
    const { newKey, conflictWith, targetAction, targetSlot } = conflictWarning;
    const updated = { ...hotkeys };

    // Remove from the conflicting action
    const oldSlots = [...getActionSlots(conflictWith.actionKey)].filter(
      k => normalizeKeyStr(k) !== normalizeKeyStr(newKey)
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
    setHeldModifiers([]);
    setConflictWarning(null);
  }, [conflictWarning, hotkeys, getActionSlots, onUpdate]);

  const handleRemoveSlot = (actionKey, slotIndex) => {
    const currentSlots = [...getActionSlots(actionKey)];
    if (isMouseHotkey(currentSlots[slotIndex])) return; // Anchored mouse hotkeys cannot be removed
    currentSlots.splice(slotIndex, 1);
    onUpdate('hotkeys', { ...hotkeys, [actionKey]: currentSlots });
  };

  return (
    <div 
      className="flex-1 h-full pl-6 pr-4 pt-2.5 pb-3 md:pl-8 md:pr-6 md:pt-2.5 md:pb-3 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/40 space-y-3 [scrollbar-gutter:stable]"
      style={{ scrollbarGutter: 'stable' }}
    >
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2.5 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Keyboard size={19} className="text-indigo-500" />
            Správce klávesových zkratek
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Obnovit výchozí zkratky?"
        info="Všechna vaše vlastní přiřazení kláves budou smazána a nahrazena výchozí sadou zkratek. Tuto akci nelze vzít zpět."
        confirmText="Obnovit výchozí (Enter)"
        cancelText="Zrušit (Esc)"
        confirmVariant="danger"
        zIndex={1200}
        onConfirm={() => {
          onUpdate('resetHotkeys', true);
          setShowResetConfirm(false);
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Action-specific Confirmation Popup for Restore / Remove */}
      <ConfirmDialog
        isOpen={Boolean(actionConfirm)}
        title={actionConfirm?.type === 'remove' ? 'Smazat zkratky?' : 'Obnovit výchozí zkratky?'}
        info={
          actionConfirm?.type === 'remove'
            ? `Opravdu chcete smazat všechny klávesové zkratky pro akci "${actionConfirm?.actionLabel}"?`
            : `Opravdu chcete obnovit výchozí klávesové zkratky pro akci "${actionConfirm?.actionLabel}"?`
        }
        confirmText={actionConfirm?.type === 'remove' ? 'Smazat (Enter)' : 'Obnovit (Enter)'}
        cancelText="Zrušit (Esc)"
        confirmVariant={actionConfirm?.type === 'remove' ? 'danger' : 'primary'}
        zIndex={1200}
        onConfirm={() => {
          if (!actionConfirm) return;
          if (actionConfirm.type === 'remove') {
            onUpdate('hotkeys', { ...hotkeys, [actionConfirm.actionKey]: actionConfirm.anchoredSlots });
          } else {
            onUpdate('hotkeys', { ...hotkeys, [actionConfirm.actionKey]: actionConfirm.defaultSlots });
          }
          setActionConfirm(null);
        }}
        onCancel={() => setActionConfirm(null)}
      />

      {/* Prominent Conflict Warning Modal */}
      <ConfirmDialog
        isOpen={Boolean(conflictWarning)}
        title="Konflikt klávesové zkratky"
        info={
          conflictWarning ? (
            <div>
              <div className="mb-2">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  {conflictWarning.newKey}
                </span>
              </div>
              <p>
                Tato zkratka je již přiřazena k akci <strong>{conflictWarning.conflictWith?.actionLabel || conflictWarning.conflictWith}</strong>.
                Přejete si ji odebrat z původní akce a přepsat pro <strong>{ACTION_DEFINITIONS.find(a => a.key === conflictWarning.targetAction)?.label || conflictWarning.targetAction}</strong>?
              </p>
            </div>
          ) : null
        }
        confirmText="Přepsat a přiřadit (Enter)"
        cancelText="Zrušit (Esc)"
        confirmVariant="warning"
        zIndex={1200}
        onConfirm={handleConfirmOverwrite}
        onCancel={() => {
          setConflictWarning(null);
          setRecording(null);
        }}
      />

      {/* Action Rows List - Narrow rows divided by lines, hotkeys on left side */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 shadow-sm overflow-hidden">
        {ACTION_DEFINITIONS.map((action, actionIndex) => {
          const slots = getActionSlots(action.key);
          const Icon = action.icon;
          const isThisActionRecording = recording?.actionKey === action.key;
          const isExpanded = expandedRow === action.key;
          const isFirstRow = actionIndex === 0;
          const rowTooltipPosition = isFirstRow ? 'bottom' : 'top';
          const defaultSlots = DEFAULT_HOTKEYS[action.key] || [];
          const currentNormalized = slots.map(normalizeKeyStr).sort();
          const defaultNormalized = defaultSlots.map(normalizeKeyStr).sort();
          const isAlreadyDefault = currentNormalized.length === defaultNormalized.length &&
            currentNormalized.every((v, i) => v === defaultNormalized[i]);
          const hasRemovableSlots = slots.some(s => !isMouseHotkey(s));
          const anchoredSlots = slots.filter(isMouseHotkey);

          return (
            <div key={action.key} className="flex flex-col transition-colors">
              {/* Main Row */}
              <div 
                className={`px-3.5 py-2 flex items-center gap-3 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group relative ${
                  isThisActionRecording ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                } ${isExpanded ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}
              >
                {/* Dropdown / Expand Button on the far left */}
                <Tooltip text={isExpanded ? 'Sbalit podrobnosti' : 'Rozbalit podrobnosti a možnosti'} position="right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedRow(isExpanded ? null : action.key);
                    }}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex items-center justify-center shrink-0"
                  >
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} />
                  </button>
                </Tooltip>

                {/* Action Icon */}
                <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Icon size={14} />
                </div>

                {/* Action Name */}
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 w-44 sm:w-52 shrink-0 truncate">
                  {action.label}
                </span>

                {/* Hotkeys Badges & '+' Button - Left-aligned directly after action name */}
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {slots.map((hotkey, sIdx) => {
                    const isMouse = isMouseHotkey(hotkey);
                    const isThisRecording = isThisActionRecording && recording?.slotIndex === sIdx;

                    if (isThisRecording) {
                      return (
                        <div key={sIdx} className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-100">
                          <div className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400 animate-pulse flex items-center gap-1.5 shrink-0">
                            {heldModifiers.length > 0 ? (
                              <span>{heldModifiers.join(' + ')} + ...</span>
                            ) : (
                              <span>Stiskněte klávesu... (Esc)</span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (isMouse) {
                      return (
                        <div 
                          key={sIdx}
                          className="inline-flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700/80 rounded-md px-2 py-0.5 shadow-2xs select-none cursor-default"
                        >
                          <Mouse size={11} className="text-slate-500 dark:text-slate-400 shrink-0" />
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {hotkey}
                          </span>
                          <Lock size={10} className="text-slate-400 dark:text-slate-500 shrink-0 ml-0.5 opacity-70" />
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={sIdx}
                        className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-0.5 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                      >
                        <Tooltip text="Klikněte pro změnu zkratky" position={rowTooltipPosition}>
                          <button
                            type="button"
                            onClick={() => { setConflictWarning(null); setRecording({ actionKey: action.key, slotIndex: sIdx }); }}
                            className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {hotkey}
                          </button>
                        </Tooltip>
                        <Tooltip text="Odstranit tuto zkratku" position={rowTooltipPosition}>
                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(action.key, sIdx)}
                            className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors flex items-center justify-center"
                          >
                            <X size={10} />
                          </button>
                        </Tooltip>
                      </div>
                    );
                  })}

                  {/* New Slot Recording Badge */}
                  {isThisActionRecording && recording?.slotIndex === -1 && (
                    <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400 animate-pulse flex items-center gap-1.5 shrink-0">
                        {heldModifiers.length > 0 ? (
                          <span>{heldModifiers.join(' + ')} + ...</span>
                        ) : (
                          <span>Stiskněte klávesu... (Esc)</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* '+' Button showing up on hover */}
                  {(!isThisActionRecording || recording?.slotIndex !== -1) && (
                    <Tooltip text="Přidat další klávesovou zkratku pro tuto akci" position={rowTooltipPosition}>
                      <button
                        type="button"
                        onClick={() => { setConflictWarning(null); setRecording({ actionKey: action.key, slotIndex: -1 }); }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded border border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center shrink-0"
                      >
                        <Plus size={12} />
                      </button>
                    </Tooltip>
                  )}

                  {slots.length === 0 && !isThisActionRecording && (
                    <span className="text-[11px] text-gray-400 italic">Žádná zkratka nepřiřazena</span>
                  )}
                </div>
              </div>

              {/* Expanded Row Downwards: Info and Useful Buttons */}
              {isExpanded && (
                <div className="px-10 py-2.5 bg-gray-50/70 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800/80 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* Description */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{action.desc}</p>

                  {/* Useful Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tooltip text={isAlreadyDefault ? 'Klávesové zkratky jsou již ve výchozím nastavení' : 'Obnovit výchozí zkratky pro tuto akci'} position="top-right">
                      <button
                        type="button"
                        disabled={isAlreadyDefault}
                        onClick={() => {
                          if (isAlreadyDefault) return;
                          setActionConfirm({
                            type: 'restore',
                            actionKey: action.key,
                            actionLabel: action.label,
                            defaultSlots,
                            anchoredSlots
                          });
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors shadow-2xs ${
                          isAlreadyDefault
                            ? 'opacity-40 cursor-default bg-gray-100 dark:bg-gray-800/40 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-800'
                            : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 cursor-pointer'
                        }`}
                      >
                        <RotateCcw size={12} className={isAlreadyDefault ? 'text-gray-400 dark:text-gray-600' : 'text-indigo-500'} />
                        <span>Obnovit výchozí</span>
                      </button>
                    </Tooltip>

                    <Tooltip text={!hasRemovableSlots ? 'Nejsou přiřazeny žádné vlastní klávesové zkratky ke smazání' : 'Smazat všechny klávesové zkratky pro tuto akci'} position="top-right">
                      <button
                        type="button"
                        disabled={!hasRemovableSlots}
                        onClick={() => {
                          if (!hasRemovableSlots) return;
                          setActionConfirm({
                            type: 'remove',
                            actionKey: action.key,
                            actionLabel: action.label,
                            defaultSlots,
                            anchoredSlots
                          });
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors shadow-2xs ${
                          !hasRemovableSlots
                            ? 'opacity-40 cursor-default bg-gray-100 dark:bg-gray-800/40 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-800'
                            : 'bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 border-gray-200 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800/50 cursor-pointer'
                        }`}
                      >
                        <Trash2 size={12} className={!hasRemovableSlots ? 'text-gray-400 dark:text-gray-600' : ''} />
                        <span>Smazat zkratky</span>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}
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
          <Tooltip text="Zavřít (Esc)" position="bottom-left">
            <button 
              onClick={onClose} 
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={18} />
            </button>
          </Tooltip>
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
                <SlidersHorizontal size={16} className={activeTab === 'controls' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} /> 
                <div>
                  <span>Režim a debugger</span>
                  <span className="block text-[10px] font-normal opacity-70">Lasso, editor a ladění</span>
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
                        Nastavení vzhledu a textu pro vizuální prvky
                      </p>
                    </div>
                    
                    <CustomSelect 
                      label="Tvar podmínky (if blok)"
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
                        { value: '+-', label: '+ / -', subtext: 'Matematické označení' }
                      ]}
                    />

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
                      <ToggleSwitch 
                        checked={settings.colorMode} 
                        onChange={(e) => onUpdate('colorMode', e.target.checked)} 
                        label="Barevné bloky"
                        description="Každý typ bloku má vlastní barvu."
                      />
                      <ToggleSwitch 
                        checked={settings.groupColoring} 
                        onChange={(e) => onUpdate('groupColoring', e.target.checked)} 
                        label="Zbarvení skupin"
                        description="Vytváří barevné seskupení podle skupin bloků."
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'controls' && (
                  <div className="animate-in fade-in slide-in-from-right-2 duration-200 space-y-5">
                    <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                        Režim a debugger
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Přizpůsobení chování editoru, výběru a ladění kódu
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
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                        Režim editoru
                      </span>
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
                            id="settings-debug-speed-slider"
                            name="debugSpeedPercent"
                            aria-label="Rychlost automatického běhu"
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
