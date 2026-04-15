import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, addEdge, useNodesState, useEdgesState, Controls, Background, Handle, Position, MarkerType, BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, useNodeId, useEdges, useNodes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, Upload, Square, Circle, Diamond, AlignLeft, RefreshCcw, Copy, Trash2, MessageSquare } from 'lucide-react';
import { drawioToReactFlow, reactFlowToDrawio } from '../utils/diagramConverter';

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
  
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  const onSwap = (e) => {
    e.stopPropagation();
    if (data?.readOnly) return;
    
    setEdges(eds => {
      const sibling = eds.find(edge => edge.source === source && edge.id !== id);
      const pref = edgeLabels[data.edgeStyle || '+-'];
      
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

  const labelText = data?.label || '+';
  const pref = edgeLabels[data.edgeStyle || '+-'];
  const isPositive = labelText === pref.t || labelText === 'Ano' || labelText === '+' || labelText === 'Yes' || labelText === 'True';

  return (
    <>
      <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={30} className="react-flow__edge-interaction cursor-crosshair" />
      {/* Pokud míří do MERGE, schováme šipku, aby se nepřeplácávala (jako v Draw.io) */}
      <BaseEdge path={edgePath} markerEnd={isTargetMerge ? undefined : markerEnd} className={`react-flow__edge-path custom-edge-${id} ${selected ? "!stroke-indigo-600" : "!stroke-gray-800 dark:!stroke-gray-400"}`} style={{ strokeWidth: selected ? 3 : 2 }} />
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

const getSelectClass = (selected) => selected ? 'ring-4 ring-indigo-400 border-indigo-600 dark:border-indigo-400' : 'border-gray-800 dark:border-gray-400';
const getInputClass = (selected, readOnly) => `w-full flex-1 text-center outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden text-gray-800 dark:text-gray-100 ${selected && !readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`;

const handleInputMouseDown = (e, selected) => {
  if (!selected && document.activeElement !== e.target) e.preventDefault();
};

const StartEndNode = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  
  let mode = data.mode || 'unassigned';
  let entityType = data.entityType || 'FUNCTION';

  const setMode = (newMode) => {
    let newLabel = data.label;
    if (newMode === 'start' && !newLabel) {
       newLabel = 'main';
    }
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, mode: newMode, label: newLabel } } : n));
  };

  const toggleEntity = () => {
    if(data.readOnly) return;
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, entityType: entityType === 'FUNCTION' ? 'CLASS' : 'FUNCTION' } } : n));
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border-2 rounded-[2rem] min-w-[140px] min-h-[60px] flex flex-col justify-center items-center shadow-sm p-2 transition-all relative ${getSelectClass(selected)}`}>
      {mode !== 'start' && <Handle type="target" position={Position.Top} id="t-top" className="!w-2 !h-2 !bg-indigo-600" />}
      
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
            <span className="text-[9px] text-gray-400 font-bold w-12 text-left">START</span>
            <div className="custom-drag-handle w-8 h-1.5 cursor-grab bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors" title="Chytit a přesunout" />
            <span onClick={toggleEntity} className={`text-[9px] text-gray-400 font-bold w-12 text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 ${data.readOnly ? 'pointer-events-none' : 'pointer-events-auto'}`}>{entityType}</span>
          </div>
          <input id={`input-${id}`} defaultValue={data.label} onChange={data.onChange} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-full flex-1 text-center outline-none bg-transparent text-sm font-mono font-bold nodrag text-gray-800 dark:text-gray-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
        </div>
      )}

      {mode === 'end' && (
        <>
          <DragHandle />
          <div className="w-full flex-1 flex flex-col items-center justify-center px-3 pb-1 pointer-events-none select-none">
            <span className="w-full text-center text-sm font-mono font-bold text-gray-800 dark:text-gray-100 block mt-1">
              {data.label || `END${entityType}`}
            </span>
          </div>
        </>
      )}
      {mode !== 'end' && <Handle type="source" position={Position.Bottom} id="s-bottom" className="!w-2 !h-2 !bg-indigo-600" />}
    </div>
  );
};

const ActionNode = ({ id, data, selected }) => (
  <div className={`bg-white dark:bg-gray-800 border-2 p-2 min-w-[120px] min-h-[60px] flex flex-col shadow-sm rounded-md relative transition-all ${getSelectClass(selected)}`}>
    <Handle type="target" position={Position.Top} id="t-top" className="!w-2 !h-2 !bg-indigo-600" />
    <DragHandle />
    <textarea id={`input-${id}`} defaultValue={data.label} onChange={data.onChange} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={getInputClass(selected, data.readOnly)} />
    <Handle type="source" position={Position.Bottom} id="s-bottom" className="!w-2 !h-2 !bg-indigo-600" />
  </div>
);

const IONode = ({ id, data, selected }) => (
  <div className="relative min-w-[140px] min-h-[60px] flex flex-col shadow-sm">
    <svg className={`absolute inset-0 w-full h-full pointer-events-none -z-10 ${selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-400'}`} preserveAspectRatio="none" viewBox="0 0 100 100">
      <polygon points="15,2 98,2 85,98 2,98" className="fill-white dark:fill-gray-800" stroke="currentColor" strokeWidth={selected ? "4" : "2"} vectorEffect="non-scaling-stroke" />
    </svg>
    <Handle type="target" position={Position.Top} id="t-top" className="!w-2 !h-2 !bg-indigo-600" />
    <div className="pt-2 z-10"><DragHandle /></div>
    <textarea id={`input-${id}`} defaultValue={data.label} onChange={data.onChange} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`${getInputClass(selected, data.readOnly)} px-6 z-10`} />
    <Handle type="source" position={Position.Bottom} id="s-bottom" className="!w-2 !h-2 !bg-indigo-600" />
  </div>
);

