import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, addEdge, useNodesState, useEdgesState, Controls, Background, Handle, Position, MarkerType, BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, useNodes, useEdges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, Upload, Square, Circle, Diamond, AlignLeft, RefreshCcw, Copy, Trash2, MessageSquare, FileJson, FileCode } from 'lucide-react';
import { drawioToReactFlow, reactFlowToDrawio } from '../utils/diagramConverter';
import { calculateGroupNodes } from '../utils/grouping';

const edgeLabels = {
  '+-': { t: '+', f: '-' },
  'ano-ne': { t: 'Ano', f: 'Ne' },
  'yes-no': { t: 'Yes', f: 'No' },
  'true-false': { t: 'True', f: 'False' }
};

const CustomEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data, selected }) => {
  const { setEdges } = useReactFlow();
  const nodes = useNodes();
  const isCondition = nodes.find(n => n.id === source)?.type === 'CONDITION';
  const isTargetMerge = nodes.find(n => n.id === target)?.type === 'MERGE';
  
  const [edgePath, labelX, labelY] = (() => {
    const isBackEdge = sourceY > targetY;
    if (isBackEdge) {
        let maxX = Math.max(sourceX, targetX);
        let minX = Math.min(sourceX, targetX);
        
        nodes.forEach(n => {
            if (n.position.y >= targetY - 30 && n.position.y <= sourceY + 30) {
                const nodeX = n.position.x;
                const nodeMaxX = nodeX + (n.measured?.width || 150);
                if (nodeMaxX > maxX) maxX = nodeMaxX;
                if (nodeX < minX) minX = nodeX;
            }
        });
        
        const loopNode = nodes.find(n => n.id === target);
        const loopCenterX = loopNode ? loopNode.position.x + (loopNode.measured?.width || 120) / 2 : targetX;
        
        const routeLeft = sourceX < loopCenterX;
        
        const bottomY = sourceY + 30; 
        const topY = targetY - 30;    
        const r = 10;                 
        
        let path, finalLabelX;
        
        if (routeLeft) {
            const leftEdgeX = minX - 40;
            path = `M ${sourceX} ${sourceY} L ${sourceX} ${bottomY - r} A ${r} ${r} 0 0 1 ${sourceX - r} ${bottomY} L ${leftEdgeX + r} ${bottomY} A ${r} ${r} 0 0 1 ${leftEdgeX} ${bottomY - r} L ${leftEdgeX} ${topY + r} A ${r} ${r} 0 0 1 ${leftEdgeX + r} ${topY} L ${targetX - r} ${topY} A ${r} ${r} 0 0 1 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
            finalLabelX = leftEdgeX;
        } else {
            const rightEdgeX = maxX + 40; 
            path = `M ${sourceX} ${sourceY} L ${sourceX} ${bottomY - r} A ${r} ${r} 0 0 0 ${sourceX + r} ${bottomY} L ${rightEdgeX - r} ${bottomY} A ${r} ${r} 0 0 0 ${rightEdgeX} ${bottomY - r} L ${rightEdgeX} ${topY + r} A ${r} ${r} 0 0 0 ${rightEdgeX - r} ${topY} L ${targetX + r} ${topY} A ${r} ${r} 0 0 0 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
            finalLabelX = rightEdgeX;
        }
        
        return [path, finalLabelX, (bottomY + topY) / 2];
    } else {
        return getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
    }
  })();

  const onSwap = (e) => {
    e.stopPropagation();
    if (data?.readOnly) return;
    
    setEdges(eds => {
      const sibling = eds.find(edge => edge.source === source && edge.id !== id);
      const pref = edgeLabels[data.edgeStyle || 'true-false'];
      
      const toggleLabel = (l) => {
          return (l === pref.t || l === 'Ano' || l === '+' || l === 'Yes' || l === 'True') ? pref.f : pref.t;
      };
      
      if (!sibling) return eds;
      return eds.map(edge => {
        if (edge.id === id) return { ...edge, data: { ...edge.data, label: toggleLabel(edge.data.label) } };
        if (edge.id === sibling.id) return { ...edge, data: { ...edge.data, label: toggleLabel(sibling.data.label) } };
        return edge;
      });
    });
  };

  const labelText = data?.label || 'True';
  const pref = edgeLabels[data.edgeStyle || 'true-false'];
  const isPositive = labelText === pref.t || labelText === 'Ano' || labelText === '+' || labelText === 'Yes' || labelText === 'True';

  return (
    <>
      <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={30} className="react-flow__edge-interaction cursor-crosshair" />
      <BaseEdge path={edgePath} markerEnd={isTargetMerge ? undefined : markerEnd} className={`react-flow__edge-path custom-edge-${id} ${selected ? "!stroke-indigo-500" : "!stroke-gray-800 dark:!stroke-gray-400"}`} style={{ strokeWidth: selected ? 3 : 2 }} />
      {isCondition && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
               className={`group bg-white dark:bg-gray-800 border ${selected ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' : 'border-gray-300 dark:border-gray-600'} rounded px-2 py-1 text-xs font-bold shadow-sm flex items-center gap-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700`}>
            <span className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{labelText}</span>
            {!data?.readOnly && (
              <button onClick={onSwap} className="hidden group-hover:block text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"><RefreshCcw size={12} /></button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const DragHandle = () => <div className="custom-drag-handle w-8 h-1.5 cursor-grab bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors mx-auto mb-1" title="Chytit a přesunout" />;

const getSelectClass = (selected, defaultBorder) => selected ? 'ring-4 ring-indigo-300 border-indigo-600 dark:border-indigo-500 !shadow-lg' : defaultBorder;
const extHighlightClass = 'ring-4 ring-emerald-300 border-emerald-500 dark:border-emerald-500 !shadow-lg';

const handleInputMouseDown = (e, selected) => {
  if (!selected && document.activeElement !== e.target) e.preventDefault();
};

const handleInputResize = (e) => {
  e.target.style.height = 'auto';
  e.target.style.height = e.target.scrollHeight + 'px';
  e.target.style.width = 'auto';
  e.target.style.width = Math.max(100, e.target.scrollWidth) + 'px';
};

// Vykresluje obal přes celý node kontejner React Flow
const GroupBgNode = ({ data }) => (
    <div style={{ backgroundColor: data.bgColor, borderColor: data.borderColor }} className="w-full h-full rounded-[2rem] border-[3px] border-dashed pointer-events-none" />
);

const StartEndNode = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  let mode = data.mode || 'unassigned';
  let entityType = data.entityType || 'FUNCTION';

  const setMode = (newMode) => {
    let newLabel = data.label;
    if (newMode === 'start' && !newLabel) newLabel = 'main';
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, mode: newMode, label: newLabel } } : n));
  };

  const toggleEntity = () => {
    if(data.readOnly) return;
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, entityType: entityType === 'FUNCTION' ? 'CLASS' : 'FUNCTION' } } : n));
  };

  const isGray = data.colorMode === false;
  const bgClass = isGray ? 'bg-gray-100 dark:bg-gray-800' : 'bg-fuchsia-50 dark:bg-fuchsia-900/30';
  const borderClass = isGray ? 'border-gray-400 dark:border-gray-600' : 'border-fuchsia-300 dark:border-fuchsia-700';
  const titleColor = isGray ? 'text-gray-500' : 'text-fuchsia-500';
  const handleClass = isGray ? '!bg-gray-400' : '!bg-fuchsia-600';
  
  const highlightClass = data.externalHighlight ? extHighlightClass : getSelectClass(selected, borderClass);

  return (
    <div className={`${bgClass} border-2 rounded-[2rem] min-w-[140px] min-h-[40px] flex flex-col justify-center items-center p-2 transition-all relative ${highlightClass}`}>
      {mode !== 'start' && <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />}
      
      {mode === 'unassigned' && (
        <>
          <DragHandle />
          <div className="flex gap-2 w-full px-2 mt-1 z-10 flex-1 items-center justify-center">
            <button onClick={() => setMode('start')} className="flex-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 rounded py-1 font-bold pointer-events-auto">Start</button>
            <button onClick={() => setMode('end')} className="flex-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 rounded py-1 font-bold pointer-events-auto">Konec</button>
          </div>
        </>
      )}

      {mode === 'start' && (
        <div className="w-full flex-1 flex flex-col px-2 relative pb-1">
          <div className="flex justify-between items-center w-full mb-1 px-1">
            <span className={`text-[9px] font-bold w-12 text-left ${titleColor}`}>START</span>
            <div className={`custom-drag-handle w-8 h-1.5 cursor-grab rounded-full transition-colors ${isGray ? 'bg-gray-300 dark:bg-gray-600' : 'bg-fuchsia-200 dark:bg-fuchsia-800'}`} />
            <span onClick={toggleEntity} className={`text-[9px] font-bold w-12 text-right cursor-pointer hover:opacity-75 ${titleColor} ${data.readOnly ? 'pointer-events-none' : 'pointer-events-auto'}`}>{entityType}</span>
          </div>
          <input defaultValue={data.label} onChange={data.onChange} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-full flex-1 text-center outline-none bg-transparent text-sm font-mono font-bold nodrag text-gray-900 dark:text-gray-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
        </div>
      )}

      {mode === 'end' && (
        <div className="w-full flex-1 flex flex-col items-center justify-center px-3 pb-1 pointer-events-none select-none">
          <DragHandle />
          <span className="w-full text-center text-sm font-mono font-bold text-gray-900 dark:text-gray-100 block mt-1">
            {data.label || `END${entityType}`}
          </span>
        </div>
      )}

      {mode !== 'end' && <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-2 !h-2 ${handleClass}`} />}
    </div>
  );
};

const ActionNode = ({ id, data, selected }) => {
  const isGray = data.colorMode === false;
  const bgClass = isGray ? 'bg-gray-50 dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/30';
  const baseBorder = isGray ? 'border-gray-400 dark:border-gray-600' : 'border-blue-300 dark:border-blue-700';
  const handleClass = isGray ? '!bg-gray-400' : '!bg-blue-600';
  
  const highlightClass = data.externalHighlight ? extHighlightClass : getSelectClass(selected, baseBorder);

  return (
    <div className={`${bgClass} border-2 p-2 min-w-[100px] min-h-[50px] flex flex-col rounded-md relative transition-all ${highlightClass}`}>
      <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />
      <Handle type="target" position={Position.Left} id="t-left" className="!w-2 !h-2 !bg-transparent !border-none absolute" />
      <Handle type="target" position={Position.Right} id="t-right" className="!w-2 !h-2 !bg-transparent !border-none absolute" />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className="!w-2 !h-2 !bg-transparent !border-none absolute" />
      <DragHandle />
      <textarea rows={1} defaultValue={data.label} onChange={data.onChange} onInput={handleInputResize} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-full flex-1 text-center outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden text-gray-900 dark:text-gray-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-2 !h-2 ${handleClass}`} />
    </div>
  );
};

