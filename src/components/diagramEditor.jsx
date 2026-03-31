import React, { useCallback, useEffect, useState } from 'react';
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

const CustomEdge = ({ id, source, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data, selected }) => {
  const { setEdges } = useReactFlow();
  const nodes = useNodes();
  const isCondition = nodes.find(n => n.id === source)?.type === 'CONDITION';
  
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
      <BaseEdge path={edgePath} markerEnd={markerEnd} className={selected ? "!stroke-indigo-600" : "!stroke-gray-800 dark:!stroke-gray-400"} style={{ strokeWidth: selected ? 3 : 2 }} />
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
  const nodes = useNodes();
  const edges = useEdges();
  
  let mode = data.mode || 'unassigned';
  let entityType = data.entityType || 'FUNCTION';

  const setMode = (newMode) => {
    let newLabel = data.label;
    if (newMode === 'start' && !newLabel) {
       const existingStarts = nodes.filter(n => n.type === 'START_END' && n.data.mode === 'start');
       const hasMain = existingStarts.some(n => n.data.label === 'main');
       newLabel = hasMain ? `function${existingStarts.length}` : 'main';
    }
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, mode: newMode, label: newLabel } } : n));
  };

  const toggleEntity = () => {
    if(data.readOnly) return;
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, entityType: entityType === 'FUNCTION' ? 'CLASS' : 'FUNCTION' } } : n));
  };

  const isTarget = edges.some(e => e.target === id);
  const isSource = edges.some(e => e.source === id);

  if (mode === 'unassigned') {
    if (isTarget) mode = 'end';
    else if (isSource) mode = 'start';
  }

  let startName = 'main';
  if (mode === 'end') {
    const findStartNode = (nodeId, visited = new Set()) => {
        if (visited.has(nodeId)) return null;
        visited.add(nodeId);
        const incEdges = edges.filter(e => e.target === nodeId);
        for (let edge of incEdges) {
            const srcNode = nodes.find(n => n.id === edge.source);
            if (srcNode) {
                if (srcNode.type === 'START_END' && srcNode.data.mode === 'start') return srcNode;
                const found = findStartNode(srcNode.id, visited);
                if (found) return found;
            }
        }
        return null;
    };
    const startNode = findStartNode(id);
    if (startNode) startName = startNode.data.label || 'main';
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border-2 rounded-[2rem] min-w-[140px] min-h-[60px] flex flex-col justify-center items-center shadow-sm p-2 transition-all relative ${getSelectClass(selected)}`}>
      {mode !== 'start' && <Handle type="target" position={Position.Top} id="t-top" className="!w-2 !h-2 !bg-indigo-600" />}
      
      {mode === 'unassigned' && (
        <>
          <DragHandle />
          <div className="flex gap-2 w-full px-2 mt-1 z-10">
            <button onClick={() => setMode('start')} className="flex-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 rounded py-1 font-bold pointer-events-auto">Start</button>
            <button onClick={() => setMode('end')} className="flex-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 rounded py-1 font-bold pointer-events-auto">Konec</button>
          </div>
        </>
      )}

      {mode === 'start' && (
        <div className="w-full flex flex-col px-2 relative pb-1">
          <div className="flex justify-between items-center w-full mb-1 px-1">
            <span className="text-[9px] text-gray-400 font-bold w-12 text-left">START</span>
            <div className="custom-drag-handle w-8 h-1.5 cursor-grab bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors" title="Chytit a přesunout" />
            <span onClick={toggleEntity} className={`text-[9px] text-gray-400 font-bold w-12 text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 ${data.readOnly ? 'pointer-events-none' : 'pointer-events-auto'}`}>{entityType}</span>
          </div>
          <input id={`input-${id}`} defaultValue={data.label} onChange={data.onChange} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-full text-center outline-none bg-transparent text-sm font-mono font-bold nodrag text-gray-800 dark:text-gray-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
        </div>
      )}

      {mode === 'end' && (
        <>
          <DragHandle />
          <div className="w-full flex flex-col items-center px-3 pb-1">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Konec</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">{startName}</span>
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
        <Handle type="source" position={Position.Bottom} id="s-bottom" className="opacity-0" />
    </div>
);

const nodeTypes = { ACTION: ActionNode, IO: IONode, CONDITION: ConditionNode, START_END: StartEndNode, COMMENT: CommentNode, MERGE: MergeNode };
const edgeTypes = { customEdge: CustomEdge };

function EditorCanvas({ xml, onXmlChange, readOnly, edgeStyle, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [clipboard, setClipboard] = useState({ nodes: [], edges: [] });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  const selectedNodes = nodes.filter(n => n.selected);
  const selectedEdges = edges.filter(e => e.selected);

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

  useEffect(() => {
    if (xml) {
      const { nodes: parsedNodes, edges: parsedEdges } = drawioToReactFlow(xml);
      setNodes(parsedNodes.map(n => ({ ...n, data: { ...n.data, readOnly, onChange: (e) => updateNodeLabel(n.id, e.target.value) } })));
      setEdges(parsedEdges.map(e => ({ ...e, data: { ...e.data, readOnly, edgeStyle }, markerEnd: { type: MarkerType.ArrowClosed } })));
    }
  }, [xml, readOnly, edgeStyle, setNodes, setEdges]);

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const timer = setTimeout(() => {
        onXmlChange(reactFlowToDrawio(nodes, edges));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, onXmlChange]);

  const isValidConnection = useCallback((connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const sourceEdges = edges.filter(e => e.source === connection.source);

    if (sourceNode?.type === 'CONDITION') {
      if (sourceEdges.length >= 2) return false;
    } else {
      if (sourceEdges.length >= 1) return false;
    }
    return true;
  }, [nodes, edges]);

  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    const sourceEdges = edges.filter(e => e.source === params.source);

    if (sourceNode?.type === 'CONDITION') {
      const pref = edgeLabels[edgeStyle || '+-'];
      const firstLabel = sourceEdges[0]?.data?.label;
      const isPositive = firstLabel === pref.t || firstLabel === 'Ano' || firstLabel === '+' || firstLabel === 'Yes' || firstLabel === 'True';
      
      const lbl = sourceEdges.length === 0 ? pref.t : (isPositive ? pref.f : pref.t);
      setEdges((eds) => addEdge({ ...params, type: 'customEdge', data: { label: lbl, edgeStyle }, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    } else {
      setEdges((eds) => addEdge({ ...params, type: 'customEdge', data: { edgeStyle }, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    }
  }, [nodes, edges, setEdges, edgeStyle]);

  const updateNodeLabel = (nodeId, newLabel) => {
    setNodes((nds) => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n));
  };

  const addNode = (type, label) => {
    if (readOnly) return;
    const id = Date.now().toString();
    
    // Vložení doprostřed view portu!
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
        onNodeClick={(e, node) => onNodeClick && onNodeClick(node.id)}
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