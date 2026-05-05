import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, addEdge, useNodesState, useEdgesState, Controls, Background, MarkerType, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, Upload, Square, Circle, Diamond, AlignLeft, Copy, Trash2, MessageSquare, FileJson, FileCode } from 'lucide-react';
import { drawioToReactFlow, reactFlowToDrawio } from '../utils/diagramConverter';
import { calculateGroupNodes } from '../utils/grouping';
import { edgeLabels } from './diagram/constants';
import { CustomEdge } from './diagram/CustomEdge';
import { ActionNode, IONode, ConditionNode, StartEndNode, CommentNode, MergeNode, GroupBgNode } from './diagram/CustomNodes';

// HOC (Higher-Order Component) pro přidání klikatelné a hover breakpoint tečky k libovolnému uzlu
const withBreakpoint = (WrappedComponent) => {
  return (props) => {
    const { data, id } = props;
    const isBp = data.isBreakpoint;
    
    return (
      <div className="relative group">
        <div
          className={`absolute -top-3 -left-3 w-5 h-5 rounded-full cursor-pointer z-50 transition-all flex items-center justify-center ${isBp ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-100' : 'bg-red-500/40 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 hover:!bg-red-500 hover:!opacity-100'}`}
          onClick={(e) => { e.stopPropagation(); if (data.onBreakpointToggle) data.onBreakpointToggle(id); }}
        />
        <WrappedComponent {...props} />
      </div>
    );
  };
};

// Obalujeme funkční bloky zarážkami. Merge/GroupBg atd nezahrnujeme
const nodeTypes = { 
  ACTION: withBreakpoint(ActionNode), 
  IO: withBreakpoint(IONode), 
  CONDITION: withBreakpoint(ConditionNode), 
  START_END: withBreakpoint(StartEndNode), 
  COMMENT: CommentNode, 
  MERGE: MergeNode, 
  GROUP_BG: GroupBgNode 
};
const edgeTypes = { customEdge: CustomEdge };