const IONode = ({ id, data, selected }) => {
  const isExt = data.externalHighlight;
  const isSel = selected;
  const isGray = data.colorMode === false;

  const fillClass = isGray ? 'fill-gray-50 dark:fill-gray-800' : 'fill-emerald-50 dark:fill-emerald-900/30';
  const defaultStroke = isGray ? 'text-gray-400 dark:text-gray-600' : 'text-emerald-400 dark:text-emerald-700';
  const handleClass = isGray ? '!bg-gray-400' : '!bg-emerald-600';
  const strokeClass = isExt ? 'text-emerald-500' : (isSel ? 'text-indigo-600 dark:text-indigo-500' : defaultStroke);

  return (
    <div className={`relative min-w-[120px] min-h-[50px] flex flex-col transition-all`}>
      <svg className={`absolute inset-0 w-full h-full pointer-events-none -z-10 ${strokeClass}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon points="15,2 98,2 85,98 2,98" className={fillClass} stroke="currentColor" strokeWidth={isSel || isExt ? "4" : "2"} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />
      <Handle type="target" position={Position.Left} id="t-left" className="!w-2 !h-2 !bg-transparent !border-none absolute" />
      <Handle type="target" position={Position.Right} id="t-right" className="!w-2 !h-2 !bg-transparent !border-none absolute" />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className="!w-2 !h-2 !bg-transparent !border-none absolute" />
      
      <div className="pt-2 z-10"><DragHandle /></div>
      <textarea rows={1} defaultValue={data.label} onChange={data.onChange} onInput={handleInputResize} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-full flex-1 text-center outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden px-6 z-10 text-gray-900 dark:text-gray-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-2 !h-2 ${handleClass}`} />
    </div>
  );
};

