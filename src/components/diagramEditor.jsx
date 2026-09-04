import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, addEdge, useNodesState, useEdgesState, Controls, ControlButton, Background, MarkerType, useReactFlow, ConnectionLineType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, Upload, Square, Circle, Diamond, Copy, Trash2, MessageSquare, FileJson, FileCode, Repeat, Box, Hexagon, Columns, Link2, Plus, Minus, Maximize, Lock, Unlock } from 'lucide-react';
import { drawioToReactFlow, reactFlowToDrawio } from '../utils/diagramConverter';
import { getGroupDefs, computeGroupBounds } from '../utils/grouping';
import { calculateRestructuredLayout } from '../utils/visualLayoutEngine';
import { edgeLabels } from './diagram/constants';
import { CustomEdge } from './diagram/CustomEdge';
import { ActionNode, IONode, ConditionNode, StartEndNode, CommentNode, MergeNode, GroupBgNode, LoopContainerNode, ForContainerNode, SwitchContainerNode, CaseContainerNode } from './diagram/CustomNodes';
import { Tooltip } from './Tooltip';
import { checkHotkey } from '../utils/hotkeys';

const IoIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="8,3 22,3 16,21 2,21" />
  </svg>
);
const nodeTypes = { 
  ACTION: ActionNode, 
  IO: IONode, 
  CONDITION: ConditionNode, 
  START_END: StartEndNode, 
  COMMENT: CommentNode, 
  MERGE: MergeNode, 
  GROUP_BG: GroupBgNode,
  LOOP_CONTAINER: LoopContainerNode,
  FOR_CONTAINER: ForContainerNode,
  SWITCH_CONTAINER: SwitchContainerNode,
  CASE_CONTAINER: CaseContainerNode
};
const edgeTypes = { customEdge: CustomEdge };