function EditorCanvas({ xml, onXmlChange, onImportXml, readOnly, edgeStyle, colorMode, groupColoring, onSelectionChange, externalSelectedIds, activeRuntimeNodeId, breakpoints = [], onBreakpointToggle, onPaneClick, onInteract }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [clipboard, setClipboard] = useState({ nodes: [], edges: [] });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { screenToFlowPosition, getNode, getEdges } = useReactFlow();
  
  const hoveredEdgeRef = useRef(null);
  const lastXmlRef = useRef(''); 

  const onXmlChangeRef = useRef(onXmlChange);
  const onImportXmlRef = useRef(onImportXml);
  const onPaneClickRef = useRef(onPaneClick);
  const onInteractRef = useRef(onInteract);
  const onSelectionChangeRef = useRef(onSelectionChange);

  useEffect(() => {
    onXmlChangeRef.current = onXmlChange;
    onImportXmlRef.current = onImportXml;
    onPaneClickRef.current = onPaneClick;
    onInteractRef.current = onInteract;
    onSelectionChangeRef.current = onSelectionChange;
  }, [onXmlChange, onImportXml, onPaneClick, onInteract, onSelectionChange]);

  const selectedNodes = nodes.filter(n => n.selected);
  const selectedEdges = edges.filter(e => e.selected);

  const handleInteract = useCallback(() => {
    if (onInteractRef.current) onInteractRef.current();
  }, []);

  const mappedNodes = useMemo(() => nodes.map(n => ({
        ...n,
        zIndex: 10,
        data: { 
            ...n.data, 
            colorMode, 
            isRuntimeActive: n.id === activeRuntimeNodeId, 
            externalHighlight: externalSelectedIds?.includes(n.id),
            isBreakpoint: breakpoints.includes(n.id),
            onBreakpointToggle: onBreakpointToggle
        }
  })), [nodes, colorMode, externalSelectedIds, activeRuntimeNodeId, breakpoints, onBreakpointToggle]);

  const bgNodes = useMemo(() => calculateGroupNodes(nodes, edges, groupColoring), [nodes, edges, groupColoring]);
  const allNodes = useMemo(() => [...bgNodes, ...mappedNodes], [bgNodes, mappedNodes]);

  useEffect(() => {
    setNodes(nds => nds.map(n => n.type === 'CONDITION' && n.data.edgeStyle !== edgeStyle ? { ...n, data: { ...n.data, edgeStyle } } : n));
    setEdges(eds => eds.map(e => {
      const isPositive = ['+', 'Ano', 'Yes', 'True'].includes(e.data?.label);
      const isNegative = ['-', 'Ne', 'No', 'False'].includes(e.data?.label);
      if (isPositive || isNegative) {
          const pref = edgeLabels[edgeStyle || 'true-false'];
          const newLabel = isPositive ? pref.t : pref.f;
          if (e.data?.label !== newLabel || e.data?.edgeStyle !== edgeStyle) return { ...e, data: { ...e.data, label: newLabel, edgeStyle } };
      } else if (e.data?.edgeStyle !== edgeStyle) return { ...e, data: { ...e.data, edgeStyle } };
      return e;
    }));
  }, [edgeStyle, setNodes, setEdges]);

  const executeDelete = useCallback(() => {
    handleInteract();
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const selectedEdgeIds = new Set(selectedEdges.map(e => e.id));
    setNodes(nds => nds.filter(n => !selectedNodeIds.has(n.id)));
    setEdges(eds => eds.filter(e => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
    setDeleteConfirm(false);
  }, [selectedNodes, selectedEdges, setNodes, setEdges, handleInteract]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (readOnly) return;
      if (deleteConfirm) {
        if (e.key === 'Enter') { e.preventDefault(); executeDelete(); } 
        else if (e.key === 'Escape') { e.preventDefault(); setDeleteConfirm(false); }
        return;
      }

      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (isInput) e.target.blur();
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        setEdges(eds => eds.map(edge => ({ ...edge, selected: false })));
        setContextMenu(null); setShowExportMenu(false);
        if (onPaneClickRef.current) onPaneClickRef.current();
        return;
      }
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput && (selectedNodes.length > 0 || selectedEdges.length > 0)) {
        e.preventDefault(); setDeleteConfirm(true);
      }
      if (e.key === 'F2' && selectedNodes.length === 1) {
        e.preventDefault();
        const inputEl = document.getElementById(`input-${selectedNodes[0].id}`) || document.querySelector(`.react-flow__node[data-id="${selectedNodes[0].id}"] textarea`);
        if (inputEl) { setTimeout(() => { inputEl.focus(); inputEl.select(); }, 10); setNodes(nds => nds.map(n => ({ ...n, selected: false }))); }
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey) && !isInput) {
        e.preventDefault();
        setNodes(nds => nds.map(n => ({ ...n, selected: true })));
        setEdges(eds => eds.map(edge => ({ ...edge, selected: true })));
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && !isInput) { e.preventDefault(); handleCopy(); }
      if (e.key === 'v' && (e.ctrlKey || e.metaKey) && !isInput) { e.preventDefault(); handlePaste(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes, selectedEdges, clipboard, readOnly, deleteConfirm, executeDelete]);

  const getHitEdge = (event, draggedNodes) => {
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    if (!clientX || !clientY) return null;

    const originalStyles = [];
    draggedNodes.forEach(n => {
        const el = document.querySelector(`.react-flow__node[data-id="${n.id}"]`);
        if (el) { originalStyles.push({ el, val: el.style.visibility }); el.style.visibility = 'hidden'; }
    });

    let foundEdge = null;
    for (let dx = -40; dx <= 40; dx += 20) {
        for (let dy = -40; dy <= 40; dy += 20) {
            const elemBelow = document.elementFromPoint(clientX + dx, clientY + dy);
            const closestEdge = elemBelow?.closest('.react-flow__edge');
            if (closestEdge) { foundEdge = closestEdge; break; }
        }
        if (foundEdge) break;
    }
    originalStyles.forEach(({ el, val }) => { el.style.visibility = val; });
    return foundEdge;
  };

  const onNodeDrag = useCallback((event, node) => {
    if (readOnly) return;
    setContextMenu(null); setShowExportMenu(false);

    let draggedNodes = nodes.filter(n => n.selected && n.type !== 'GROUP_BG');
    if (draggedNodes.length === 0) draggedNodes = [node];
    if (draggedNodes.some(n => n.type === 'COMMENT' || n.type === 'GROUP_BG')) return;

    const draggedIds = new Set(draggedNodes.map(n => n.id));
    if (edges.some(e => (draggedIds.has(e.source) && !draggedIds.has(e.target)) || (draggedIds.has(e.target) && !draggedIds.has(e.source)))) return;

    const edgeElem = getHitEdge(event, draggedNodes);
    
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
    handleInteract();
    if (hoveredEdgeRef.current) { hoveredEdgeRef.current.classList.remove('drop-target'); hoveredEdgeRef.current = null; }

    let draggedNodes = nodes.filter(n => n.selected && n.type !== 'GROUP_BG');
    if (draggedNodes.length === 0) draggedNodes = [node];
    if (draggedNodes.some(n => n.type === 'COMMENT' || n.type === 'GROUP_BG')) return;

    const draggedIds = new Set(draggedNodes.map(n => n.id));
    if (edges.some(e => (draggedIds.has(e.source) && !draggedIds.has(e.target)) || (draggedIds.has(e.target) && !draggedIds.has(e.source)))) return;

    const edgeElem = getHitEdge(event, draggedNodes);

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
                    const curr = draggedNodes[i], next = draggedNodes[i+1];
                    if (!eds.find(e => e.source === curr.id && e.target === next.id)) {
                        newInternalEdges.push({ id: `e_${Date.now()}_int_${i}`, source: curr.id, target: next.id, sourceHandle: 's-bottom', targetHandle: 't-top', type: 'customEdge', data: { edgeStyle }, markerEnd: { type: MarkerType.ArrowClosed } });
                    }
                }
                const newEdge1 = { id: `e_${Date.now()}_1`, source: targetEdge.source, target: firstNode.id, sourceHandle: targetEdge.sourceHandle, targetHandle: 't-top', type: 'customEdge', data: targetEdge.data, markerEnd: { type: MarkerType.ArrowClosed } };
                const pref = edgeLabels[edgeStyle || 'true-false'];
                const outLabel = lastNode.type === 'CONDITION' ? pref.t : '';
                const newEdge2 = { id: `e_${Date.now()}_2`, source: lastNode.id, target: targetEdge.target, sourceHandle: 's-bottom', targetHandle: targetEdge.targetHandle, type: 'customEdge', data: { label: outLabel, edgeStyle }, markerEnd: { type: MarkerType.ArrowClosed } };
                return [...filtered, newEdge1, ...newInternalEdges, newEdge2];
            });
        }
    }
  }, [edges, nodes, setEdges, edgeStyle, readOnly, handleInteract]);

  const handleCopy = () => { 
    if (selectedNodes.length > 0) {
      const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
      setClipboard({ nodes: selectedNodes, edges: edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)) });
    }
  };

  const handlePaste = () => {
    if (clipboard.nodes.length === 0) return;
    handleInteract();
    const idMap = {};
    const newNodes = clipboard.nodes.map(n => {
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      idMap[n.id] = newId;
      return { ...n, id: newId, position: { x: n.position.x + 30, y: n.position.y + 30 }, selected: true, data: { ...n.data, onChange: (e) => updateNodeLabel(newId, e.target.value) } };
    });
    const newEdges = clipboard.edges.map(e => ({ ...e, id: Date.now().toString() + Math.random().toString(36).substr(2, 5), source: idMap[e.source], target: idMap[e.target], selected: true }));
    setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
    setEdges(eds => eds.map(e => ({ ...e, selected: false })).concat(newEdges));
  };

  const handleDuplicate = () => { handleCopy(); setTimeout(handlePaste, 10); };
  
  const updateNodeData = useCallback((nodeId, newData) => {
      handleInteract();
      setNodes((nds) => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
  }, [setNodes, handleInteract]);

  const updateNodeLabel = useCallback((nodeId, newLabel) => updateNodeData(nodeId, { label: newLabel }), [updateNodeData]);

  const handleFilteredNodesChange = useCallback((changes) => {
    handleInteract();
    if (readOnly) return;
    
    const validChanges = changes.filter(c => {
        if (c.type === 'dimensions' || c.type === 'position') {
            return nodes.some(n => n.id === c.id);
        }
        return true;
    });

    if (validChanges.length > 0) {
        onNodesChange(validChanges);
    }
  }, [handleInteract, readOnly, onNodesChange, nodes]);

  useEffect(() => {
    if (xml && xml !== lastXmlRef.current) {
      lastXmlRef.current = xml;
      const { nodes: parsedNodes, edges: parsedEdges } = drawioToReactFlow(xml);
      setNodes(prev => parsedNodes.map(n => ({ 
          ...n, 
          selected: prev.find(p => p.id === n.id)?.selected || false, 
          data: { ...n.data, readOnly, edgeStyle, onChange: (e) => updateNodeLabel(n.id, e.target.value) } 
      })));
      
      setEdges(prev => parsedEdges.map(e => ({ 
          ...e, 
          type: 'customEdge',
          selected: prev.find(p => p.id === e.id)?.selected || false, 
          data: { ...e.data, readOnly, edgeStyle }, 
          markerEnd: { type: MarkerType.ArrowClosed } 
      })));
    }
  }, [xml, readOnly, edgeStyle, setNodes, setEdges, updateNodeLabel]);

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const timer = setTimeout(() => {
        const exportNodes = nodes.filter(n => n.type !== 'GROUP_BG');
        const generatedXml = reactFlowToDrawio(exportNodes, edges);
        if (generatedXml !== lastXmlRef.current) { 
            lastXmlRef.current = generatedXml; 
            if (onXmlChangeRef.current) onXmlChangeRef.current(generatedXml); 
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges]);

  const isValidConnection = useCallback((connection) => {
    const sourceNode = getNode(connection.source);
    const targetNode = getNode(connection.target);
    const currentEdges = getEdges();

    if (!sourceNode || !targetNode) return false;
    const sourceEdges = currentEdges.filter(e => e.source === connection.source);

    if (targetNode.type === 'START_END' && targetNode.data?.mode === 'start') return false;
    if (sourceNode.type === 'START_END' && sourceNode.data?.mode === 'end') return false;
    if (targetNode.type === 'START_END' && targetNode.data?.mode === 'end' && connection.targetHandle !== 't-top') return false;
    if (sourceNode.type === 'CONDITION' ? sourceEdges.length >= 2 : sourceEdges.length >= 1) return false;
    
    if (targetNode.position.y <= sourceNode.position.y) {
        let hasCond = false, currentIds = [sourceNode.id], visited = new Set();
        while(currentIds.length > 0) {
            let nextIds = [];
            for (let cid of currentIds) {
                if (visited.has(cid)) continue; visited.add(cid);
                const n = getNode(cid);
                if (n && n.type === 'CONDITION') { hasCond = true; break; }
                nextIds.push(...currentEdges.filter(e => e.target === cid).map(e => e.source));
            }
            if (hasCond) break;
            currentIds = nextIds;
        }
        if (!hasCond) return false;
    }
    return true;
  }, [getNode, getEdges]);

  const onConnect = useCallback((params) => {
    handleInteract();
    const sourceNode = getNode(params.source);
    const targetNode = getNode(params.target);
    
    if (sourceNode?.type === 'START_END' && sourceNode.data?.mode === 'unassigned') updateNodeData(params.source, { mode: 'start', label: 'main' });
    if (targetNode?.type === 'START_END' && targetNode.data?.mode === 'unassigned') updateNodeData(params.target, { mode: 'end', label: 'ENDFUNCTION' });

    let data = { edgeStyle };
    if (sourceNode?.type === 'CONDITION') {
        data.label = params.sourceHandle === 's-right' ? edgeLabels[edgeStyle || 'true-false'].f : edgeLabels[edgeStyle || 'true-false'].t;
    }

    setEdges(eds => {
        let filteredEds = eds;
        if (sourceNode && sourceNode.type !== 'CONDITION') {
            filteredEds = eds.filter(e => e.source !== params.source);
        }
        return addEdge({ ...params, type: 'customEdge', data, markerEnd: { type: MarkerType.ArrowClosed } }, filteredEds);
    });
  }, [edgeStyle, updateNodeData, handleInteract, setEdges, getNode]);

  const addNodeAt = (type, label, clientPos = null) => {
    if (readOnly) return;
    handleInteract();
    const newId = 'node_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
    
    const offset = Math.floor(Math.random() * 40) - 20;
    const position = clientPos ? screenToFlowPosition({ x: clientPos.mouseX, y: clientPos.mouseY }) : (() => {
        const bounds = document.querySelector('.react-flow').getBoundingClientRect();
        return screenToFlowPosition({ x: bounds.left + bounds.width / 2 + offset, y: bounds.top + bounds.height / 2 + offset });
    })();

    setNodes((nds) => nds.concat({ 
        id: newId, 
        type, 
        position, 
        selected: false, 
        data: { label, readOnly, ...(type === 'START_END' ? { mode: 'unassigned', entityType: 'FUNCTION' } : {}), onChange: (e) => updateNodeLabel(newId, e.target.value) } 
    }));
  };

  const handlePaneContextMenu = useCallback((e) => { if (readOnly) return; e.preventDefault(); setContextMenu({ mouseX: e.clientX, mouseY: e.clientY }); }, [readOnly]);

  const handleExportEduCode = () => {
    setShowExportMenu(false);
    const a = document.createElement('a'); a.href = "data:text/xml;charset=utf-8," + encodeURIComponent(xml); a.download = 'educode_diagram.xml'; a.click();
  };

  const handleExportDrawioStandard = () => {
    setShowExportMenu(false);
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    doc.querySelectorAll('mxCell').forEach(c => ['type', 'mode', 'entityType', 'edgeStyle'].forEach(attr => c.removeAttribute(attr)));
    const a = document.createElement('a'); a.href = "data:text/xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(doc)); a.download = 'standard_diagram.drawio'; a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (ev) => {
        if(onImportXmlRef.current) onImportXmlRef.current(ev.target.result);
        else if(onXmlChangeRef.current) onXmlChangeRef.current(ev.target.result);
    }; reader.readAsText(file);
  };

  const btnClass = `p-2 rounded transition-opacity disabled:opacity-25 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 ${colorMode ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"}`;

  return (
    <div className="w-full h-full relative outline-none" tabIndex={0} onClick={() => { setContextMenu(null); setShowExportMenu(false); }}>
      <style>{`.react-flow__edge.drop-target .react-flow__edge-path { stroke: #4f46e5 !important; stroke-width: 4px !important; filter: drop-shadow(0 0 6px rgba(79,70,229,0.5)); transition: all 0.2s ease; }`}</style>
      
      {deleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-sm rounded-lg">
          <div className="bg-white p-4 rounded shadow-lg border border-gray-200">
            <h3 className="font-bold mb-2">Smazat vybrané prvky?</h3>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Zrušit</button>
              <button onClick={executeDelete} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">Smazat</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => e.preventDefault()} />
            <div className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl flex flex-col py-1 min-w-[160px]" style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}>
                <div className="px-3 py-1.5 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 mb-1">Přidat blok</div>
                {[
                  {type: 'START_END', label: 'Start/End', icon: Circle, color: colorMode ? "text-fuchsia-500" : "text-gray-500"},
                  {type: 'ACTION', label: 'Operace', icon: Square, color: colorMode ? "text-blue-500" : "text-gray-500"},
                  {type: 'IO', label: 'Vstup/Výstup', icon: AlignLeft, color: colorMode ? "text-emerald-500" : "text-gray-500"},
                  {type: 'CONDITION', label: 'Podmínka', icon: Diamond, color: colorMode ? "text-orange-500" : "text-gray-500"},
                  {type: 'COMMENT', label: 'Komentář', icon: MessageSquare, color: colorMode ? "text-yellow-500" : "text-gray-500"}
                ].map(item => (
                  <button key={item.type} onClick={() => { addNodeAt(item.type, item.type === 'COMMENT'?'#':(item.type==='CONDITION'?'x>0':(item.type==='IO'?'x':'')), contextMenu); setContextMenu(null); }} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <item.icon size={14} className={item.color}/> {item.label}
                  </button>
                ))}
            </div>
        </>
      )}

      <div className="absolute top-4 left-4 z-10 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 dark:border-gray-700">
        <button onClick={() => addNodeAt('START_END', '')} disabled={readOnly} className={btnClass}><Circle size={18} className={colorMode ? "text-fuchsia-600" : ""} /></button>
        <button onClick={() => addNodeAt('ACTION', 'Operace')} disabled={readOnly} className={btnClass}><Square size={18} className={colorMode ? "text-blue-600" : ""} /></button>
        <button onClick={() => addNodeAt('IO', 'x')} disabled={readOnly} className={btnClass}><AlignLeft size={18} className={colorMode ? "text-emerald-600" : ""} style={{transform: 'skew(-15deg)'}} /></button>
        <button onClick={() => addNodeAt('CONDITION', 'x > 0')} disabled={readOnly} className={btnClass}><Diamond size={18} className={colorMode ? "text-orange-600" : ""} /></button>
        <button onClick={() => addNodeAt('COMMENT', '# Komentář')} disabled={readOnly} className={btnClass}><MessageSquare size={18} className={colorMode ? "text-yellow-600" : ""} /></button>
      </div>

      {(selectedNodes.length > 0 || selectedEdges.length > 0) && !readOnly && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-2 bg-indigo-600 p-1.5 rounded-lg shadow-lg">
           <button onClick={handleDuplicate} className="flex items-center gap-1 text-white hover:bg-indigo-500 px-3 py-1.5 rounded text-sm font-medium"><Copy size={16}/> Duplikovat</button>
           <div className="w-px bg-indigo-400 mx-1"></div>
           <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-1 text-red-100 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded text-sm font-medium"><Trash2 size={16}/> Smazat</button>
        </div>
      )}

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
          onNodesChange={handleFilteredNodesChange} 
          onEdgesChange={(changes) => { handleInteract(); if (!readOnly) onEdgesChange(changes); }} 
          onConnect={(params) => { handleInteract(); if (!readOnly) onConnect(params); }} 
          onNodeDragStart={handleInteract}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={() => { handleInteract(); setContextMenu(null); setShowExportMenu(false); if (onPaneClickRef.current) onPaneClickRef.current(); }}
          onSelectionChange={({ nodes }) => { if (onSelectionChangeRef.current) onSelectionChangeRef.current(nodes.filter(n => n.type !== 'GROUP_BG').map(n => n.id)); }}
          isValidConnection={isValidConnection} 
          nodeTypes={nodeTypes} edgeTypes={edgeTypes} 
          defaultEdgeOptions={{ type: 'customEdge', markerEnd: { type: MarkerType.ArrowClosed } }}
          fitView deleteKeyCode={null} selectionOnDrag={true} panOnDrag={[1, 2]} panOnScroll={true} selectionMode="partial" multiSelectionKeyCode="Control"
          elementsSelectable={!readOnly}
          nodesDraggable={!readOnly}
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