const ConditionNode = ({ id, data, selected }) => {
  const edges = useEdges();
  const outEdges = edges.filter(e => e.source === id).length;
  const hasWarning = outEdges === 1;

  let textColor = selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-400';
  if (hasWarning && !selected) textColor = 'text-red-500';

  return (
    <div className="relative w-28 h-28 flex flex-col items-center justify-center shadow-sm">
      <svg className={`absolute inset-0 w-full h-full pointer-events-none -z-10 ${textColor}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon points="50,2 98,50 50,98 2,50" className={hasWarning ? 'fill-red-50 dark:fill-red-900/20' : 'fill-white dark:fill-gray-800'} stroke="currentColor" strokeWidth={selected ? "4" : "2"} vectorEffect="non-scaling-stroke" />
      </svg>
      <Handle type="target" position={Position.Top} id="t-top" className="!w-2 !h-2 !bg-indigo-600" />
      <Handle type="target" position={Position.Left} id="t-left" className="!w-2 !h-2 !bg-transparent !border-none absolute" />
      <Handle type="target" position={Position.Right} id="t-right" className="!w-2 !h-2 !bg-transparent !border-none absolute" />

      <div className="absolute top-6 z-10"><DragHandle /></div>
      <input id={`input-${id}`} defaultValue={data.label} onChange={data.onChange} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-16 text-center outline-none bg-transparent text-xs font-mono nodrag mt-2 z-10 text-gray-800 dark:text-gray-100 ${hasWarning ? 'text-red-700 dark:text-red-400 font-bold' : ''} ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
      
      <Handle type="source" position={Position.Bottom} id="s-bottom" className="!w-2 !h-2 !bg-indigo-600" />
      <Handle type="source" position={Position.Right} id="s-right" className="!w-2 !h-2 !bg-indigo-600" />
    </div>
  );
};

const CommentNode = ({ id, data, selected }) => {
  const adjustHeight = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = (e.target.scrollHeight) + 'px';
  };

  return (
    <div className={`bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 p-2 min-w-[140px] flex flex-col shadow-sm rounded-md relative transition-all ${selected ? 'ring-4 ring-yellow-400 dark:ring-yellow-600' : ''}`}>
      <DragHandle />
      <textarea 
        id={`input-${id}`} 
        defaultValue={data.label} 
        onChange={(e) => { adjustHeight(e); data.onChange(e); }} 
        onFocus={adjustHeight}
        onMouseDown={(e) => handleInputMouseDown(e, selected)} 
        readOnly={data.readOnly} 
        className={`w-full flex-1 outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden text-gray-700 dark:text-yellow-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} 
        style={{ minHeight: '30px' }}
      />
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

const nodeTypes = { ACTION: ActionNode, IO: IONode, CONDITION: ConditionNode, START_END: StartEndNode, COMMENT: CommentNode, MERGE: MergeNode };
const edgeTypes = { customEdge: CustomEdge };

function EditorCanvas({ xml, onXmlChange, readOnly, edgeStyle, onSelectionChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [clipboard, setClipboard] = useState({ nodes: [], edges: [] });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  
  const hoveredEdgeRef = useRef(null);
  const lastXmlRef = useRef(''); 

  const selectedNodes = nodes.filter(n => n.selected);
  const selectedEdges = edges.filter(e => e.selected);

  useEffect(() => {
    setEdges(eds => eds.map(e => {
      const isPositive = ['+', 'Ano', 'Yes', 'True'].includes(e.data?.label);
      const isNegative = ['-', 'Ne', 'No', 'False'].includes(e.data?.label);
      if (isPositive || isNegative) {
          const pref = edgeLabels[edgeStyle || '+-'];
          const newLabel = isPositive ? pref.t : pref.f;
          if (e.data?.label !== newLabel || e.data?.edgeStyle !== edgeStyle) {
              return { ...e, data: { ...e.data, label: newLabel, edgeStyle } };
          }
      } else if (e.data?.edgeStyle !== edgeStyle) {
          return { ...e, data: { ...e.data, edgeStyle } };
      }
      return e;
    }));
  }, [edgeStyle, setEdges]);

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
          const inputEl = document.getElementById(`input-${selectedNodes[0].id}`);
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
  }, [selectedNodes, selectedEdges, clipboard, readOnly, deleteConfirm, executeDelete]);

  const getHitEdge = (event, node, draggedNodes) => {
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    if (!clientX || !clientY) return null;

    const nodeEl = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
    if (!nodeEl) return null;

    const rect = nodeEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const checkPoints = [
        { x: clientX, y: clientY },
        { x: centerX, y: centerY },
        { x: centerX, y: rect.top - 10 },
        { x: centerX, y: rect.bottom + 10 }
    ];

    const originalStyles = [];
    draggedNodes.forEach(n => {
        const el = document.querySelector(`.react-flow__node[data-id="${n.id}"]`);
        if (el) {
            originalStyles.push({ el, val: el.style.visibility });
            el.style.visibility = 'hidden';
        }
    });

    let foundEdge = null;
    for (let pt of checkPoints) {
        if (pt.x && pt.y) {
            const elemBelow = document.elementFromPoint(pt.x, pt.y);
            const closestEdge = elemBelow?.closest('.react-flow__edge');
            if (closestEdge) {
                foundEdge = closestEdge;
                break;
            }
        }
    }

    originalStyles.forEach(({ el, val }) => { el.style.visibility = val; });
    return foundEdge;
  };

  const onNodeDrag = useCallback((event, node) => {
    if (readOnly) return;

    let draggedNodes = nodes.filter(n => n.selected);
    if (draggedNodes.length === 0) draggedNodes = [node];
    
    if (draggedNodes.some(n => n.type === 'COMMENT')) return;

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

    let draggedNodes = nodes.filter(n => n.selected);
    if (draggedNodes.length === 0) draggedNodes = [node];
    
    if (draggedNodes.some(n => n.type === 'COMMENT')) return;

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

                const pref = edgeLabels[edgeStyle || '+-'];
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
              data: { ...n.data, readOnly, onChange: (e) => updateNodeLabel(n.id, e.target.value) } 
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
        const generatedXml = reactFlowToDrawio(nodes, edges);
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

    if (sourceNode?.type === 'CONDITION') {
      if (sourceEdges.length >= 2) return false;
    } else {
      if (sourceEdges.length >= 1) return false;
    }
    return true;
  }, [nodes, edges]);

  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    const sourceEdges = edges.filter(e => e.source === params.source);

    if (sourceNode?.type === 'START_END' && sourceNode.data?.mode === 'unassigned') {
        updateNodeData(params.source, { mode: 'start', label: 'main' });
    }
    if (targetNode?.type === 'START_END' && targetNode.data?.mode === 'unassigned') {
        updateNodeData(params.target, { mode: 'end', label: 'ENDFUNCTION' });
    }

    if (sourceNode?.type === 'CONDITION') {
      const pref = edgeLabels[edgeStyle || '+-'];
      const firstLabel = sourceEdges[0]?.data?.label;
      const isPositive = firstLabel === pref.t || firstLabel === 'Ano' || firstLabel === '+' || firstLabel === 'Yes' || firstLabel === 'True';
      
      const lbl = sourceEdges.length === 0 ? pref.t : (isPositive ? pref.f : pref.t);
      setEdges((eds) => addEdge({ ...params, type: 'customEdge', data: { label: lbl, edgeStyle }, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    } else {
      setEdges((eds) => addEdge({ ...params, type: 'customEdge', data: { edgeStyle }, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    }
  }, [nodes, edges, setEdges, edgeStyle, updateNodeData]);

  const addNode = (type, label) => {
    if (readOnly) return;
    const id = Date.now().toString();
    
    const reactFlowBounds = document.querySelector('.react-flow').getBoundingClientRect();
    const position = screenToFlowPosition({
        x: reactFlowBounds.left + reactFlowBounds.width / 2,
        y: reactFlowBounds.top + reactFlowBounds.height / 2,
    });

    let extraData = {};
    if (type === 'START_END') extraData = { mode: 'unassigned', entityType: 'FUNCTION' };
    
    setNodes((nds) => nds.concat({ id, type, position, selected: false, data: { label, readOnly, ...extraData, onChange: (e) => updateNodeLabel(id, e.target.value) } }));
  };

  const handleExport = () => {
    const dataStr = "data:text/xml;charset=utf-8," + encodeURIComponent(xml);
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'diagram.drawio.xml';
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => onXmlChange(event.target.result);
    reader.readAsText(file);
  };

  const btnClass = "p-2 rounded transition-opacity disabled:opacity-25 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300";

  return (
    <div className="w-full h-full relative outline-none" tabIndex={0}>
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

      <div className="absolute top-4 left-4 z-10 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 dark:border-gray-700">
        <button onClick={() => addNode('START_END', '')} disabled={readOnly} className={btnClass}><Circle size={18} /></button>
        <button onClick={() => addNode('ACTION', 'Operace')} disabled={readOnly} className={btnClass}><Square size={18} /></button>
        <button onClick={() => addNode('IO', 'Vstup')} disabled={readOnly} className={btnClass}><AlignLeft size={18} style={{transform: 'skew(-15deg)'}} /></button>
        <button onClick={() => addNode('CONDITION', 'x > 0')} disabled={readOnly} className={btnClass}><Diamond size={18} /></button>
        <button onClick={() => addNode('COMMENT', '# Komentář')} disabled={readOnly} className={`p-2 rounded transition-opacity disabled:opacity-25 disabled:cursor-not-allowed hover:bg-yellow-100 text-yellow-600`}><MessageSquare size={18} /></button>
      </div>

      {(selectedNodes.length > 0 || selectedEdges.length > 0) && !readOnly && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-2 bg-indigo-600 p-1.5 rounded-lg shadow-lg">
           <button onClick={handleCopy} className="flex items-center gap-1 text-white hover:bg-indigo-500 px-3 py-1.5 rounded text-sm font-medium"><Copy size={16}/> Kopírovat</button>
           <div className="w-px bg-indigo-400 mx-1"></div>
           <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-1 text-red-100 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded text-sm font-medium"><Trash2 size={16}/> Smazat</button>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 dark:border-gray-700">
        <button onClick={handleExport} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300" title="Export .drawio"><Download size={18}/></button>
        <label className={`p-2 rounded cursor-pointer text-gray-700 dark:text-gray-300 ${readOnly ? 'opacity-25 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} title="Import .drawio">
          <Upload size={18}/>
          <input type="file" accept=".xml,.drawio,.json" className="hidden" onChange={handleImport} disabled={readOnly} />
        </label>
      </div>

      <ReactFlow 
        nodes={nodes} edges={edges} 
        onNodesChange={readOnly ? undefined : onNodesChange} 
        onEdgesChange={readOnly ? undefined : onEdgesChange} 
        onConnect={readOnly ? undefined : onConnect} 
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={({ nodes }) => {
            if (onSelectionChange) onSelectionChange(nodes.map(n => n.id));
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
  );
}

export default function DiagramEditor(props) {
  return <ReactFlowProvider><EditorCanvas {...props} /></ReactFlowProvider>;
}