function EditorCanvas({ xml, onXmlChange, onImportXml, readOnly, edgeStyle, colorMode, isDarkMode, groupColoring, showDebugger, conditionShape, selectionMode, hotkeys, activeWindowRef, onSelectionChange, externalSelectedIds, activeRuntimeNodeId, breakpoints = [], onBreakpointToggle, onPaneClick, onInteract, onLogAction, onRequestTutorial, editorMode }) {
  const safeHotkeys = hotkeys || {};
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [clipboard, setClipboard] = useState({ nodes: [], edges: [] });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const reactFlowInstance = useReactFlow();
  const { screenToFlowPosition, flowToScreenPosition, getNode, getEdges } = reactFlowInstance;

  
  const hoveredEdgeRef = useRef(null);
  const lastXmlRef = useRef(''); 

  const lastMousePosRef = useRef({ 
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 
  });
  const lastDragTimeRef = useRef(0);
  const reactFlowWrapper = useRef(null);
  useEffect(() => {
    const handleMouseMove = (e) => { 
      if (e.clientX !== undefined && e.clientY !== undefined) {
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }; 
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const [hoveredToolbarItem, setHoveredToolbarItem] = useState(null);
  const [hoverProgress, setHoverProgress] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const hoverStartTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  
  const clearHover = useCallback(() => {
    setHoveredToolbarItem(null);
    setHoverProgress(0);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const handlePointerDown = (type, e) => {
    if (readOnly) return;
    setHoveredToolbarItem(type);
    setCursorPos({ x: e.clientX, y: e.clientY });
    hoverStartTimeRef.current = performance.now();
    
    const animate = (time) => {
        const elapsed = time - hoverStartTimeRef.current;
        if (elapsed < 500) {
            setHoverProgress(0);
        } else {
            const p = Math.min((elapsed - 500) / 1000, 1);
            setHoverProgress(p * 100);
            if (p >= 1) {
                clearHover();
                if (onRequestTutorial) onRequestTutorial(type);
                return;
            }
        }
        animationFrameRef.current = requestAnimationFrame(animate);
    };
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handlePointerMove = (e) => {
    if (hoveredToolbarItem) {
        setCursorPos({ x: e.clientX, y: e.clientY });
    }
  };

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
  const [isInteractive, setIsInteractive] = useState(true);

  // =========================================================================================
  // CRITICAL WARNING: FOCUS STEALING PREVENTION
  // isUserInteractionRef is absolutely necessary. It prevents the diagram from echoing incoming
  // XML updates back to App.jsx and forcefully stealing `lastEdited.current`.
  // DO NOT REMOVE THIS FLAG. DO NOT remove `handleInteract()` from `onNodesChange`.
  // =========================================================================================
  const isUserInteractionRef = useRef(false);

  const handleInteract = useCallback(() => {
    isUserInteractionRef.current = true;
    if (onInteractRef.current) onInteractRef.current();
  }, []);

  const historyRef = useRef({ past: [], future: [] });

  const takeSnapshot = useCallback(() => {
    if (readOnly) return;
    const exportNodes = nodes.filter(n => n.type !== 'GROUP_BG');
    const snapshot = {
      nodes: exportNodes.map(n => ({
        id: n.id,
        type: n.type,
        position: { ...n.position },
        selected: false,
        style: n.style ? { ...n.style } : undefined,
        parentId: n.parentId,
        data: { ...n.data, onChange: undefined, onUpdateData: undefined, onToggleIOType: undefined, onToggleEntityType: undefined, onBreakpointToggle: undefined }
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type,
        selected: false,
        data: { ...e.data }
      }))
    };

    const past = historyRef.current.past;
    if (past.length > 0) {
      const top = past[past.length - 1];
      if (JSON.stringify(top) === JSON.stringify(snapshot)) {
        return;
      }
    }

    historyRef.current.past.push(snapshot);
    if (historyRef.current.past.length > 50) {
      historyRef.current.past.shift();
    }
    historyRef.current.future = [];
  }, [nodes, edges, readOnly]);

  const updateNodeData = useCallback((nodeId, newData, skipSnapshot = false) => {
      if (!skipSnapshot) takeSnapshot();
      handleInteract();
      setNodes((nds) => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
  }, [setNodes, handleInteract, takeSnapshot]);

  const updateNodeLabel = useCallback((nodeId, newLabel, skipSnapshot = false) => updateNodeData(nodeId, { label: newLabel }, skipSnapshot), [updateNodeData]);

  const toggleIOType = useCallback((nodeId, currentType) => {
      takeSnapshot();
      updateNodeData(nodeId, { ioType: currentType === 'input' ? 'output' : 'input' });
  }, [updateNodeData, takeSnapshot]);

  const toggleEntityType = useCallback((nodeId, currentType) => {
      takeSnapshot();
      updateNodeData(nodeId, { entityType: currentType === 'FUNCTION' ? 'CLASS' : 'FUNCTION' });
  }, [updateNodeData, takeSnapshot]);

  const handleUndo = useCallback(() => {
    if (readOnly || historyRef.current.past.length === 0) return;
    handleInteract();

    const exportNodes = nodes.filter(n => n.type !== 'GROUP_BG');
    const currentSnapshot = {
      nodes: exportNodes.map(n => ({
        id: n.id,
        type: n.type,
        position: { ...n.position },
        selected: false,
        style: n.style ? { ...n.style } : undefined,
        parentId: n.parentId,
        data: { ...n.data, onChange: undefined, onUpdateData: undefined, onToggleIOType: undefined, onToggleEntityType: undefined, onBreakpointToggle: undefined }
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type,
        selected: false,
        data: { ...e.data }
      }))
    };
    historyRef.current.future.push(currentSnapshot);

    const prevState = historyRef.current.past.pop();
    if (!prevState) return;

    setNodes(prevState.nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        readOnly,
        edgeStyle,
        onChange: (e) => updateNodeLabel(n.id, e.target.value),
        onUpdateData: (newData) => updateNodeData(n.id, newData)
      }
    })));

    setEdges(prevState.edges.map(e => ({
      ...e,
      type: 'customEdge',
      data: { ...e.data, readOnly, edgeStyle },
      markerEnd: { type: MarkerType.ArrowClosed }
    })));

    if (onLogAction) onLogAction('UNDO_PERFORMED');
  }, [readOnly, nodes, edges, setNodes, setEdges, handleInteract, updateNodeLabel, updateNodeData, edgeStyle, onLogAction]);

  const handleRedo = useCallback(() => {
    if (readOnly || historyRef.current.future.length === 0) return;
    handleInteract();

    const exportNodes = nodes.filter(n => n.type !== 'GROUP_BG');
    const currentSnapshot = {
      nodes: exportNodes.map(n => ({
        id: n.id,
        type: n.type,
        position: { ...n.position },
        selected: false,
        style: n.style ? { ...n.style } : undefined,
        parentId: n.parentId,
        data: { ...n.data, onChange: undefined, onUpdateData: undefined, onToggleIOType: undefined, onToggleEntityType: undefined, onBreakpointToggle: undefined }
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type,
        selected: false,
        data: { ...e.data }
      }))
    };
    historyRef.current.past.push(currentSnapshot);

    const nextState = historyRef.current.future.pop();
    if (!nextState) return;

    setNodes(nextState.nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        readOnly,
        edgeStyle,
        onChange: (e) => updateNodeLabel(n.id, e.target.value),
        onUpdateData: (newData) => updateNodeData(n.id, newData)
      }
    })));

    setEdges(nextState.edges.map(e => ({
      ...e,
      type: 'customEdge',
      data: { ...e.data, readOnly, edgeStyle },
      markerEnd: { type: MarkerType.ArrowClosed }
    })));

    if (onLogAction) onLogAction('REDO_PERFORMED');
  }, [readOnly, nodes, edges, setNodes, setEdges, handleInteract, updateNodeLabel, updateNodeData, edgeStyle, onLogAction]);

  const mappedNodes = useMemo(() => nodes.map(n => ({
        ...n,
        zIndex: (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') ? -1 : (n.type === 'SWITCH_CONTAINER' ? -10000 : (n.type === 'CASE_CONTAINER' ? -9999 : 10)),
        data: { 
            ...n.data, 
            colorMode, 
            showDebugger,
            readOnly,
            conditionShape,
            isRuntimeActive: n.id === activeRuntimeNodeId, 
            externalHighlight: externalSelectedIds?.includes(n.id),
            isBreakpoint: breakpoints.includes(n.id),
            onBreakpointToggle: onBreakpointToggle,
            onToggleIOType: () => toggleIOType(n.id, n.data.ioType || 'input'),
            onToggleEntityType: () => toggleEntityType(n.id, n.data.entityType || 'FUNCTION')
        }
  })), [nodes, colorMode, showDebugger, readOnly, conditionShape, externalSelectedIds, activeRuntimeNodeId, breakpoints, onBreakpointToggle, toggleIOType, toggleEntityType]);

  const [nodeCount, setNodeCount] = useState(0);
  useEffect(() => { setNodeCount(nodes.length); }, [nodes.length]);
  
  const groupDefs = useMemo(() => {
        if (!groupColoring) return [];
        return getGroupDefs(nodes, edges);
  }, [nodeCount, edges, groupColoring]);

  const bgNodes = useMemo(() => {
        if (!groupColoring || groupDefs.length === 0) return [];
        return computeGroupBounds(nodes, groupDefs);
  }, [nodes, groupDefs, groupColoring]);
  const allNodes = useMemo(() => [...bgNodes, ...mappedNodes], [bgNodes, mappedNodes]);

  useEffect(() => {
    setEdges(eds => {
        let modified = false;
        const newEds = eds.map(e => ({...e}));
        const conditions = new Set(nodes.filter(n => n.type === 'CONDITION').map(n => n.id));
        
        const edgesBySource = {};
        newEds.forEach(e => {
            if (!edgesBySource[e.source]) edgesBySource[e.source] = [];
            edgesBySource[e.source].push(e);
        });

        Object.keys(edgesBySource).forEach(sourceId => {
            if (conditions.has(sourceId)) {
                const outEdges = edgesBySource[sourceId];
                if (outEdges.length === 2) {
                    const l1 = outEdges[0].data?.label;
                    const l2 = outEdges[1].data?.label;
                    
                    const isPos1 = ['+', 'Ano', 'Yes', 'True'].includes(l1);
                    const isPos2 = ['+', 'Ano', 'Yes', 'True'].includes(l2);
                    const isNeg1 = ['-', 'Ne', 'No', 'False'].includes(l1);
                    const isNeg2 = ['-', 'Ne', 'No', 'False'].includes(l2);
                    
                    const pref = edgeLabels[edgeStyle || 'true-false'];
                    
                    if (isPos1 && isPos2) {
                        outEdges[1].data = { ...outEdges[1].data, label: pref.f };
                        modified = true;
                    } else if (isNeg1 && isNeg2) {
                        outEdges[1].data = { ...outEdges[1].data, label: pref.t };
                        modified = true;
                    }
                }
            }
        });
        
        const formattedEds = newEds.map(e => {
            const isPos = ['+', 'Ano', 'Yes', 'True'].includes(e.data?.label);
            const isNeg = ['-', 'Ne', 'No', 'False'].includes(e.data?.label);
            if (isPos || isNeg) {
                const pref = edgeLabels[edgeStyle || 'true-false'];
                const newLabel = isPos ? pref.t : pref.f;
                if (e.data?.label !== newLabel || e.data?.edgeStyle !== edgeStyle) {
                    modified = true;
                    return { ...e, data: { ...e.data, label: newLabel, edgeStyle } };
                }
            } else if (e.data?.edgeStyle !== edgeStyle) {
                modified = true;
                return { ...e, data: { ...e.data, edgeStyle } };
            }
            return e;
        });

        return modified ? formattedEds : eds;
    });
  }, [edgeStyle, nodeCount, setEdges]); 

  const executeDelete = useCallback(() => {
    takeSnapshot();
    handleInteract();
    if(onLogAction) onLogAction('NODES_DELETED', { count: selectedNodes.length });
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const selectedEdgeIds = new Set(selectedEdges.map(e => e.id));
    
    // Cascade deletes to all descendants
    let added = true;
    while (added) {
        added = false;
        nodes.forEach(n => {
            if ((n.parentId && selectedNodeIds.has(n.parentId) && !selectedNodeIds.has(n.id)) ||
                (n.data?.switchId && selectedNodeIds.has(n.data.switchId) && !selectedNodeIds.has(n.id))) {
                selectedNodeIds.add(n.id);
                added = true;
            }
        });
    }
    
    setNodes(nds => nds.filter(n => !selectedNodeIds.has(n.id)));
    setEdges(eds => eds.filter(e => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
    setDeleteConfirm(false);
  }, [selectedNodes, selectedEdges, setNodes, setEdges, handleInteract, onLogAction, nodes, takeSnapshot]);

  const handleCopy = useCallback(() => { 
    if (selectedNodes.length > 0) {
      const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
      
      // Cascade copy to all descendants (Cases of Switches)
      let added = true;
      while (added) {
          added = false;
          nodes.forEach(n => {
              if ((n.parentId && selectedNodeIds.has(n.parentId) && !selectedNodeIds.has(n.id)) ||
                  (n.data?.switchId && selectedNodeIds.has(n.data.switchId) && !selectedNodeIds.has(n.id))) {
                  selectedNodeIds.add(n.id);
                  added = true;
              }
          });
      }
      
      const nodesToCopy = nodes.filter(n => selectedNodeIds.has(n.id));
      setClipboard({ nodes: nodesToCopy, edges: edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)) });
      if(onLogAction) onLogAction('NODES_COPIED', { count: nodesToCopy.length });
    }
  }, [selectedNodes, edges, onLogAction, setClipboard, nodes]);

  const handlePaste = useCallback(() => {
    if (clipboard.nodes.length === 0) return;
    takeSnapshot();
    handleInteract();
    if(onLogAction) onLogAction('NODES_PASTED', { count: clipboard.nodes.length });
    
    let pastePos = null;
    const reactFlowEl = document.querySelector('.react-flow');
    if (reactFlowEl) {
        const bounds = reactFlowEl.getBoundingClientRect();
        const mouse = lastMousePosRef.current;
        if (mouse.x >= bounds.left && mouse.x <= bounds.right && mouse.y >= bounds.top && mouse.y <= bounds.bottom) {
            pastePos = screenToFlowPosition({ x: mouse.x, y: mouse.y });
        } else {
            const centerX = bounds.left + bounds.width / 2;
            const centerY = bounds.top + bounds.height / 2;
            pastePos = screenToFlowPosition({ x: centerX, y: centerY });
        }
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    clipboard.nodes.forEach(n => {
        if (n.parentId) return; // Only calculate bounds for top-level nodes
        const w = parseInt(n.style?.width) || n.width || 150;
        const h = parseInt(n.style?.height) || n.height || 50;
        if (n.position.x < minX) minX = n.position.x;
        if (n.position.y < minY) minY = n.position.y;
        if (n.position.x + w > maxX) maxX = n.position.x + w;
        if (n.position.y + h > maxY) maxY = n.position.y + h;
    });
    
    const pasteCenterX = minX === Infinity ? 0 : (minX + maxX) / 2;
    const pasteCenterY = minY === Infinity ? 0 : (minY + maxY) / 2;
    
    const offsetX = pastePos ? pastePos.x - pasteCenterX : 30;
    const offsetY = pastePos ? pastePos.y - pasteCenterY : 30;
    
    const idMap = {};
    const newNodes = clipboard.nodes.map(n => {
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      idMap[n.id] = newId;
      // Cases are relative to Switch, so they don't get the mouse offset if they have a parent!
      const newPos = n.parentId ? { ...n.position } : { 
          x: pastePos ? Math.round((n.position.x + offsetX) / 10) * 10 : n.position.x + 30, 
          y: pastePos ? Math.round((n.position.y + offsetY) / 10) * 10 : n.position.y + 30 
      };
      return { 
          ...n, 
          id: newId, 
          position: newPos, 
          selected: true, 
          data: { 
              ...n.data, 
              onStartEdit: takeSnapshot,
              onChange: (e) => updateNodeLabel(newId, e.target.value, true), 
              onUpdateData: (newData) => updateNodeData(newId, newData) 
          } 
      };
    });
    
    // Pass 2: Remap parent/switch IDs
    newNodes.forEach(n => {
        if (n.parentId && idMap[n.parentId]) n.parentId = idMap[n.parentId];
        if (n.data?.switchId && idMap[n.data.switchId]) n.data.switchId = idMap[n.data.switchId];
    });
    
    const newEdges = clipboard.edges.map(e => ({ ...e, id: Date.now().toString() + Math.random().toString(36).substr(2, 5), source: idMap[e.source], target: idMap[e.target], selected: true }));
    setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
    setEdges(eds => eds.map(e => ({ ...e, selected: false })).concat(newEdges));
  }, [clipboard, onLogAction, updateNodeLabel, updateNodeData, setNodes, setEdges, handleInteract, screenToFlowPosition, takeSnapshot]);

  const handleDuplicate = useCallback(() => {
    if (selectedNodes.length === 0) return;
    takeSnapshot();
    handleInteract();
    
    // Find all selected nodes and any dependent child nodes (e.g. switch cases)
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    let added = true;
    while (added) {
      added = false;
      nodes.forEach(n => {
        if ((n.parentId && selectedNodeIds.has(n.parentId) && !selectedNodeIds.has(n.id)) ||
            (n.data?.switchId && selectedNodeIds.has(n.data.switchId) && !selectedNodeIds.has(n.id))) {
          selectedNodeIds.add(n.id);
          added = true;
        }
      });
    }

    const nodesToDuplicate = nodes.filter(n => selectedNodeIds.has(n.id));
    const edgesToDuplicate = edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));

    const idMap = {};
    const newNodes = nodesToDuplicate.map(n => {
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      idMap[n.id] = newId;

      const isParentDuplicated = n.parentId && idMap[n.parentId];
      const newPos = isParentDuplicated ? { ...n.position } : {
        x: Math.round((n.position.x + 30) / 10) * 10,
        y: Math.round((n.position.y + 30) / 10) * 10
      };
      return {
        ...n,
        id: newId,
        position: newPos,
        selected: true,
        data: {
          ...n.data,
          onStartEdit: takeSnapshot,
          onChange: (e) => updateNodeLabel(newId, e.target.value, true),
          onUpdateData: (newData) => updateNodeData(newId, newData)
        }
      };
    });

    newNodes.forEach(n => {
      if (n.parentId && idMap[n.parentId]) n.parentId = idMap[n.parentId];
      if (n.data?.switchId && idMap[n.data.switchId]) n.data.switchId = idMap[n.data.switchId];
    });

    const newEdges = edgesToDuplicate.map(e => ({
      ...e,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      source: idMap[e.source],
      target: idMap[e.target],
      selected: true
    }));

    setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
    setEdges(eds => eds.map(e => ({ ...e, selected: false })).concat(newEdges));

    if (onLogAction) onLogAction('NODES_DUPLICATED', { count: newNodes.length });
  }, [selectedNodes, nodes, edges, takeSnapshot, handleInteract, updateNodeLabel, updateNodeData, setNodes, setEdges, onLogAction]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

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
      
      const safeHotkeys = hotkeys || {};

      // Configurable F2 / rename hotkey (works automatically for the hovered block without selecting, or fallback to selected)
      if (checkHotkey(e, safeHotkeys.rename || ['F2']) && !isInput) {
        let targetNodeEl = null;

        // 1. Try to find the block under current mouse cursor
        if (lastMousePosRef.current && (lastMousePosRef.current.x || lastMousePosRef.current.y)) {
          const elUnderCursor = document.elementFromPoint(lastMousePosRef.current.x, lastMousePosRef.current.y);
          targetNodeEl = elUnderCursor?.closest('.react-flow__node');
        }

        // 2. If not hovering over a node, fallback to the single selected node (if any)
        if (!targetNodeEl && selectedNodes.length === 1) {
          targetNodeEl = document.querySelector(`.react-flow__node[data-id="${selectedNodes[0].id}"]`);
        }

        if (targetNodeEl) {
          e.preventDefault();

          // For container blocks with tags (WHILE, FOR, SWITCH, CASE): start typing directly into the tag input!
          const tagInput = targetNodeEl.querySelector('.custom-drag-handle input, .custom-drag-handle textarea');
          if (tagInput) {
            tagInput.focus();
            if (tagInput.select) tagInput.select();
            return;
          }

          // For standard blocks (ACTION, CONDITION, IO, START, COMMENT): activate double-click edit without selecting
          targetNodeEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
          const innerEditable = targetNodeEl.querySelector('.react-flow__node-default, [onDoubleClick], textarea, input');
          if (innerEditable) {
            innerEditable.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
          }

          setTimeout(() => {
            const inputEl = targetNodeEl.querySelector('textarea, input:not([type="checkbox"]):not([type="radio"])');
            if (inputEl) {
              inputEl.focus();
              if (inputEl.select) inputEl.select();
            }
          }, 15);
          return;
        }
      }

      // If user is typing in an input/textarea (pseudocode, python, inputs, etc.):
      // Do NOT hijack native editing shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V, etc.)
      // Only allow Alt-based shortcuts for diagram actions while in an input.
      if (isInput && !e.altKey) return;

      // When focus is on none (e.g. body, header, outside), only react if Diagram was the last active window!
      if (!isInput && activeWindowRef && activeWindowRef.current !== 'drawio') {
        return;
      }

      if (checkHotkey(e, safeHotkeys.delete) && !isInput) {
        let hoveredNodeId = null;
        let hoveredEdgeId = null;
        if (lastMousePosRef.current && (lastMousePosRef.current.x || lastMousePosRef.current.y)) {
          const elUnderCursor = document.elementFromPoint(lastMousePosRef.current.x, lastMousePosRef.current.y);
          const nodeEl = elUnderCursor?.closest('.react-flow__node');
          if (nodeEl) {
            hoveredNodeId = nodeEl.dataset.id || nodeEl.getAttribute('data-id');
          } else {
            const edgeEl = elUnderCursor?.closest('.react-flow__edge');
            if (edgeEl) {
              hoveredEdgeId = edgeEl.dataset.id || edgeEl.getAttribute('data-id');
            }
          }
        }

        if (hoveredNodeId) {
          e.preventDefault();
          const isAlreadySelected = selectedNodes.some(n => n.id === hoveredNodeId);
          if (!isAlreadySelected) {
            setNodes(nds => nds.map(n => ({ ...n, selected: n.id === hoveredNodeId })));
            setEdges(eds => eds.map(e => ({ ...e, selected: false })));
          }
          setDeleteConfirm(true);
          return;
        } else if (hoveredEdgeId) {
          e.preventDefault();
          const isAlreadySelected = selectedEdges.some(e => e.id === hoveredEdgeId);
          if (!isAlreadySelected) {
            setEdges(eds => eds.map(e => ({ ...e, selected: e.id === hoveredEdgeId })));
            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
          }
          setDeleteConfirm(true);
          return;
        } else if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          e.preventDefault();
          setDeleteConfirm(true);
          return;
        }
      } else if (checkHotkey(e, safeHotkeys.multiSelect) && !isInput) {
        e.preventDefault();
        if (lastMousePosRef.current && (lastMousePosRef.current.x || lastMousePosRef.current.y)) {
          const elUnderCursor = document.elementFromPoint(lastMousePosRef.current.x, lastMousePosRef.current.y);
          const nodeEl = elUnderCursor?.closest('.react-flow__node');
          if (nodeEl) {
            const targetId = nodeEl.dataset.id || nodeEl.getAttribute('data-id');
            if (targetId) {
              setNodes(nds => nds.map(n => n.id === targetId ? { ...n, selected: !n.selected } : n));
              handleInteract();
            }
          } else {
            const edgeEl = elUnderCursor?.closest('.react-flow__edge');
            if (edgeEl) {
              const targetId = edgeEl.dataset.id || edgeEl.getAttribute('data-id');
              if (targetId) {
                setEdges(eds => eds.map(edge => edge.id === targetId ? { ...edge, selected: !edge.selected } : edge));
                handleInteract();
              }
            }
          }
        }
      } else if (checkHotkey(e, safeHotkeys.selectAll) && !isInput) {
        e.preventDefault();
        setNodes(nds => nds.map(n => ({ ...n, selected: true })));
        setEdges(eds => eds.map(edge => ({ ...edge, selected: true })));
      } else if (checkHotkey(e, safeHotkeys.copy) && !isInput) { 
        e.preventDefault();
        if (selectedNodes.length === 0 && selectedEdges.length === 0 && lastMousePosRef.current) {
          const elUnderCursor = document.elementFromPoint(lastMousePosRef.current.x, lastMousePosRef.current.y);
          const nodeEl = elUnderCursor?.closest('.react-flow__node');
          if (nodeEl) {
            const hoveredId = nodeEl.dataset.id || nodeEl.getAttribute('data-id');
            const nodeToCopy = nodesRef.current.find(n => n.id === hoveredId);
            if (nodeToCopy) {
              setClipboard({ nodes: [nodeToCopy], edges: [] });
              if (onLogAction) onLogAction('NODES_COPIED', { count: 1 });
              return;
            }
          }
        }
        handleCopy(); 
      } else if (checkHotkey(e, safeHotkeys.paste) && !isInput) { 
        e.preventDefault(); handlePaste(); 
      } else if (checkHotkey(e, safeHotkeys.undo)) {
        e.preventDefault(); handleUndo();
      } else if (checkHotkey(e, safeHotkeys.redo)) {
        e.preventDefault(); handleRedo();
      } else if (checkHotkey(e, safeHotkeys.zoomIn || ['Ctrl++', 'Ctrl+=']) && !isInput) {
        e.preventDefault();
        const reactFlowEl = document.querySelector('.react-flow');
        if (reactFlowEl && lastMousePosRef.current && (lastMousePosRef.current.x || lastMousePosRef.current.y)) {
          const bounds = reactFlowEl.getBoundingClientRect();
          const { x: mouseX, y: mouseY } = lastMousePosRef.current;
          if (mouseX >= bounds.left && mouseX <= bounds.right && mouseY >= bounds.top && mouseY <= bounds.bottom) {
            const currentZoom = reactFlowInstance.getZoom();
            const newZoom = Math.min(3.0, currentZoom * 1.2);
            const flowPos = screenToFlowPosition({ x: mouseX, y: mouseY });
            const newX = mouseX - flowPos.x * newZoom;
            const newY = mouseY - flowPos.y * newZoom;
            reactFlowInstance.setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 150 });
            return;
          }
        }
        reactFlowInstance?.zoomIn();
      } else if (checkHotkey(e, safeHotkeys.zoomOut || ['Ctrl+-']) && !isInput) {
        e.preventDefault();
        const reactFlowEl = document.querySelector('.react-flow');
        if (reactFlowEl && lastMousePosRef.current && (lastMousePosRef.current.x || lastMousePosRef.current.y)) {
          const bounds = reactFlowEl.getBoundingClientRect();
          const { x: mouseX, y: mouseY } = lastMousePosRef.current;
          if (mouseX >= bounds.left && mouseX <= bounds.right && mouseY >= bounds.top && mouseY <= bounds.bottom) {
            const currentZoom = reactFlowInstance.getZoom();
            const newZoom = Math.max(0.2, currentZoom / 1.2);
            const flowPos = screenToFlowPosition({ x: mouseX, y: mouseY });
            const newX = mouseX - flowPos.x * newZoom;
            const newY = mouseY - flowPos.y * newZoom;
            reactFlowInstance.setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 150 });
            return;
          }
        }
        reactFlowInstance?.zoomOut();
      } else if (checkHotkey(e, safeHotkeys.contextMenu) && !isInput) {
        e.preventDefault();
        setContextMenu(prev => {
          const flowEl = document.querySelector('.react-flow');
          const bounds = flowEl ? flowEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
          const mouseX = lastMousePosRef.current ? lastMousePosRef.current.x : (bounds.left + bounds.width / 2);
          const mouseY = lastMousePosRef.current ? lastMousePosRef.current.y : (bounds.top + bounds.height / 2);
          if (prev && Math.hypot(prev.mouseX - mouseX, prev.mouseY - mouseY) < 15) {
            return null;
          }
          return { mouseX, mouseY, connectSource: null };
        });
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && !e.shiftKey && !e.altKey && !isInput && selectedNodes.length > 0) {
        e.preventDefault();
        handleDuplicate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes, selectedEdges, clipboard, readOnly, deleteConfirm, executeDelete, handleCopy, handlePaste, handleUndo, handleRedo, handleDuplicate, setNodes, setEdges, hotkeys, reactFlowInstance, screenToFlowPosition, handleInteract]);

  const getHitEdge = (event, draggedNodes, currentEdges) => {
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    if (!clientX || !clientY) return null;

    const originalStyles = [];
    draggedNodes.forEach(n => {
        const el = document.querySelector(`.react-flow__node[data-id="${n.id}"]`);
        if (el) { originalStyles.push({ el, val: el.style.visibility }); el.style.visibility = 'hidden'; }
    });

    let foundEdge = null;
    const draggedIds = new Set(draggedNodes.map(n => n.id));
    
    const offsets = [
        [0, 0], [0, -20], [0, 20], [-20, 0], [20, 0],
        [-20, -20], [20, -20], [-20, 20], [20, 20]
    ];
    for (const [dx, dy] of offsets) {
        const elemBelow = document.elementFromPoint(clientX + dx, clientY + dy);
        const closestEdge = elemBelow?.closest('.react-flow__edge');
        if (closestEdge) { 
            const edgeId = closestEdge.getAttribute('data-id');
            const targetEdge = currentEdges.find(e => e.id === edgeId);
            // Ignore edges that are internal to the dragged cluster
            if (targetEdge && draggedIds.has(targetEdge.source) && draggedIds.has(targetEdge.target)) {
                continue;
            }
            foundEdge = closestEdge; 
            break; 
        }
    }
    originalStyles.forEach(({ el, val }) => { el.style.visibility = val; });
    return foundEdge;
  };

  const onNodeDrag = useCallback((event, node) => {
    if (readOnly) return;
    setContextMenu(null); setShowExportMenu(false);

    const now = Date.now();
    if (now - (lastDragTimeRef.current || 0) < 50) return;
    lastDragTimeRef.current = now;

    let draggedNodes = nodes.filter(n => n.selected && n.type !== 'GROUP_BG');
    if (draggedNodes.length === 0) draggedNodes = [node];
    
    if (draggedNodes.some(n => n.type === 'COMMENT' || n.type === 'GROUP_BG' || n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER')) return;

    const draggedIds = new Set(draggedNodes.map(n => n.id));
    if (edges.some(e => (draggedIds.has(e.source) && !draggedIds.has(e.target)) || (draggedIds.has(e.target) && !draggedIds.has(e.source)))) return;

    // Morphing logic for dropping multiple nodes into a loop/for container
    if (draggedNodes.length > 1) {
        const allContainers = nodes.filter(n => n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER');
        const ptX = node.position.x + (node.measured?.width || 120) / 2;
        const ptY = node.position.y + (node.measured?.height || 50) / 2;
        
        const hoveredContainer = allContainers.find(c => {
            const cX = c.position.x;
            const cY = c.position.y;
            const cW = c.style?.width ? parseInt(c.style.width) : (c.measured?.width || (c.type === 'FOR_CONTAINER' ? 350 : 300));
            const cH = c.style?.height ? parseInt(c.style.height) : (c.measured?.height || (c.type === 'FOR_CONTAINER' ? 200 : 150));
            return ptX >= cX && ptX <= cX + cW && ptY >= cY && ptY <= cY + cH;
        });

        if (hoveredContainer) {
            const targets = calculateRestructuredLayout(draggedNodes, hoveredContainer);
            setNodes(nds => {
                let changed = false;
                const nextNodes = nds.map(n => {
                    if (targets.has(n.id)) {
                        const target = targets.get(n.id);
                        const dx = target.x - n.position.x;
                        const dy = target.y - n.position.y;
                        if (!n.data.morphOffset || Math.abs(n.data.morphOffset.x - dx) > 2 || Math.abs(n.data.morphOffset.y - dy) > 2) {
                            changed = true;
                            return { ...n, data: { ...n.data, morphOffset: { x: dx, y: dy } } };
                        }
                    } else if (n.data.morphOffset) {
                        changed = true;
                        return { ...n, data: { ...n.data, morphOffset: null } };
                    }
                    return n;
                });
                return changed ? nextNodes : nds;
            });
        } else {
            setNodes(nds => {
                if (!nds.some(n => n.data?.morphOffset)) return nds;
                return nds.map(n => n.data?.morphOffset ? { ...n, data: { ...n.data, morphOffset: null } } : n);
            });
        }
    }

    const edgeElem = getHitEdge(event, draggedNodes, edges);
    
    if (hoveredEdgeRef.current && hoveredEdgeRef.current !== edgeElem) {
        hoveredEdgeRef.current.classList.remove('drop-target');
        hoveredEdgeRef.current = null;
    }
    if (edgeElem && hoveredEdgeRef.current !== edgeElem) {
        edgeElem.classList.add('drop-target');
        hoveredEdgeRef.current = edgeElem;
    }
  }, [edges, nodes, readOnly, setNodes]);

  const onNodeDragStop = useCallback((event, node) => {
    if (readOnly) return;
    handleInteract();
    if (hoveredEdgeRef.current) { hoveredEdgeRef.current.classList.remove('drop-target'); hoveredEdgeRef.current = null; }

    let draggedNodes = nodes.filter(n => n.selected && n.type !== 'GROUP_BG');
    if (draggedNodes.length === 0) draggedNodes = [node];

    const draggedIds = new Set(draggedNodes.map(n => n.id));
    
    if (screenToFlowPosition) {
        const mousePos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const intersectingContainers = nodes.filter(n => {
            if (!['LOOP_CONTAINER', 'FOR_CONTAINER', 'SWITCH_CONTAINER', 'CASE_CONTAINER'].includes(n.type)) return false;
            if (draggedIds.has(n.id)) return false;
            
            let tcW = n.measured?.width || parseInt(n.style?.width || 0);
            let tcH = n.measured?.height || parseInt(n.style?.height || 0);
            if (!tcW && n.type === 'CASE_CONTAINER') tcW = 250;
            if (!tcH && n.type === 'CASE_CONTAINER') tcH = 150;
            if (!tcW && n.type === 'SWITCH_CONTAINER') tcW = 350;
            if (!tcH && n.type === 'SWITCH_CONTAINER') tcH = 230;

            return mousePos.x >= n.position.x && mousePos.x <= n.position.x + tcW &&
                   mousePos.y >= n.position.y && mousePos.y <= n.position.y + tcH;
        });

        const targetContainer = intersectingContainers.length > 0 ? intersectingContainers.sort((a, b) => {
            const areaA = (a.measured?.width || parseInt(a.style?.width || 250)) * (a.measured?.height || parseInt(a.style?.height || 150));
            const areaB = (b.measured?.width || parseInt(b.style?.width || 250)) * (b.measured?.height || parseInt(b.style?.height || 150));
            return areaA - areaB;
        })[0] : null;

        // Auto-disconnect if dragged out of a connected Case Container
        draggedNodes.forEach(dn => {
            const connectedCaseEdges = edges.filter(e => 
                (e.source === dn.id && e.targetHandle === 't-bottom') || 
                (e.target === dn.id && e.sourceHandle === 's-top')
            );
            
            connectedCaseEdges.forEach(e => {
                const caseId = e.source === dn.id ? e.target : e.source;
                const caseNode = nodes.find(n => n.id === caseId && n.type === 'CASE_CONTAINER');
                if (caseNode && (!targetContainer || targetContainer.id !== caseNode.id)) {
                    setEdges(eds => eds.filter(ed => ed.id !== e.id));
                    
                    const innerNodes = nodes.filter(n => {
                        if (['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER'].includes(n.type) || n.parentId || draggedIds.has(n.id)) return false;
                        let nX = n.position.x; let nY = n.position.y;
                        if (n.parentId) { const p = nodes.find(x => x.id === n.parentId); if (p) { nX += p.position.x; nY += p.position.y; } }
                        const cx = nX + (n.measured?.width || 100)/2;
                        const cy = nY + (n.measured?.height || 50)/2;
                        
                        let cX = caseNode.position.x; let cY = caseNode.position.y;
                        if (caseNode.parentId) { const p = nodes.find(x => x.id === caseNode.parentId); if (p) { cX += p.position.x; cY += p.position.y; } }
                        const cW = caseNode.measured?.width || parseInt(caseNode.style?.width || 250);
                        const cH = caseNode.measured?.height || parseInt(caseNode.style?.height || 150);
                        
                        return cx >= cX && cx <= cX + cW && cy >= cY && cy <= cY + cH;
                    });
                    
                    if (innerNodes.length > 0) {
                        innerNodes.sort((a, b) => a.position.y - b.position.y);
                        setEdges(eds => {
                            if (eds.find(ed => ed.id === e.id)) return eds; // already handled
                            const newEd = { ...e, id: `e_${Date.now()}_rewire` };
                            if (e.source === dn.id) newEd.source = innerNodes[innerNodes.length - 1].id;
                            else newEd.target = innerNodes[0].id;
                            return [...eds, newEd];
                        });
                    }
                }
            });
        });

        if (targetContainer) {
            let needsSnap = false;
            const newPositions = new Map();

            draggedNodes.forEach(dn => {
                const dnW = dn.measured?.width || parseInt(dn.style?.width || 100);
                const dnH = dn.measured?.height || parseInt(dn.style?.height || 50);
                const cx = dn.position.x + dnW/2;
                const cy = dn.position.y + dnH/2;
                
                const tcW = targetContainer.measured?.width || parseInt(targetContainer.style?.width || 250);
                const tcH = targetContainer.measured?.height || parseInt(targetContainer.style?.height || 150);

                if (cx < targetContainer.position.x || cx > targetContainer.position.x + tcW ||
                    cy < targetContainer.position.y || cy > targetContainer.position.y + tcH) {
                    newPositions.set(dn.id, { x: mousePos.x - dnW/2, y: mousePos.y - dnH/2 });
                    needsSnap = true;
                }
            });

            if (needsSnap) {
                setNodes(nds => nds.map(n => newPositions.has(n.id) ? { ...n, position: newPositions.get(n.id) } : n));
            }

            if (targetContainer.type === 'CASE_CONTAINER' && draggedNodes.length === 1) {
                const dn = draggedNodes[0];
                if (['PROCESS', 'IO', 'CONDITION'].includes(dn.type)) {
                    // Check if it's the ONLY node in the case
                    const innerNodes = nodes.filter(n => {
                        if (['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER'].includes(n.type) || n.parentId || n.id === dn.id) return false;
                        let nX = n.position.x; let nY = n.position.y;
                        if (n.parentId) { const p = nodes.find(x => x.id === n.parentId); if (p) { nX += p.position.x; nY += p.position.y; } }
                        const cx = nX + (n.measured?.width || 100)/2;
                        const cy = nY + (n.measured?.height || 50)/2;
                        
                        let tcX = targetContainer.position.x; let tcY = targetContainer.position.y;
                        if (targetContainer.parentId) { const p = nodes.find(x => x.id === targetContainer.parentId); if (p) { tcX += p.position.x; tcY += p.position.y; } }
                        const cW = targetContainer.measured?.width || parseInt(targetContainer.style?.width || 250);
                        const cH = targetContainer.measured?.height || parseInt(targetContainer.style?.height || 150);
                        
                        return cx >= tcX && cx <= tcX + cW && cy >= tcY && cy <= tcY + cH;
                    });
                    
                    if (innerNodes.length === 0) {
                        setEdges(eds => {
                            // First remove any existing connections from the container
                            const filteredEds = eds.filter(e => !(e.source === targetContainer.id && e.sourceHandle === 's-top') && !(e.target === targetContainer.id && e.targetHandle === 't-bottom'));
                            const newEd1 = { id: `e_${Date.now()}_1`, source: targetContainer.id, target: dn.id, sourceHandle: 's-top', targetHandle: 't-top', type: 'customEdge', data: { edgeStyle: 'straight' }, markerEnd: { type: MarkerType.ArrowClosed } };
                            const newEd2 = { id: `e_${Date.now()}_2`, source: dn.id, target: targetContainer.id, sourceHandle: 's-bottom', targetHandle: 't-bottom', type: 'customEdge', data: { edgeStyle: 'straight' }, markerEnd: { type: MarkerType.ArrowClosed } };
                            return [...filteredEds, newEd1, newEd2];
                        });
                    }
                }
            }
        }
    }

    if (draggedNodes.some(n => n.type === 'COMMENT' || n.type === 'GROUP_BG' || n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER')) return;

    if (edges.some(e => (draggedIds.has(e.source) && !draggedIds.has(e.target)) || (draggedIds.has(e.target) && !draggedIds.has(e.source)))) return;

    if (draggedNodes.length > 1) {
        let appliedMorph = false;
        let newNodes = [];
        
        nodes.forEach(n => {
            if (draggedIds.has(n.id) && n.data.morphOffset) {
                appliedMorph = true;
                const newPos = {
                    x: n.position.x + n.data.morphOffset.x,
                    y: n.position.y + n.data.morphOffset.y
                };
                newNodes.push({ ...n, position: newPos, data: { ...n.data, morphOffset: null } });
            } else if (n.data.morphOffset) {
                newNodes.push({ ...n, data: { ...n.data, morphOffset: null } });
            } else {
                newNodes.push(n);
            }
        });
        
        if (appliedMorph) {
            setNodes(newNodes);
            if(onLogAction) onLogAction('DRAG_AND_DROP_ROUTING', { draggedCount: draggedNodes.length, type: 'MORPH_LAYOUT' });
            return; // Skip standard edge drop!
        }
    }

    const edgeElem = getHitEdge(event, draggedNodes, edges);

    if (edgeElem) {
        const edgeId = edgeElem.getAttribute('data-id');
        const targetEdge = edges.find(e => e.id === edgeId);
        
        if (targetEdge) {
            if(onLogAction) onLogAction('DRAG_AND_DROP_ROUTING', { draggedCount: draggedNodes.length });
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
  }, [edges, nodes, setEdges, edgeStyle, readOnly, handleInteract, onLogAction]);


  
  useEffect(() => {
    if (xml && xml !== lastXmlRef.current) {
      lastXmlRef.current = xml;
      const { nodes: parsedNodes, edges: parsedEdges } = drawioToReactFlow(xml);
      setNodes(prev => parsedNodes.map(n => ({ 
          ...n, 
          selected: prev.find(p => p.id === n.id)?.selected || false, 
          data: { ...n.data, readOnly, edgeStyle, onStartEdit: takeSnapshot, onChange: (e) => updateNodeLabel(n.id, e.target.value, true), onUpdateData: (newData) => updateNodeData(n.id, newData) } 
      })));
      
      setEdges(prev => parsedEdges.map(e => ({ 
          ...e, 
          type: 'customEdge',
          selected: prev.find(p => p.id === e.id)?.selected || false, 
          data: { ...e.data, readOnly, edgeStyle }, 
          markerEnd: { type: MarkerType.ArrowClosed } 
      })));
    }
  }, [xml, readOnly, edgeStyle, setNodes, setEdges, updateNodeLabel, updateNodeData]);

  // =========================================================================================
  // CRITICAL WARNING: XML EMISSION & INTERACTION FLAG
  // DO NOT modify `isUserInteractionRef.current` logic here. It guarantees priority is only
  // shifted in App.jsx when the user *physically interacted* with the diagram.
  // =========================================================================================
  useEffect(() => {
    if (readOnly) return;
    
    const timer = setTimeout(() => {
      const exportNodes = nodes.filter(n => n.type !== 'GROUP_BG');
      const generatedXml = reactFlowToDrawio(exportNodes, edges);
      if (generatedXml !== lastXmlRef.current) { 
          lastXmlRef.current = generatedXml; 
          if (onXmlChangeRef.current) onXmlChangeRef.current(generatedXml, isUserInteractionRef.current); 
          isUserInteractionRef.current = false;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [nodes, edges, readOnly]);

  const isValidConnection = useCallback((connection) => {
    const sourceNode = getNode(connection.source);
    const targetNode = getNode(connection.target);

    if (!sourceNode || !targetNode) return false;

    if (targetNode.type === 'START_END' && targetNode.data?.mode === 'start') return false;
    if (sourceNode.type === 'START_END' && sourceNode.data?.mode === 'end') return false;
    if (targetNode.type === 'START_END' && targetNode.data?.mode === 'end' && connection.targetHandle !== 't-top') return false;
    if (connection.source === connection.target && sourceNode.type !== 'CONDITION') return false;

    // Validate Case Container: MUST connect to something INSIDE it
    const isInside = (innerNode, containerNode) => {
        const cx = (innerNode.positionAbsolute?.x || innerNode.position.x) + (innerNode.measured?.width || 100) / 2;
        const cy = (innerNode.positionAbsolute?.y || innerNode.position.y) + (innerNode.measured?.height || 50) / 2;
        const cX = containerNode.positionAbsolute?.x || containerNode.position.x;
        const cY = containerNode.positionAbsolute?.y || containerNode.position.y;
        const cW = containerNode.measured?.width || parseInt(containerNode.style?.width || 250);
        const cH = containerNode.measured?.height || parseInt(containerNode.style?.height || 150);
        return cx >= cX && cx <= cX + cW && cy >= cY && cy <= cY + cH;
    };

    if (sourceNode.type === 'CASE_CONTAINER' && !isInside(targetNode, sourceNode)) return false;
    if (targetNode.type === 'CASE_CONTAINER' && !isInside(sourceNode, targetNode)) return false;

    // Validate Switch Container: MUST NOT connect to something INSIDE it
    if (sourceNode.type === 'SWITCH_CONTAINER' && isInside(targetNode, sourceNode)) return false;
    if (targetNode.type === 'SWITCH_CONTAINER' && isInside(sourceNode, targetNode)) return false;

    return true;
  }, [getNode]);

  const connectingNodeRef = useRef(null);

  const onConnect = useCallback((params) => {
    takeSnapshot();
    handleInteract();
    if(onLogAction) onLogAction('EDGE_CONNECTED', { source: params.source, target: params.target });
    const sourceNode = getNode(params.source);
    const targetNode = getNode(params.target);
    
    if (sourceNode?.type === 'START_END' && sourceNode.data?.mode === 'unassigned') updateNodeData(params.source, { mode: 'start', label: 'main' });
    if (targetNode?.type === 'START_END' && targetNode.data?.mode === 'unassigned') updateNodeData(params.target, { mode: 'end', label: 'ENDFUNCTION' });

    let data = { edgeStyle };
    if (sourceNode?.type === 'CONDITION') {
        const currentEdges = getEdges();
        const outEdges = currentEdges.filter(e => e.source === params.source);
        const pref = edgeLabels[edgeStyle || 'true-false'];
        
        let newLabel = params.sourceHandle === 's-right' ? pref.f : pref.t;
        
        if (outEdges.length === 1) {
            const existingLabel = outEdges[0].data?.label;
            const isPos = ['+', 'Ano', 'Yes', 'True'].includes(existingLabel);
            if (isPos) newLabel = pref.f;
            else newLabel = pref.t;
        }
        data.label = newLabel;
    }

    setEdges(eds => {
        let filteredEds = eds.filter(e => {
            // Remove existing outgoing edge on the source handle
            if (sourceNode && sourceNode.type !== 'CONDITION' && e.source === params.source) return false;
            if (sourceNode && sourceNode.type === 'CONDITION' && e.source === params.source && e.sourceHandle === params.sourceHandle) return false;
            
            // Remove existing incoming edge on the target handle
            if (e.target === params.target && (e.targetHandle === params.targetHandle || (!params.targetHandle && !e.targetHandle))) return false;

            return true;
        });
        return addEdge({ ...params, type: 'customEdge', data, markerEnd: { type: MarkerType.ArrowClosed } }, filteredEds);
    });
  }, [edgeStyle, updateNodeData, handleInteract, setEdges, getNode, onLogAction, getEdges, takeSnapshot]);

  const addNodeAt = React.useCallback((type, label, clientPos = null, connectSource = null) => {
    if (readOnly) return;
    takeSnapshot();
    handleInteract();
    if(onLogAction) onLogAction('NODE_ADDED', { type, label });
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
        data: { 
            label, 
            readOnly, 
            ...(type === 'START_END' ? { mode: 'unassigned', entityType: 'FUNCTION' } : {}), 
            ...((type === 'LOOP_CONTAINER' || type === 'FOR_CONTAINER') ? { isNew: true, doWhile: false } : {}),
            ...(type === 'IO' ? { ioType: 'input' } : {}),
            onStartEdit: takeSnapshot,
            onChange: (e) => updateNodeLabel(newId, e.target.value, true),
            onUpdateData: (newData) => updateNodeData(newId, newData)
        },
        ...(type === 'LOOP_CONTAINER' ? { style: { width: 350, height: 200 } } : {}),
        ...(type === 'FOR_CONTAINER' ? { style: { width: 350, height: 200 } } : {}),
        ...(type === 'SWITCH_CONTAINER' ? { style: { width: 450, height: 250 } } : {})
    }));

    const conn = connectSource || clientPos?.connectSource;
    if (conn && conn.nodeId) {
        setTimeout(() => {
            onConnect({
                source: conn.nodeId,
                sourceHandle: conn.handleId || 's-bottom',
                target: newId,
                targetHandle: 't-top'
            });
        }, 50);
    }
  }, [readOnly, handleInteract, onLogAction, screenToFlowPosition, setNodes, updateNodeData, updateNodeLabel, takeSnapshot, onConnect]);

  const handlePaneContextMenu = useCallback((e) => { 
    if (readOnly) return; 
    e.preventDefault(); 
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, connectSource: connectingNodeRef.current }); 
    connectingNodeRef.current = null;
  }, [readOnly]);

  const handleExportEduCode = () => {
    setShowExportMenu(false);
    if(onLogAction) onLogAction('EXPORT_XML_EDUCODE');
    const a = document.createElement('a'); a.href = "data:text/xml;charset=utf-8," + encodeURIComponent(xml); a.download = 'educode_diagram.xml'; a.click();
  };

  const handleExportDrawioStandard = () => {
    setShowExportMenu(false);
    if(onLogAction) onLogAction('EXPORT_XML_STANDARD');
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    doc.querySelectorAll('mxCell').forEach(c => ['type', 'mode', 'entityType', 'edgeStyle', 'ioType'].forEach(attr => c.removeAttribute(attr)));
    const a = document.createElement('a'); a.href = "data:text/xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(doc)); a.download = 'standard_diagram.drawio'; a.click();
  };

  const executeImport = (mode) => {
    const xmlData = pendingImport;
    setPendingImport(null);
    
    if (mode === 'replace') {
        const { nodes: newNodes, edges: newEdges } = drawioToReactFlow(xmlData);
        if (screenToFlowPosition) {
            const centerPos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
            let minNewX = Infinity, minNewY = Infinity, maxNewX = -Infinity, maxNewY = -Infinity;
            newNodes.forEach(n => {
                if (n.position.x < minNewX) minNewX = n.position.x;
                if (n.position.y < minNewY) minNewY = n.position.y;
                if (n.position.x > maxNewX) maxNewX = n.position.x + 150;
                if (n.position.y > maxNewY) maxNewY = n.position.y + 50;
            });
            if (minNewX !== Infinity) {
                const centerX = (minNewX + maxNewX) / 2;
                const centerY = (minNewY + maxNewY) / 2;
                const offsetX = centerPos.x - centerX;
                const offsetY = centerPos.y - centerY;
                newNodes.forEach(n => {
                    n.position.x += offsetX;
                    n.position.y += offsetY;
                });
            }
        }
        const updatedXml = reactFlowToDrawio(newNodes, newEdges);
        if(onImportXmlRef.current) onImportXmlRef.current(updatedXml);
        else if(onXmlChangeRef.current) onXmlChangeRef.current(updatedXml);
    } else if (mode === 'add') {
        const { nodes: newNodes, edges: newEdges } = drawioToReactFlow(xmlData);
        
        let offsetX = 0;
        let offsetY = 0;
        
        const existingRealNodes = nodes.filter(n => n.type !== 'GROUP_BG');
        if (existingRealNodes.length > 0) {
            let maxCurrentX = -Infinity;
            let currentMinY = Infinity;
            existingRealNodes.forEach(n => {
                const rightEdge = n.position.x + (n.measured?.width || 150);
                if (rightEdge > maxCurrentX) maxCurrentX = rightEdge;
                if (n.position.y < currentMinY) currentMinY = n.position.y;
            });
            
            let minNewX = Infinity;
            let minNewY = Infinity;
            newNodes.forEach(n => {
                if (n.position.x < minNewX) minNewX = n.position.x;
                if (n.position.y < minNewY) minNewY = n.position.y;
            });

            if (maxCurrentX !== -Infinity && minNewX !== Infinity) {
                offsetX = (maxCurrentX + 100) - minNewX;
                offsetY = currentMinY - minNewY;
            }
        } else {
            const centerPos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
            let minNewX = Infinity;
            let minNewY = Infinity;
            let maxNewX = -Infinity;
            let maxNewY = -Infinity;
            newNodes.forEach(n => {
                if (n.position.x < minNewX) minNewX = n.position.x;
                if (n.position.y < minNewY) minNewY = n.position.y;
                if (n.position.x > maxNewX) maxNewX = n.position.x + 150;
                if (n.position.y > maxNewY) maxNewY = n.position.y + 50;
            });
            if (minNewX !== Infinity) {
                const centerX = (minNewX + maxNewX) / 2;
                const centerY = (minNewY + maxNewY) / 2;
                offsetX = centerPos.x - centerX;
                offsetY = centerPos.y - centerY;
            }
        }
        
        const idMap = {};
        const mappedNodes = newNodes.map(n => {
            const newId = 'node_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            idMap[n.id] = newId;
            return { 
                ...n, 
                id: newId, 
                position: { x: n.position.x + offsetX, y: n.position.y + offsetY }, 
                selected: true, 
                data: { ...n.data, readOnly, edgeStyle, onStartEdit: takeSnapshot, onChange: (e) => updateNodeLabel(newId, e.target.value, true), onUpdateData: (newData) => updateNodeData(newId, newData) } 
            };
        });
        
        const mappedEdges = newEdges.map(e => ({ 
            ...e, 
            id: 'edge_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
            source: idMap[e.source] || e.source, 
            target: idMap[e.target] || e.target, 
            selected: true,
            type: 'customEdge',
            data: { ...e.data, readOnly, edgeStyle }, 
            markerEnd: { type: MarkerType.ArrowClosed } 
        }));

        setNodes(prev => prev.map(n => ({...n, selected: false})).concat(mappedNodes));
        setEdges(prev => prev.map(e => ({...e, selected: false})).concat(mappedEdges));
        handleInteract();
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    const reader = new FileReader(); 
    reader.onload = (ev) => {
        const content = ev.target.result;
        const hasContent = nodes.filter(n => n.type !== 'GROUP_BG').length > 0;
        
        if(onLogAction) onLogAction('FILE_IMPORTED');
        
        if (hasContent) {
            setPendingImport(content);
        } else {
            if(onImportXmlRef.current) onImportXmlRef.current(content);
            else if(onXmlChangeRef.current) onXmlChangeRef.current(content);
        }
    }; 
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const btnClass = `p-2 rounded transition-opacity disabled:opacity-25 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 ${colorMode ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"}`;

  const panActivationKeyCode = useMemo(() => {
    const slots = Array.isArray(safeHotkeys.pan) ? safeHotkeys.pan : (safeHotkeys.pan ? [safeHotkeys.pan] : []);
    const keySlot = slots.find(s => !s.toLowerCase().includes('mouse'));
    return keySlot || 'Space';
  }, [safeHotkeys.pan]);

  const multiSelectionKeyCode = useMemo(() => {
    const slots = Array.isArray(safeHotkeys.multiSelect) ? safeHotkeys.multiSelect : (safeHotkeys.multiSelect ? [safeHotkeys.multiSelect] : []);
    const keys = [];
    slots.forEach(s => {
      const lower = s.toLowerCase();
      if (lower.includes('ctrl')) keys.push('Control', 'Meta');
      if (lower.includes('shift')) keys.push('Shift');
      if (lower.includes('alt')) keys.push('Alt');
      const parts = s.split('+');
      const lastKey = parts[parts.length - 1].trim();
      if (lastKey && !lastKey.toLowerCase().includes('klik') && !lastKey.toLowerCase().includes('mouse')) {
        keys.push(lastKey);
      }
    });
    return keys.length > 0 ? keys : ['Control', 'Meta'];
  }, [safeHotkeys.multiSelect]);

  const selectionKeyCode = useMemo(() => {
    const slots = Array.isArray(safeHotkeys.lassoSelect) ? safeHotkeys.lassoSelect : (safeHotkeys.lassoSelect ? [safeHotkeys.lassoSelect] : []);
    const keys = [];
    slots.forEach(s => {
      const lower = s.toLowerCase();
      if (lower.includes('shift')) keys.push('Shift');
      if (lower.includes('ctrl')) keys.push('Control', 'Meta');
      if (lower.includes('alt')) keys.push('Alt');
      const parts = s.split('+');
      const lastKey = parts[parts.length - 1].trim();
      if (lastKey && !lastKey.toLowerCase().includes('tažení') && !lastKey.toLowerCase().includes('drag') && !lastKey.toLowerCase().includes('mouse')) {
        keys.push(lastKey);
      }
    });
    return keys.length > 0 ? keys : ['Shift'];
  }, [safeHotkeys.lassoSelect]);

  return (
    <div className="w-full h-full relative outline-none" tabIndex={0} onClick={() => { setContextMenu(null); setShowExportMenu(false); }} onPointerMove={handlePointerMove} onPointerUp={clearHover} onPointerLeave={clearHover}>
      <style>{`.react-flow__edge.drop-target .react-flow__edge-path { stroke: #4f46e5 !important; stroke-width: 4px !important; filter: drop-shadow(0 0 6px rgba(79,70,229,0.5)); transition: all 0.2s ease; }`}</style>
      
      {hoveredToolbarItem && hoverProgress > 0 && (
          <div className="fixed z-[200] pointer-events-none flex items-center justify-center" style={{ left: cursorPos.x + 15, top: cursorPos.y + 15 }}>
              <div className="relative w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path className="text-gray-200 dark:text-gray-700" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-indigo-500" strokeWidth="3" strokeDasharray={`${hoverProgress}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm relative z-10">?</span>
              </div>
          </div>
      )}
      
      {deleteConfirm && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-gray-900/20 backdrop-blur-sm rounded-lg">
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold mb-2 dark:text-gray-100">Smazat vybrané prvky?</h3>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm dark:text-gray-300 transition-colors">Zrušit (Esc)</button>
              <button onClick={executeDelete} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors">Smazat (Enter)</button>
            </div>
          </div>
        </div>
      )}

      {pendingImport && (
        <div className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 text-center m-4">
            <h3 className="font-bold text-xl mb-3 text-gray-900 dark:text-white">Importovat diagram</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">Pracovní plocha již obsahuje diagram. Jak chcete pokračovat?</p>
            <div className="flex flex-col gap-2">
                <button onClick={() => executeImport('replace')} className="w-full px-4 py-2.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-300 font-bold rounded-lg transition-colors">Nahradit stávající</button>
                <button onClick={() => executeImport('add')} className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm">Přidat k současnému</button>
                <button onClick={() => setPendingImport(null)} className="w-full px-4 py-2 mt-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors">Zrušit</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={(e) => e.preventDefault()} />
            
            {contextMenu.connectSource && (() => {
              const srcNode = getNode(contextMenu.connectSource.nodeId);
              if (!srcNode || !reactFlowInstance.getViewport) return null;
              
              let portOffsetX = (srcNode.measured?.width || 140) / 2;
              let portOffsetY = (srcNode.measured?.height || 50) / 2;
              
              if (contextMenu.connectSource.handleId === 's-bottom') {
                  portOffsetY = srcNode.measured?.height || 50;
              } else if (contextMenu.connectSource.handleId === 's-right') {
                  portOffsetX = srcNode.measured?.width || 140;
              }
              
              const { x: transformX, y: transformY, zoom } = reactFlowInstance.getViewport();
              const flowEl = document.querySelector('.react-flow');
              const bounds = flowEl ? flowEl.getBoundingClientRect() : { left: 0, top: 0 };
              
              const screenPos = {
                  x: (srcNode.position.x + portOffsetX) * zoom + transformX + bounds.left,
                  y: (srcNode.position.y + portOffsetY) * zoom + transformY + bounds.top
              };
              
              const menuWidth = 170;
              const menuHeight = 260; 
              
              let menuLeft = contextMenu.mouseX;
              if (contextMenu.mouseX + menuWidth > window.innerWidth) {
                  menuLeft = window.innerWidth - (window.innerWidth - contextMenu.mouseX) - menuWidth;
              }
              
              let menuTop = contextMenu.mouseY;
              if (contextMenu.mouseY + menuHeight > window.innerHeight) {
                  menuTop = window.innerHeight - (window.innerHeight - contextMenu.mouseY) - menuHeight;
              }
              
              const targetX = menuLeft + menuWidth / 2;
              const targetY = menuTop;
              
              const isRight = contextMenu.connectSource.handleId === 's-right';
              let pathD = '';
              if (isRight) {
                  const midX = (screenPos.x + targetX) / 2;
                  pathD = `M ${screenPos.x} ${screenPos.y} L ${midX} ${screenPos.y} L ${midX} ${targetY} L ${targetX} ${targetY}`;
              } else {
                  const midY = (screenPos.y + targetY) / 2;
                  pathD = `M ${screenPos.x} ${screenPos.y} L ${screenPos.x} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
              }
              
              return (
                <svg className="fixed inset-0 pointer-events-none z-[9997]" style={{ width: '100vw', height: '100vh' }}>
                  <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinejoin="round" strokeDasharray="6,6" className="animate-pulse drop-shadow-md" />
                  <circle cx={screenPos.x} cy={screenPos.y} r="4" fill="#6366f1" />
                  <polygon points={`${targetX-4},${targetY-8} ${targetX+4},${targetY-8} ${targetX},${targetY}`} fill="#6366f1" />
                </svg>
              );
            })()}

            {(() => {
                const menuWidth = 170;
                const menuHeight = 260; // Estimated height with items
                let style = {};
                
                if (contextMenu.mouseX + menuWidth > window.innerWidth) {
                    style.right = window.innerWidth - contextMenu.mouseX;
                } else {
                    style.left = contextMenu.mouseX;
                }
                
                if (contextMenu.mouseY + menuHeight > window.innerHeight) {
                    style.bottom = window.innerHeight - contextMenu.mouseY;
                } else {
                    style.top = contextMenu.mouseY;
                }

                return (
                  <div 
                    className={`fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl flex flex-col pb-1 overflow-hidden min-w-[170px] ${!contextMenu.connectSource ? 'pt-1' : ''}`} 
                    style={style}
                  >
                {contextMenu.connectSource ? (
                  <div className="px-3 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-indigo-800/60 flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <Link2 size={13} className="animate-pulse shrink-0" />
                      <span>Napojit na blok</span>
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-1 border-b border-gray-100 dark:border-gray-700/50 mb-1 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Přidat blok
                  </div>
                )}
                {[
                  {type: 'START_END', label: 'Start/End', icon: Circle, color: colorMode ? "text-fuchsia-500" : "text-gray-500"},
                  {type: 'ACTION', label: 'Operace', icon: Square, color: colorMode ? "text-blue-500" : "text-gray-500"},
                  {type: 'IO', label: 'Vstup/Výstup', icon: Square, color: colorMode ? "text-emerald-500" : "text-gray-500"},
                  {type: 'CONDITION', label: 'Podmínka', icon: Diamond, color: colorMode ? "text-orange-500" : "text-gray-500"},
                  ...(editorMode !== 'advanced' ? [
                    {type: 'LOOP_CONTAINER', label: 'Cyklus (Skupina)', icon: Hexagon, color: colorMode ? "text-purple-500" : "text-gray-500"},
                    {type: 'FOR_CONTAINER', label: 'FOR Cyklus', icon: Box, color: colorMode ? "text-indigo-500" : "text-gray-500"},
                    {type: 'SWITCH_CONTAINER', label: 'Switch (Větvení)', icon: Columns, color: colorMode ? "text-rose-500" : "text-gray-500"}
                  ] : []),
                  {type: 'COMMENT', label: 'Komentář', icon: MessageSquare, color: colorMode ? "text-yellow-500" : "text-gray-500"}
                ].filter(item => {
                  if (!contextMenu.connectSource) return true;
                  return item.type !== 'COMMENT';
                }).map(item => (
                  <button key={item.type} onClick={() => { 
                    let t = item.type;
                    let txt = item.type === 'COMMENT'?'Komentář':(item.type==='CONDITION'?'x>0':(item.type==='IO'?'x':(item.type==='LOOP_CONTAINER'?'':'')));
                    if (t === 'FOR_CONTAINER' || t === 'SWITCH_CONTAINER') { txt = ''; }
                    
                    if (contextMenu.connectSource && (t === 'LOOP_CONTAINER' || t === 'FOR_CONTAINER')) {
                        // Create the container at the current position without connecting it
                        addNodeAt(t, txt, { mouseX: contextMenu.mouseX, mouseY: contextMenu.mouseY });
                        // Move the context menu slightly so the inner block is spawned inside the container
                        setContextMenu({
                            ...contextMenu,
                            mouseX: contextMenu.mouseX + 40,
                            mouseY: contextMenu.mouseY + 40
                        });
                        return;
                    }
                    
                    addNodeAt(t, txt, contextMenu); 
                    setContextMenu(null); 
                  }} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    {item.type === 'IO' ? <IoIcon size={14} className={item.color} /> : <item.icon size={14} className={item.color} />} {item.label}
                  </button>
                ))}                </div>
                );
            })()}
        </>
      )}


      <div className="absolute top-4 left-4 z-10 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 dark:border-gray-700">
        <button data-testid="Start/Konec" onClick={() => { clearHover(); addNodeAt('START_END', ''); }} onMouseEnter={(e) => handlePointerDown('START_END', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('START_END', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Circle size={18} className={colorMode ? "text-fuchsia-600" : ""} /></button>
        <button data-testid="Operace" onClick={() => { clearHover(); addNodeAt('ACTION', 'Operace'); }} onMouseEnter={(e) => handlePointerDown('ACTION', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('ACTION', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Square size={18} className={colorMode ? "text-blue-600" : ""} /></button>
        <button data-testid="Vstup/Výstup" onClick={() => { clearHover(); addNodeAt('IO', 'x'); }} onMouseEnter={(e) => handlePointerDown('IO', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('IO', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><IoIcon size={18} className={colorMode ? "text-emerald-600" : ""} /></button>
        <button data-testid="Podmínka" onClick={() => { clearHover(); addNodeAt('CONDITION', 'x > 0'); }} onMouseEnter={(e) => handlePointerDown('CONDITION', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('CONDITION', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Diamond size={18} className={colorMode ? "text-orange-600" : ""} /></button>
        {editorMode !== 'advanced' && (
          <>
            <button data-testid="Cyklus" onClick={() => { clearHover(); addNodeAt('LOOP_CONTAINER', ''); }} onMouseEnter={(e) => handlePointerDown('LOOP_CONTAINER', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('LOOP_CONTAINER', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Hexagon size={18} className={colorMode ? "text-purple-600" : ""} /></button>
            <button data-testid="FOR Cyklus" onClick={() => { clearHover(); addNodeAt('FOR_CONTAINER', ''); }} onMouseEnter={(e) => handlePointerDown('FOR_CONTAINER', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('FOR_CONTAINER', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Box size={18} className={colorMode ? "text-indigo-600" : ""} /></button>
            <button data-testid="Switch" onClick={() => { clearHover(); addNodeAt('SWITCH_CONTAINER', 'x'); }} onMouseEnter={(e) => handlePointerDown('SWITCH_CONTAINER', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('SWITCH_CONTAINER', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Columns size={18} className={colorMode ? "text-rose-600" : ""} /></button>
          </>
        )}
        <button data-testid="Komentář" onClick={() => { clearHover(); addNodeAt('COMMENT', 'Komentář'); }} onMouseEnter={(e) => handlePointerDown('COMMENT', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('COMMENT', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><MessageSquare size={18} className={colorMode ? "text-yellow-600" : ""} /></button>
      </div>

      {(selectedNodes.length > 0 || selectedEdges.length > 0) && !readOnly && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-2 bg-indigo-600 p-1.5 rounded-lg shadow-lg">
           <button onClick={handleDuplicate} disabled={selectedNodes.length === 0} className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium ${selectedNodes.length === 0 ? 'text-indigo-300 opacity-50 cursor-not-allowed' : 'text-white hover:bg-indigo-500'}`}><Copy size={16}/> Duplikovat</button>
           <div className="w-px bg-indigo-400 mx-1"></div>
           <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-1 text-red-100 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded text-sm font-medium"><Trash2 size={16}/> Smazat</button>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 dark:border-gray-700">
        <Tooltip text="Import diagramu" position="bottom">
          <label className={`p-2 rounded cursor-pointer text-gray-700 dark:text-gray-300 ${readOnly ? 'opacity-25 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <Upload size={18}/>
            <input type="file" accept=".xml,.drawio,.json" className="hidden" onChange={handleImport} disabled={readOnly} />
          </label>
        </Tooltip>
        <div className="relative">
            <Tooltip text="Export diagramu" position="bottom">
              <button onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors"><Download size={18}/></button>
            </Tooltip>
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
          attributionPosition="bottom-left"
          multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
          onNodesChange={(changes) => { 
              const isUserChange = changes.some(c => c.type !== 'dimensions' && c.type !== 'replace');
              if (isUserChange) handleInteract(); 
              if (!readOnly) onNodesChange(changes); 
          }} 
          onEdgesChange={(changes) => { 
              const isUserChange = changes.some(c => c.type !== 'replace');
              if (isUserChange) handleInteract(); 
              if (!readOnly) onEdgesChange(changes); 
          }} 
          onConnect={(params) => { if (!readOnly) onConnect(params); }} 
          onConnectStart={(event, params) => { connectingNodeRef.current = params; }}
          onConnectEnd={() => { setTimeout(() => { if (!contextMenu) connectingNodeRef.current = null; }, 150); }}
          onNodeDragStart={() => { takeSnapshot(); handleInteract(); }}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={() => { handleInteract(); setContextMenu(null); setShowExportMenu(false); if (onPaneClickRef.current) onPaneClickRef.current(); }}
          onSelectionChange={({ nodes }) => { if (onSelectionChangeRef.current) onSelectionChangeRef.current(nodes.filter(n => n.type !== 'GROUP_BG').map(n => n.id)); }}
          isValidConnection={isValidConnection} 
          nodeTypes={nodeTypes} edgeTypes={edgeTypes} 
          defaultEdgeOptions={{ type: 'customEdge', markerEnd: { type: MarkerType.ArrowClosed } }}
          fitView 
          fitViewOptions={{ maxZoom: 1.1, padding: 0.2 }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
          minZoom={0.2}
          maxZoom={3.0}
          connectionLineType={ConnectionLineType.SmoothStep}
          deleteKeyCode={null} selectionOnDrag={true} panOnDrag={[1, 2]} panOnScroll={true} selectionMode={selectionMode === 'full' ? 'full' : 'partial'}
          multiSelectionKeyCode={multiSelectionKeyCode}
          selectionKeyCode={selectionKeyCode}
          panActivationKeyCode={panActivationKeyCode}
          elementsSelectable={isInteractive && !readOnly}
          nodesDraggable={isInteractive && !readOnly}
          nodesConnectable={isInteractive && !readOnly}
          elevateNodesOnSelect={false}
          zoomOnDoubleClick={false}
        >
          <Background color={isDarkMode ? "#334155" : "#cbd5e1"} gap={16} />
          <Controls showZoom={false} showFitView={false} showInteractive={false} className="mb-8">
            <Tooltip text="Přiblížit" position="right"><ControlButton onClick={() => reactFlowInstance.zoomIn()}><Plus size={16}/></ControlButton></Tooltip>
            <Tooltip text="Oddálit" position="right"><ControlButton onClick={() => reactFlowInstance.zoomOut()}><Minus size={16}/></ControlButton></Tooltip>
            <Tooltip text="Přizpůsobit" position="right"><ControlButton onClick={() => reactFlowInstance.fitView({ padding: 0.2 })}><Maximize size={16}/></ControlButton></Tooltip>
          </Controls>
        </ReactFlow>
      </div>
    </div>
  );
}

export default function DiagramEditor(props) {
  return <ReactFlowProvider><EditorCanvas {...props} /></ReactFlowProvider>;
}