const ConditionNode = ({ id, data, selected }) => {
  const edges = useEdges();
  const outEdges = edges.filter(e => e.source === id).length;
  const hasWarning = outEdges === 1;

  const isExt = data.externalHighlight;
  const isSel = selected;
  const isGray = data.colorMode === false;

  const fillClass = isGray ? 'fill-gray-50 dark:fill-gray-800' : (hasWarning ? 'fill-red-50 dark:fill-red-900/20' : 'fill-orange-50 dark:fill-orange-900/30');
  const defaultStroke = isGray ? 'text-gray-400 dark:text-gray-600' : 'text-orange-400 dark:text-orange-700';
  const handleClass = isGray ? '!bg-gray-400' : '!bg-orange-600';
  const strokeClass = isExt ? 'text-emerald-500' : (isSel ? 'text-indigo-600 dark:text-indigo-500' : defaultStroke);
  
  const pref = edgeLabels[data.edgeStyle || 'true-false'];
  const tChar = pref.t.charAt(0).toUpperCase();
  const fChar = pref.f.charAt(0).toUpperCase();

  const bottomEdge = edges.find(e => e.source === id && e.sourceHandle === 's-bottom');
  const rightEdge = edges.find(e => e.source === id && e.sourceHandle === 's-right');

  let isBottomTrue = true;
  if (bottomEdge && bottomEdge.data?.label) {
      const lbl = bottomEdge.data.label;
      isBottomTrue = (lbl === pref.t || lbl === 'Ano' || lbl === '+' || lbl === 'Yes' || lbl === 'True');
  }

  let isRightTrue = false;
  if (rightEdge && rightEdge.data?.label) {
      const lbl = rightEdge.data.label;
      isRightTrue = (lbl === pref.t || lbl === 'Ano' || lbl === '+' || lbl === 'Yes' || lbl === 'True');
  }

  const bottomChar = isBottomTrue ? tChar : fChar;
  const rightChar = isRightTrue ? tChar : fChar;
  
  const bottomBorderColor = isGray ? '!border-gray-500 !text-gray-600' : (isBottomTrue ? '!border-green-500 !text-green-600' : '!border-red-500 !text-red-600');
  const rightBorderColor = isGray ? '!border-gray-500 !text-gray-600' : (isRightTrue ? '!border-green-500 !text-green-600' : '!border-red-500 !text-red-600');

  return (
    <div className={`relative flex flex-col items-center justify-center min-w-[120px] min-h-[60px] transition-all`}>
      <svg className={`absolute inset-0 w-full h-full pointer-events-none -z-10 ${strokeClass}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon points="15,2 85,2 98,50 85,98 15,98 2,50" className={fillClass} stroke="currentColor" strokeWidth={isSel || isExt ? "4" : "2"} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />
      <Handle type="target" position={Position.Left} id="t-left" className="!w-2 !h-2 !bg-transparent !border-none absolute" />
      <Handle type="target" position={Position.Right} id="t-right" className="!w-2 !h-2 !bg-transparent !border-none absolute" />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className="!w-2 !h-2 !bg-transparent !border-none absolute" />

      <div className="absolute top-1 z-10"><DragHandle /></div>
      <textarea rows={1} defaultValue={data.label} onChange={data.onChange} onInput={handleInputResize} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`min-w-[70px] max-w-[100px] text-center outline-none bg-transparent text-sm font-mono nodrag mt-2 z-10 resize-none overflow-hidden text-gray-900 dark:text-gray-100 px-1 ${hasWarning ? 'text-red-700 dark:text-red-400 font-bold' : ''} ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
      
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-white dark:!bg-gray-800 !border-2 ${bottomBorderColor} !text-[10px] !font-bold flex items-center justify-center !rounded-sm z-20 cursor-crosshair leading-none p-0`}>{bottomChar}</Handle>
      <Handle type="source" position={Position.Right} id="s-right" className={`!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-white dark:!bg-gray-800 !border-2 ${rightBorderColor} !text-[10px] !font-bold flex items-center justify-center !rounded-sm z-20 cursor-crosshair leading-none p-0`}>{rightChar}</Handle>
    </div>
  );
};

const CommentNode = ({ id, data, selected }) => {
  const isGray = data.colorMode === false;
  const bgClass = isGray ? 'bg-gray-50 dark:bg-gray-800' : 'bg-yellow-50 dark:bg-yellow-900/30';
  const borderClass = isGray ? 'border-gray-400 dark:border-gray-600' : 'border-yellow-300 dark:border-yellow-700';
  const highlightClass = data.externalHighlight ? extHighlightClass : getSelectClass(selected, borderClass);

  return (
    <div className={`${bgClass} border-2 p-2 min-w-[160px] flex flex-col rounded-md relative transition-all ${highlightClass}`}>
      <DragHandle />
      <textarea rows={1} defaultValue={data.label} onChange={data.onChange} onInput={handleInputResize} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-full flex-1 outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden text-gray-700 dark:text-yellow-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} style={{ minHeight: '30px' }} />
    </div>
  );
};

const MergeNode = () => (
    <div className="w-2 h-2 bg-transparent pointer-events-none">
        <Handle type="target" position={Position.Top} id="t-top" className="opacity-0" />
        <Handle type="target" position={Position.Right} id="t-right" className="opacity-0" />
        <Handle type="target" position={Position.Left} id="t-left" className="opacity-0" />
        <Handle type="source" position={Position.Bottom} id="s-bottom" className="opacity-0" />
    </div>
);

const nodeTypes = { ACTION: ActionNode, IO: IONode, CONDITION: ConditionNode, START_END: StartEndNode, COMMENT: CommentNode, MERGE: MergeNode, GROUP_BG: GroupBgNode };
const edgeTypes = { customEdge: CustomEdge };

function EditorCanvas({ xml, onXmlChange, readOnly, edgeStyle, colorMode, groupColoring, onSelectionChange, externalSelectedIds, onPaneClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [clipboard, setClipboard] = useState({ nodes: [], edges: [] });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  
  const hoveredEdgeRef = useRef(null);
  const lastXmlRef = useRef(''); 

  const selectedNodes = nodes.filter(n => n.selected);
  const selectedEdges = edges.filter(e => e.selected);

  const mappedNodes = useMemo(() => {
    return nodes.map(n => ({
        ...n,
        zIndex: 10,
        data: { 
            ...n.data, 
            colorMode, 
            externalHighlight: externalSelectedIds?.includes(n.id) 
        }
    }));
  }, [nodes, colorMode, externalSelectedIds]);

  const bgNodes = useMemo(() => calculateGroupNodes(nodes, edges, groupColoring), [nodes, edges, groupColoring]);
  const allNodes = useMemo(() => [...bgNodes, ...mappedNodes], [bgNodes, mappedNodes]);

  useEffect(() => {
    setNodes(nds => nds.map(n => {
        if (n.type === 'CONDITION' && n.data.edgeStyle !== edgeStyle) {
            return { ...n, data: { ...n.data, edgeStyle } };
        }
        return n;
    }));

    setEdges(eds => eds.map(e => {
      const isPositive = ['+', 'Ano', 'Yes', 'True'].includes(e.data?.label);
      const isNegative = ['-', 'Ne', 'No', 'False'].includes(e.data?.label);
      if (isPositive || isNegative) {
          const pref = edgeLabels[edgeStyle || 'true-false'];
          const newLabel = isPositive ? pref.t : pref.f;
          if (e.data?.label !== newLabel || e.data?.edgeStyle !== edgeStyle) {
              return { ...e, data: { ...e.data, label: newLabel, edgeStyle } };
          }
      } else if (e.data?.edgeStyle !== edgeStyle) {
          return { ...e, data: { ...e.data, edgeStyle } };
      }
      return e;
    }));
  }, [edgeStyle, setNodes, setEdges]);

  const executeDelete = useCallback(() => {
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const selectedEdgeIds = new Set(selectedEdges.map(e => e.id));
    
    setNodes(nds => nds.filter(n => !selectedNodeIds.has(n.id)));
    setEdges(eds => eds.filter(e => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
    setDeleteConfirm(false);
  }, [selectedNodes, selectedEdges, setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (readOnly) return;

      if (deleteConfirm) {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeDelete();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDeleteConfirm(false);
        }
        return;
      }

      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (isInput) e.target.blur();
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        setEdges(eds => eds.map(edge => ({ ...edge, selected: false })));
        setContextMenu(null);
        setShowExportMenu(false);
        if (onPaneClick) onPaneClick();
        return;
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInput) return;
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          e.preventDefault();
          setDeleteConfirm(true);
        }
      }
      if (e.key === 'F2') {
        if (selectedNodes.length === 1) {
          e.preventDefault();
          const inputEl = document.getElementById(`input-${selectedNodes[0].id}`) || document.querySelector(`.react-flow__node[data-id="${selectedNodes[0].id}"] textarea`);
          if (inputEl) {
            setTimeout(() => { inputEl.focus(); inputEl.select(); }, 10);
            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
          }
        }
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        if (isInput) return;
        e.preventDefault();
        setNodes(nds => nds.map(n => ({ ...n, selected: true })));
        setEdges(eds => eds.map(edge => ({ ...edge, selected: true })));
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        if (isInput) return;
        e.preventDefault();
        handleCopy();
      }
      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        if (isInput) return;
        e.preventDefault();
        handlePaste();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes, selectedEdges, clipboard, readOnly, deleteConfirm, executeDelete, onPaneClick]);

  const getHitEdge = (event, node, draggedNodes) => {
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    if (!clientX || !clientY) return null;

    const originalStyles = [];
    draggedNodes.forEach(n => {
        const el = document.querySelector(`.react-flow__node[data-id="${n.id}"]`);
        if (el) {
            originalStyles.push({ el, val: el.style.visibility });
            el.style.visibility = 'hidden';
        }
    });

    let foundEdge = null;
    for (let dx = -40; dx <= 40; dx += 20) {
        for (let dy = -40; dy <= 40; dy += 20) {
            const elemBelow = document.elementFromPoint(clientX + dx, clientY + dy);
            const closestEdge = elemBelow?.closest('.react-flow__edge');
            if (closestEdge) {
                foundEdge = closestEdge;
                break;
            }
        }
        if (foundEdge) break;
    }

    originalStyles.forEach(({ el, val }) => { el.style.visibility = val; });
    return foundEdge;
  };

  const onNodeDrag = useCallback((event, node) => {
    if (readOnly) return;
    setContextMenu(null);
    setShowExportMenu(false);

    let draggedNodes = nodes.filter(n => n.selected && n.type !== 'GROUP_BG');
    if (draggedNodes.length === 0) draggedNodes = [node];
    
    if (draggedNodes.some(n => n.type === 'COMMENT' || n.type === 'GROUP_BG')) return;

    const draggedIds = new Set(draggedNodes.map(n => n.id));
    const hasExternal = edges.some(e => 
        (draggedIds.has(e.source) && !draggedIds.has(e.target)) || 
        (draggedIds.has(e.target) && !draggedIds.has(e.source))
    );
    if (hasExternal) return;

    const edgeElem = getHitEdge(event, node, draggedNodes);
    
    if (hoveredEdgeRef.current && hoveredEdgeRef.current !== edgeElem) {
        hoveredEdgeRef.current.classList.remove('drop-target');
        hoveredEdgeRef.current = null;
    }

    if (edgeElem && hoveredEdgeRef.current !== edgeElem) {
        edgeElem.classList.add('drop-target');
        hoveredEdgeRef.current = edgeElem;
    }
  }, [edges, nodes, readOnly]);

  const onNodeDragStop = useCallback((event, node) => {
    if (readOnly) return;
    
    if (hoveredEdgeRef.current) {
        hoveredEdgeRef.current.classList.remove('drop-target');
        hoveredEdgeRef.current = null;
    }

    let draggedNodes = nodes.filter(n => n.selected && n.type !== 'GROUP_BG');
    if (draggedNodes.length === 0) draggedNodes = [node];
    
    if (draggedNodes.some(n => n.type === 'COMMENT' || n.type === 'GROUP_BG')) return;

    const draggedIds = new Set(draggedNodes.map(n => n.id));
    const hasExternal = edges.some(e => 
        (draggedIds.has(e.source) && !draggedIds.has(e.target)) || 
        (draggedIds.has(e.target) && !draggedIds.has(e.source))
    );
    if (hasExternal) return;

    const edgeElem = getHitEdge(event, node, draggedNodes);

    if (edgeElem) {
        const edgeId = edgeElem.getAttribute('data-id');
        const targetEdge = edges.find(e => e.id === edgeId);
        
        if (targetEdge) {
            draggedNodes.sort((a, b) => a.position.y - b.position.y);
            const firstNode = draggedNodes[0];
            const lastNode = draggedNodes[draggedNodes.length - 1];

            setEdges(eds => {
                const filtered = eds.filter(e => e.id !== targetEdge.id);
                
                const newInternalEdges = [];
                for (let i = 0; i < draggedNodes.length - 1; i++) {
                    const curr = draggedNodes[i];
                    const next = draggedNodes[i+1];
                    const exists = eds.find(e => e.source === curr.id && e.target === next.id);
                    if (!exists) {
                        newInternalEdges.push({
                            id: `e_${Date.now()}_int_${i}`,
                            source: curr.id,
                            target: next.id,
                            sourceHandle: 's-bottom',
                            targetHandle: 't-top',
                            type: 'customEdge',
                            data: { edgeStyle },
                            markerEnd: { type: MarkerType.ArrowClosed }
                        });
                    }
                }

                const newEdge1 = {
                    id: `e_${Date.now()}_1`,
                    source: targetEdge.source,
                    target: firstNode.id,
                    sourceHandle: targetEdge.sourceHandle,
                    targetHandle: 't-top',
                    type: 'customEdge',
                    data: targetEdge.data,
                    markerEnd: { type: MarkerType.ArrowClosed }
                };

                const pref = edgeLabels[edgeStyle || 'true-false'];
                let outLabel = '';
                if (lastNode.type === 'CONDITION') outLabel = pref.t;

                const newEdge2 = {
                    id: `e_${Date.now()}_2`,
                    source: lastNode.id,
                    target: targetEdge.target,
                    sourceHandle: 's-bottom',
                    targetHandle: targetEdge.targetHandle,
                    type: 'customEdge',
                    data: { label: outLabel, edgeStyle },
                    markerEnd: { type: MarkerType.ArrowClosed }
                };

                return [...filtered, newEdge1, ...newInternalEdges, newEdge2];
            });
        }
    }
  }, [edges, nodes, setEdges, edgeStyle, readOnly]);

  const handleCopy = () => { 
    if (selectedNodes.length > 0) {
      const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
      const edgesToCopy = edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));
      setClipboard({ nodes: selectedNodes, edges: edgesToCopy });
    }
  };

  const handlePaste = () => {
    if (clipboard.nodes.length === 0) return;
    
    const idMap = {};
    const newNodes = clipboard.nodes.map(n => {
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      idMap[n.id] = newId;
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 30, y: n.position.y + 30 },
        selected: true,
        data: { ...n.data, onChange: (e) => updateNodeLabel(newId, e.target.value) }
      };
    });

    const newEdges = clipboard.edges.map(e => ({
      ...e,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      source: idMap[e.source],
      target: idMap[e.target],
      selected: true
    }));

    setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
    setEdges(eds => eds.map(e => ({ ...e, selected: false })).concat(newEdges));
  };

  const handleDuplicate = () => {
      handleCopy();
      setTimeout(handlePaste, 10);
  };

  const updateNodeData = useCallback((nodeId, newData) => {
    setNodes((nds) => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
  }, [setNodes]);

  const updateNodeLabel = useCallback((nodeId, newLabel) => {
    updateNodeData(nodeId, { label: newLabel });
  }, [updateNodeData]);

  useEffect(() => {
    if (xml && xml !== lastXmlRef.current) {
      lastXmlRef.current = xml;
      const { nodes: parsedNodes, edges: parsedEdges } = drawioToReactFlow(xml);
      
      setNodes(prev => parsedNodes.map(n => {
          const old = prev.find(p => p.id === n.id);
          return { 
              ...n, 
              selected: old ? old.selected : false,
              data: { ...n.data, readOnly, edgeStyle, onChange: (e) => updateNodeLabel(n.id, e.target.value) } 
          };
      }));
      
      setEdges(prev => parsedEdges.map(e => {
          const old = prev.find(p => p.id === e.id);
          return { 
              ...e, 
              selected: old ? old.selected : false,
              data: { ...e.data, readOnly, edgeStyle }, 
              markerEnd: { type: MarkerType.ArrowClosed } 
          };
      }));
    }
  }, [xml, readOnly, edgeStyle, setNodes, setEdges, updateNodeLabel]);

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const timer = setTimeout(() => {
        const exportNodes = nodes.filter(n => n.type !== 'GROUP_BG');
        const generatedXml = reactFlowToDrawio(exportNodes, edges);
        if (generatedXml !== lastXmlRef.current) {
            lastXmlRef.current = generatedXml;
            onXmlChange(generatedXml);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, onXmlChange]);

  const isValidConnection = useCallback((connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    const sourceEdges = edges.filter(e => e.source === connection.source);

    if (targetNode?.type === 'START_END' && targetNode.data?.mode === 'start') return false;
    if (sourceNode?.type === 'START_END' && sourceNode.data?.mode === 'end') return false;

    if (targetNode?.type === 'START_END' && targetNode.data?.mode === 'end' && connection.targetHandle !== 't-top') return false;

    if (sourceNode?.type === 'CONDITION') {
      if (sourceEdges.length >= 2) return false;
    } else {
      if (sourceEdges.length >= 1) return false;
    }
    
    const isBackEdge = targetNode.position.y <= sourceNode.position.y;
    if (isBackEdge) {
        let hasConditionAncestor = false;
        let currentIds = [sourceNode.id];
        let visitedAncestors = new Set();
        
        while(currentIds.length > 0) {
            let nextIds = [];
            for (let cid of currentIds) {
                if (visitedAncestors.has(cid)) continue;
                visitedAncestors.add(cid);
                
                const n = nodes.find(x => x.id === cid);
                if (n && n.type === 'CONDITION') {
                    hasConditionAncestor = true;
                    break;
                }
                
                const incomingEdges = edges.filter(e => e.target === cid);
                nextIds.push(...incomingEdges.map(e => e.source));
            }
            if (hasConditionAncestor) break;
            currentIds = nextIds;
        }
        
        if (!hasConditionAncestor) return false;
    }

    return true;
  }, [nodes, edges]);

  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);

    if (sourceNode?.type === 'START_END' && sourceNode.data?.mode === 'unassigned') {
        updateNodeData(params.source, { mode: 'start', label: 'main' });
    }
    if (targetNode?.type === 'START_END' && targetNode.data?.mode === 'unassigned') {
        updateNodeData(params.target, { mode: 'end', label: 'ENDFUNCTION' });
    }

    if (sourceNode?.type === 'CONDITION') {
      const pref = edgeLabels[edgeStyle || 'true-false'];
      let lbl = params.sourceHandle === 's-right' ? pref.f : pref.t;
      setEdges((eds) => addEdge({ ...params, type: 'customEdge', data: { label: lbl, edgeStyle }, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    } else {
      setEdges((eds) => addEdge({ ...params, type: 'customEdge', data: { edgeStyle }, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    }
  }, [nodes, edges, setEdges, edgeStyle, updateNodeData]);

  const addNodeAt = (type, label, clientPos = null) => {
    if (readOnly) return;
    const id = Date.now().toString();
    
    let position;
    if (clientPos) {
        position = screenToFlowPosition({ x: clientPos.mouseX, y: clientPos.mouseY });
    } else {
        const reactFlowBounds = document.querySelector('.react-flow').getBoundingClientRect();
        position = screenToFlowPosition({
            x: reactFlowBounds.left + reactFlowBounds.width / 2,
            y: reactFlowBounds.top + reactFlowBounds.height / 2,
        });
    }

    let extraData = {};
    if (type === 'START_END') extraData = { mode: 'unassigned', entityType: 'FUNCTION' };
    
    setNodes((nds) => nds.concat({ id, type, position, selected: false, data: { label, readOnly, ...extraData, onChange: (e) => updateNodeLabel(id, e.target.value) } }));
  };

  const handlePaneContextMenu = useCallback((e) => {
    if (readOnly) return;
    e.preventDefault();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
  }, [readOnly]);

  const handleExportEduCode = () => {
    setShowExportMenu(false);
    const dataStr = "data:text/xml;charset=utf-8," + encodeURIComponent(xml);
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'educode_diagram.xml';
    a.click();
  };

  const handleExportDrawioStandard = () => {
    setShowExportMenu(false);
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");
      doc.querySelectorAll('mxCell').forEach(cell => {
          cell.removeAttribute('type');
          cell.removeAttribute('mode');
          cell.removeAttribute('entityType');
          cell.removeAttribute('edgeStyle');
      });
      const cleanXml = new XMLSerializer().serializeToString(doc);
      const dataStr = "data:text/xml;charset=utf-8," + encodeURIComponent(cleanXml);
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = 'standard_diagram.drawio';
      a.click();
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => onXmlChange(event.target.result);
    reader.readAsText(file);
  };

  const btnColor = colorMode ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400";
  const btnClass = `p-2 rounded transition-opacity disabled:opacity-25 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 ${btnColor}`;

  return (
    <div className="w-full h-full relative outline-none" tabIndex={0} onClick={() => { setContextMenu(null); setShowExportMenu(false); }}>
      <style>{`
        .react-flow__edge.drop-target .react-flow__edge-path {
          stroke: #4f46e5 !important;
          stroke-width: 4px !important;
          filter: drop-shadow(0 0 6px rgba(79,70,229,0.5));
          transition: all 0.2s ease;
        }
      `}</style>
      
      {deleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-sm rounded-lg">
          <div className="bg-white p-4 rounded shadow-lg border border-gray-200">
            <h3 className="font-bold mb-2">Smazat vybrané prvky?</h3>
            <p className="text-sm text-gray-600 mb-4">Opravdu chcete odstranit {selectedNodes.length + selectedEdges.length} prvků?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Zrušit (Esc)</button>
              <button onClick={executeDelete} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">Smazat (Enter)</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => e.preventDefault()} />
            <div className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl flex flex-col py-1 min-w-[160px]" style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}>
                <div className="px-3 py-1.5 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 mb-1">Přidat blok</div>
                <button onClick={() => { addNodeAt('START_END', '', contextMenu); setContextMenu(null); }} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><Circle size={14} className={colorMode ? "text-fuchsia-500" : "text-gray-500"}/> Start/End</button>
                <button onClick={() => { addNodeAt('ACTION', 'Operace', contextMenu); setContextMenu(null); }} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><Square size={14} className={colorMode ? "text-blue-500" : "text-gray-500"}/> Akce</button>
                <button onClick={() => { addNodeAt('IO', 'Vstup', contextMenu); setContextMenu(null); }} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><AlignLeft size={14} className={colorMode ? "text-emerald-500" : "text-gray-500"} style={{transform:'skew(-15deg)'}}/> Vstup/Výstup</button>
                <button onClick={() => { addNodeAt('CONDITION', 'x > 0', contextMenu); setContextMenu(null); }} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><Diamond size={14} className={colorMode ? "text-orange-500" : "text-gray-500"}/> Podmínka</button>
                <button onClick={() => { addNodeAt('COMMENT', '# Komentář', contextMenu); setContextMenu(null); }} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><MessageSquare size={14} className={colorMode ? "text-yellow-500" : "text-gray-500"}/> Komentář</button>
            </div>
        </>
      )}

      <div className="absolute top-4 left-4 z-10 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 dark:border-gray-700">
        <button onClick={() => addNodeAt('START_END', '')} disabled={readOnly} className={btnClass} title="Start / Konec (kolečko)"><Circle size={18} className={colorMode ? "text-fuchsia-600" : ""} /></button>
        <button onClick={() => addNodeAt('ACTION', 'Operace')} disabled={readOnly} className={btnClass} title="Akce / Operace (čtverec)"><Square size={18} className={colorMode ? "text-blue-600" : ""} /></button>
        <button onClick={() => addNodeAt('IO', 'Vstup')} disabled={readOnly} className={btnClass} title="Vstup / Výstup (kosodélník)"><AlignLeft size={18} className={colorMode ? "text-emerald-600" : ""} style={{transform: 'skew(-15deg)'}} /></button>
        <button onClick={() => addNodeAt('CONDITION', 'x > 0')} disabled={readOnly} className={btnClass} title="Podmínka / Cyklus (hexagon)"><Diamond size={18} className={colorMode ? "text-orange-600" : ""} /></button>
        <button onClick={() => addNodeAt('COMMENT', '# Komentář')} disabled={readOnly} className={btnClass} title="Komentář"><MessageSquare size={18} className={colorMode ? "text-yellow-600" : ""} /></button>
      </div>

      {(selectedNodes.length > 0 || selectedEdges.length > 0) && !readOnly && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-2 bg-indigo-600 p-1.5 rounded-lg shadow-lg">
           <button onClick={handleDuplicate} className="flex items-center gap-1 text-white hover:bg-indigo-500 px-3 py-1.5 rounded text-sm font-medium"><Copy size={16}/> Duplikovat</button>
           <div className="w-px bg-indigo-400 mx-1"></div>
           <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-1 text-red-100 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded text-sm font-medium"><Trash2 size={16}/> Smazat</button>
        </div>
      )}

      {/* Opravené pořadí tlačítek (Import vlevo, Export vpravo) podle tvých instrukcí */}
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 dark:border-gray-700">
        <label className={`p-2 rounded cursor-pointer text-gray-700 dark:text-gray-300 ${readOnly ? 'opacity-25 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} title="Import">
          <Upload size={18}/>
          <input type="file" accept=".xml,.drawio,.json" className="hidden" onChange={handleImport} disabled={readOnly} />
        </label>
        <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors" title="Export"><Download size={18}/></button>
            {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 flex flex-col py-1">
                    <button onClick={handleExportEduCode} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><FileJson size={14} className="text-indigo-500"/> EduCode (.xml)</button>
                    <button onClick={handleExportDrawioStandard} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><FileCode size={14} className="text-orange-500"/> Draw.io (.drawio)</button>
                </div>
            )}
        </div>
      </div>

      <div className="w-full h-full" onContextMenu={handlePaneContextMenu}>
        <ReactFlow 
          nodes={allNodes} edges={edges} 
          onNodesChange={readOnly ? undefined : onNodesChange} 
          onEdgesChange={readOnly ? undefined : onEdgesChange} 
          onConnect={readOnly ? undefined : onConnect} 
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={() => { setContextMenu(null); setShowExportMenu(false); if (onPaneClick) onPaneClick(); }}
          onSelectionChange={({ nodes }) => {
              if (onSelectionChange) onSelectionChange(nodes.filter(n => n.type !== 'GROUP_BG').map(n => n.id));
          }}
          isValidConnection={isValidConnection} 
          nodeTypes={nodeTypes} edgeTypes={edgeTypes} 
          defaultEdgeOptions={{ type: 'customEdge', markerEnd: { type: MarkerType.ArrowClosed } }}
          fitView deleteKeyCode={null} selectionOnDrag={true} panOnDrag={[1, 2]} panOnScroll={true} selectionMode="partial" multiSelectionKeyCode="Control"
          elementsSelectable={!readOnly}
        >
          <Background color="#ccc" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function DiagramEditor(props) {
  return <ReactFlowProvider><EditorCanvas {...props} /></ReactFlowProvider>;
}