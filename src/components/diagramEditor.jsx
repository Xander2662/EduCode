import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, addEdge, useNodesState, useEdgesState, Controls, ControlButton, Background, MarkerType, useReactFlow, ConnectionLineType, ViewportPortal } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, Upload, Square, Circle, Diamond, Copy, Trash2, MessageSquare, FileJson, FileCode, Repeat, Box, Hexagon, Columns, Link2, Plus, Minus, Maximize, Maximize2, ZoomIn, ZoomOut, Lock, Unlock } from 'lucide-react';
import { drawioToReactFlow, reactFlowToDrawio } from '../utils/diagramConverter';
import { getGroupDefs, computeGroupBounds } from '../utils/grouping';
import { calculateRestructuredLayout } from '../utils/visualLayoutEngine';
import { edgeLabels } from './diagram/constants';
import { CustomEdge } from './diagram/CustomEdge';
import { ActionNode, IONode, ConditionNode, StartEndNode, CommentNode, MergeNode, GroupBgNode, LoopContainerNode, ForContainerNode, SwitchContainerNode, CaseContainerNode } from './diagram/CustomNodes';
import { Tooltip } from './Tooltip';
import { ConfirmDialog } from './ConfirmDialog';
import { checkHotkey, getReactFlowKeyCodes, isKeyLassoTrigger } from '../utils/hotkeys';

const DEFAULT_BLOCK_STRINGS = {
  START_END: '',
  ACTION: 'Operace',
  IO: 'x',
  CONDITION: 'x < 0',
  LOOP_CONTAINER: 'x < 0',
  FOR_CONTAINER: '',
  SWITCH_CONTAINER: 'x',
  COMMENT: 'Komentář'
};

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

export const syncCaseAutoWiring = (caseNode, allNodes, allEdges, edgeStyle = 'true-false') => {
  const CONNECTABLE_TYPES = ['PROCESS', 'ACTION', 'IO', 'CONDITION'];
  const switchId = caseNode.data?.switchId || caseNode.parentId;

  const getNodeAbsPos = (node) => {
    const isDragging = node.dragging || Boolean(document.querySelector(`.react-flow__node[data-id="${node.id}"].dragging`));
    if (isDragging) {
      const el = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
      if (el && el.style.transform) {
        const match = el.style.transform.match(/translate(?:3d)?\((-?[\d.]+)px,?\s*(-?[\d.]+)px/);
        if (match) {
          return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        }
      }
    }
    if (node.positionAbsolute && typeof node.positionAbsolute.x === 'number') {
      return node.positionAbsolute;
    }
    let x = node.position.x;
    let y = node.position.y;
    let curr = node;
    let depth = 0;
    while (curr.parentId && depth < 10) {
      const parent = allNodes.find(p => p.id === curr.parentId);
      if (!parent) break;
      x += parent.position.x;
      y += parent.position.y;
      curr = parent;
      depth++;
    }
    return { x, y };
  };

  const casePos = getNodeAbsPos(caseNode);
  const cX = casePos.x;
  const cY = casePos.y;
  const cW = caseNode.measured?.width || parseInt(caseNode.style?.width || 250);
  const cH = caseNode.measured?.height || parseInt(caseNode.style?.height || 166);

  const allSwitchCases = allNodes.filter(n => n.type === 'CASE_CONTAINER' && (n.parentId === switchId || n.data?.switchId === switchId || n.id === caseNode.id));

  const innerBlocks = allNodes.filter(n => {
    if (!CONNECTABLE_TYPES.includes(n.type)) return false;

    const isDragging = n.dragging || Boolean(document.querySelector(`.react-flow__node[data-id="${n.id}"].dragging`));
    const nPos = getNodeAbsPos(n);
    const nW = n.measured?.width || n.width || 100;
    const nH = n.measured?.height || n.height || 50;
    const cx = nPos.x + nW / 2;
    const cy = nPos.y + nH / 2;

    if (isDragging) {
      const hitCase = allSwitchCases.find(c => {
        const cP = getNodeAbsPos(c);
        const w = c.measured?.width || parseInt(c.style?.width || 250);
        const h = c.measured?.height || parseInt(c.style?.height || 166);
        return cx >= cP.x && cx <= cP.x + w && cy >= cP.y && cy <= cP.y + h + 30;
      });
      return hitCase?.id === caseNode.id;
    }

    if (n.parentId === caseNode.id) return true;
    if (n.parentId && n.parentId !== caseNode.id && n.parentId !== switchId) return false;

    return cx >= cX && cx <= cX + cW && cy >= cY && cy <= cY + cH + 30;
  });

  // Remove existing edges connected to this case's s-top or t-bottom
  let eds = allEdges.filter(e => 
    !(e.source === caseNode.id && e.sourceHandle === 's-top') &&
    !(e.target === caseNode.id && e.targetHandle === 't-bottom')
  );

  // Purge any cross-case edges between innerBlocks of this case and other cases
  const otherCases = allSwitchCases.filter(c => c.id !== caseNode.id);
  const otherCaseIds = new Set(otherCases.map(c => c.id));
  const innerIds = new Set(innerBlocks.map(b => b.id));

  eds = eds.filter(e => {
    const srcInCase = innerIds.has(e.source);
    const tgtInCase = innerIds.has(e.target);
    if (srcInCase && !tgtInCase) {
      if (otherCaseIds.has(e.target)) return false;
      const tgtNode = allNodes.find(n => n.id === e.target);
      if (tgtNode && (otherCaseIds.has(tgtNode.parentId) || otherCaseIds.has(tgtNode.data?.caseId))) return false;
    }
    if (tgtInCase && !srcInCase) {
      if (otherCaseIds.has(e.source)) return false;
      const srcNode = allNodes.find(n => n.id === e.source);
      if (srcNode && (otherCaseIds.has(srcNode.parentId) || otherCaseIds.has(srcNode.data?.caseId))) return false;
    }
    return true;
  });

  if (innerBlocks.length === 0) {
    return eds;
  }

  // Sort inner blocks by vertical position (Y level)
  innerBlocks.sort((a, b) => {
    const aY = getNodeAbsPos(a).y;
    const bY = getNodeAbsPos(b).y;
    return aY - bY;
  });

  const highest = innerBlocks[0];
  const lowest = innerBlocks[innerBlocks.length - 1];

  // 1. Connect upper node of case (s-top) to highest connectable block (t-top)
  eds.push({
    id: `e_${caseNode.id}_top_${highest.id}`,
    source: caseNode.id,
    target: highest.id,
    sourceHandle: 's-top',
    targetHandle: 't-top',
    type: 'customEdge',
    interactionWidth: 0,
    data: { edgeStyle: 'straight', isCaseAutoEdge: true },
    markerEnd: { type: MarkerType.ArrowClosed }
  });

  // 2. Connect lowest connectable block to lower node of case (t-bottom)
  if (lowest.type !== 'CONDITION') {
    eds.push({
      id: `e_${lowest.id}_bottom_${caseNode.id}`,
      source: lowest.id,
      target: caseNode.id,
      sourceHandle: 's-bottom',
      targetHandle: 't-bottom',
      type: 'customEdge',
      interactionWidth: 0,
      data: { edgeStyle: 'straight', isCaseAutoEdge: true },
      markerEnd: { type: MarkerType.ArrowClosed }
    });
  } else {
    const pref = edgeLabels[edgeStyle || 'true-false'] || { t: 'True', f: 'False' };
    const isSwapped = lowest.data?.isSwapped === true;
    const bLabel = isSwapped ? pref.f : pref.t;
    const rLabel = isSwapped ? pref.t : pref.f;

    const innerIds = new Set(innerBlocks.map(b => b.id));
    const hasBottomToInner = eds.some(e => e.source === lowest.id && e.sourceHandle === 's-bottom' && innerIds.has(e.target));
    const hasRightToInner = eds.some(e => e.source === lowest.id && e.sourceHandle === 's-right' && innerIds.has(e.target));

    if (!hasBottomToInner) {
      eds.push({
        id: `e_${lowest.id}_cond_b_${caseNode.id}`,
        source: lowest.id,
        target: caseNode.id,
        sourceHandle: 's-bottom',
        targetHandle: 't-bottom',
        type: 'customEdge',
        interactionWidth: 0,
        data: { label: bLabel, isCondition: true, edgeStyle: 'straight', isCaseAutoEdge: true },
        markerEnd: { type: MarkerType.ArrowClosed }
      });
    }
    if (!hasRightToInner) {
      eds.push({
        id: `e_${lowest.id}_cond_r_${caseNode.id}`,
        source: lowest.id,
        target: caseNode.id,
        sourceHandle: 's-right',
        targetHandle: 't-bottom',
        type: 'customEdge',
        interactionWidth: 0,
        data: { label: rLabel, isCondition: true, edgeStyle: 'straight', isCaseAutoEdge: true },
        markerEnd: { type: MarkerType.ArrowClosed }
      });
    }
  }

  return eds;
};

function EditorCanvas({ xml, onXmlChange, onImportXml, readOnly, edgeStyle, colorMode, isDarkMode, groupColoring, showDebugger, conditionShape, selectionMode, hotkeys, activeWindowRef, onSelectionChange, externalSelectedIds, activeRuntimeNodeId, breakpoints = [], onBreakpointToggle, onPaneClick, onInteract, onLogAction, onRequestTutorial, editorMode }) {
  const safeHotkeys = hotkeys || {};
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [clipboard, setClipboard] = useState({ nodes: [], edges: [] });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);
  contextMenuRef.current = contextMenu;
  const contextMenuDomRef = useRef(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const reactFlowInstance = useReactFlow();
  const { screenToFlowPosition, flowToScreenPosition, getNode, getEdges } = reactFlowInstance;

  const getNodeAbsPos = useCallback((n, nodeList = null) => {
    if (!n) return { x: 0, y: 0 };
    let x = n.position ? n.position.x : 0;
    let y = n.position ? n.position.y : 0;
    let curr = n;
    let depth = 0;
    const lookup = nodeList || (reactFlowInstance ? reactFlowInstance.getNodes() : nodes);
    while (curr.parentId && depth < 10) {
      const parent = lookup.find(p => p.id === curr.parentId);
      if (!parent) break;
      x += parent.position ? parent.position.x : 0;
      y += parent.position ? parent.position.y : 0;
      curr = parent;
      depth++;
    }
    return { x, y };
  }, [nodes, reactFlowInstance]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleOutsidePointer = (e) => {
      if (e.button === 1) return;
      if (Date.now() - (contextMenu.openedAt || 0) < 350) return;
      if (contextMenuDomRef.current && contextMenuDomRef.current.contains(e.target)) return;
      setContextMenu(null);
    };
    window.addEventListener('pointerdown', handleOutsidePointer);
    return () => window.removeEventListener('pointerdown', handleOutsidePointer);
  }, [contextMenu]);

  
  const hoveredEdgeRef = useRef(null);
  const lastXmlRef = useRef(''); 

  const keyPanActiveRef = useRef(false);
  const lastPanMousePosRef = useRef(null);
  const keyLassoActiveRef = useRef(false);
  const keyLassoKeyRef = useRef(null);

  const lastMousePosRef = useRef({ 
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 
  });
  const lastDragTimeRef = useRef(0);
  const dragStartPositionsRef = useRef(null);
  const switchDragRef = useRef(null);
  const caseDragRef = useRef(null);
  const reactFlowWrapper = useRef(null);
  useEffect(() => {
    const handleMouseMove = (e) => { 
      if (e.clientX !== undefined && e.clientY !== undefined) {
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }; 

        // Custom keyboard pan (holding pan key and moving mouse without holding mouse1)
        if (keyPanActiveRef.current && lastPanMousePosRef.current) {
          const dx = e.clientX - lastPanMousePosRef.current.x;
          const dy = e.clientY - lastPanMousePosRef.current.y;
          lastPanMousePosRef.current = { x: e.clientX, y: e.clientY };
          if (reactFlowInstance) {
            const { x, y, zoom } = reactFlowInstance.getViewport();
            reactFlowInstance.setViewport({ x: x + dx, y: y + dy, zoom });
          }
        }

        // Custom keyboard lasso (holding custom lasso key and moving mouse without holding mouse1)
        if (keyLassoActiveRef.current) {
          const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
          if (pane) {
            pane.dispatchEvent(new PointerEvent('pointermove', {
              bubbles: true,
              cancelable: true,
              clientX: e.clientX,
              clientY: e.clientY,
              button: 0,
              buttons: 1,
              isPrimary: true,
              pointerId: 1
            }));
          }
        }
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [screenToFlowPosition, reactFlowInstance, selectionMode, setNodes, setEdges]);

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

  const mappedNodes = useMemo(() => {
    const regularCaseCountBySwitch = new Map();
    nodes.forEach(n => {
      if (n.type === 'CASE_CONTAINER' && !n.data?.isDefault) {
        const swId = n.data?.switchId || n.parentId;
        if (swId) {
          regularCaseCountBySwitch.set(swId, (regularCaseCountBySwitch.get(swId) || 0) + 1);
        }
      }
    });

    const switchAncestorIds = new Set();
    const loops = nodes.filter(n => n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER');
    const switches = nodes.filter(n => n.type === 'SWITCH_CONTAINER');
    switches.forEach(sw => {
      let curr = sw;
      let depth = 0;
      while (curr && curr.parentId && curr.parentId !== '1' && depth < 10) {
        switchAncestorIds.add(curr.parentId);
        curr = nodes.find(p => p.id === curr.parentId);
        depth++;
      }
      const swX = sw.position.x;
      const swY = sw.position.y;
      loops.forEach(lp => {
        const lpX = lp.position.x;
        const lpY = lp.position.y;
        const lpW = lp.style?.width ? parseInt(lp.style.width) : (lp.measured?.width || 350);
        const lpH = lp.style?.height ? parseInt(lp.style.height) : (lp.measured?.height || 200);
        if (sw.parentId === lp.id || (swX >= lpX && swX <= lpX + lpW && swY >= lpY && swY <= lpY + lpH)) {
          switchAncestorIds.add(lp.id);
        }
      });
    });

    return nodes.map(n => {
      let canMoveCase = true;
      if (n.type === 'CASE_CONTAINER') {
        const swId = n.data?.switchId || n.parentId;
        const regCount = regularCaseCountBySwitch.get(swId) || 0;
        canMoveCase = regCount > 1;
      }
      let zIndex = 10;
      if (n.type === 'SWITCH_CONTAINER') zIndex = -2;
      else if (n.type === 'CASE_CONTAINER') zIndex = 1;
      else if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') {
        zIndex = switchAncestorIds.has(n.id) ? -5 : 5;
      }
      return {
        ...n,
        className: n.type === 'CASE_CONTAINER' ? (canMoveCase ? 'cursor-grab' : 'cursor-default') : n.className,
        draggable: n.type === 'CASE_CONTAINER' ? canMoveCase : (n.draggable !== undefined ? n.draggable : true),
        zIndex,
        data: { 
            ...n.data, 
            canMoveCase,
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
      };
    });
  }, [nodes, colorMode, showDebugger, readOnly, conditionShape, externalSelectedIds, activeRuntimeNodeId, breakpoints, onBreakpointToggle, toggleIOType, toggleEntityType]);

  const [nodeCount, setNodeCount] = useState(0);
  useEffect(() => { setNodeCount(nodes.length); }, [nodes.length]);
  
  const groupDefs = useMemo(() => {
        if (!groupColoring) return [];
        return getGroupDefs(nodes, edges);
  }, [nodeCount, edges, groupColoring]);

  const bgNodes = useMemo(() => {
        if (!groupColoring || groupDefs.length === 0) return [];
        return computeGroupBounds(nodes, groupDefs, colorMode);
  }, [nodes, groupDefs, groupColoring, colorMode]);
  const sortedMappedNodes = useMemo(() => {
    const nodeMap = new Map(mappedNodes.map(n => [n.id, n]));
    const getDepth = (n) => {
      let d = 0;
      let curr = n;
      while (curr && curr.parentId && curr.parentId !== '1' && d < 10) {
        curr = nodeMap.get(curr.parentId);
        d++;
      }
      return d;
    };
    return [...mappedNodes].sort((a, b) => getDepth(a) - getDepth(b));
  }, [mappedNodes]);
  const allNodes = useMemo(() => [...bgNodes, ...sortedMappedNodes], [bgNodes, sortedMappedNodes]);
  const allEdges = useMemo(() => edges.map(e => ({ ...e, data: { ...e.data, readOnly, edgeStyle } })), [edges, readOnly, edgeStyle]);

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

  useEffect(() => {
    if (readOnly) return;
    const caseContainers = nodes.filter(n => n.type === 'CASE_CONTAINER');
    if (caseContainers.length === 0) return;

    setEdges(eds => {
      let nextEds = eds;
      caseContainers.forEach(cNode => {
        nextEds = syncCaseAutoWiring(cNode, nodes, nextEds, edgeStyle);
      });
      const changed = nextEds.length !== eds.length || nextEds.some((e, i) => 
        e.id !== eds[i]?.id || 
        e.source !== eds[i]?.source || 
        e.target !== eds[i]?.target ||
        e.sourceHandle !== eds[i]?.sourceHandle ||
        e.targetHandle !== eds[i]?.targetHandle
      );
      return changed ? nextEds : eds;
    });
  }, [nodes, edgeStyle, readOnly, setEdges]); 

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

    // Also include any blocks spatially inside deleted cases
    const caseNodesToDelete = nodes.filter(n => selectedNodeIds.has(n.id) && n.type === 'CASE_CONTAINER');
    caseNodesToDelete.forEach(caseNode => {
      const switchNode = caseNode.parentId ? nodes.find(p => p.id === caseNode.parentId) : (caseNode.data?.switchId ? nodes.find(p => p.id === caseNode.data.switchId) : null);
      const cAbsX = (switchNode ? switchNode.position.x : 0) + caseNode.position.x;
      const cAbsY = (switchNode ? switchNode.position.y : 0) + caseNode.position.y;
      const cW = caseNode.style?.width ? parseInt(caseNode.style.width) : 250;
      const cH = caseNode.measured?.height || parseInt(caseNode.style?.height || 166);
      
      nodes.forEach(n => {
        if (selectedNodeIds.has(n.id)) return;
        if (['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER', 'LOOP_CONTAINER', 'FOR_CONTAINER'].includes(n.type)) return;
        const nW = n.measured?.width || n.width || 100;
        const nH = n.measured?.height || n.height || 50;
        const cx = n.position.x + nW / 2;
        const cy = n.position.y + nH / 2;
        if (cx >= cAbsX && cx <= cAbsX + cW && cy >= cAbsY && cy <= cAbsY + cH + 30) {
          selectedNodeIds.add(n.id);
        }
      });
    });
    
    const remainingNodes = nodes.filter(n => !selectedNodeIds.has(n.id));
    setNodes(remainingNodes);
    setEdges(eds => {
      let filteredEds = eds.filter(e => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target));
      const remainingCases = remainingNodes.filter(n => n.type === 'CASE_CONTAINER');
      remainingCases.forEach(caseNode => {
        filteredEds = syncCaseAutoWiring(caseNode, remainingNodes, filteredEds, edgeStyle);
      });
      return filteredEds;
    });
    setDeleteConfirm(false);
  }, [selectedNodes, selectedEdges, setNodes, setEdges, handleInteract, onLogAction, nodes, takeSnapshot, edgeStyle]);

  const handleCopy = useCallback((nodesParam = null) => { 
    const nodesSource = (nodesParam && nodesParam.length > 0) ? nodesParam : selectedNodes;
    if (nodesSource.length > 0) {
      const selectedNodeIds = new Set(nodesSource.map(n => n.id));
      
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

      // Also include any blocks spatially inside copied cases
      const caseNodes = nodes.filter(n => selectedNodeIds.has(n.id) && n.type === 'CASE_CONTAINER');
      caseNodes.forEach(caseNode => {
        const switchNode = caseNode.parentId ? nodes.find(p => p.id === caseNode.parentId) : null;
        const cAbsX = (switchNode ? switchNode.position.x : 0) + caseNode.position.x;
        const cAbsY = (switchNode ? switchNode.position.y : 0) + caseNode.position.y;
        const cW = caseNode.style?.width ? parseInt(caseNode.style.width) : 250;
        const cH = caseNode.measured?.height || parseInt(caseNode.style?.height || 166);
        
        nodes.forEach(n => {
          if (selectedNodeIds.has(n.id)) return;
          if (['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER', 'LOOP_CONTAINER', 'FOR_CONTAINER'].includes(n.type)) return;
          const nW = n.measured?.width || n.width || 100;
          const nH = n.measured?.height || n.height || 50;
          const cx = n.position.x + nW / 2;
          const cy = n.position.y + nH / 2;
          if (cx >= cAbsX && cx <= cAbsX + cW && cy >= cAbsY && cy <= cAbsY + cH + 30) {
            selectedNodeIds.add(n.id);
          }
        });
      });
      
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

    const copiedCases = clipboard.nodes.filter(n => n.type === 'CASE_CONTAINER');
    let targetSwitch = (pastePos && copiedCases.length > 0) ? nodes.find(n => {
      if (n.type !== 'SWITCH_CONTAINER') return false;
      const swW = n.style?.width ? parseInt(n.style.width) : (n.measured?.width || 350);
      const swH = n.style?.height ? parseInt(n.style.height) : (n.measured?.height || 230);
      return pastePos.x >= n.position.x && pastePos.x <= n.position.x + swW &&
             pastePos.y >= n.position.y && pastePos.y <= n.position.y + Math.max(swH, 200);
    }) : null;

    if (!targetSwitch && copiedCases.length > 0 && !clipboard.nodes.some(n => n.type === 'SWITCH_CONTAINER')) {
      targetSwitch = nodes.find(n => n.id === copiedCases[0].parentId || n.id === copiedCases[0].data?.switchId) || null;
    }

    if (targetSwitch && copiedCases.length > 0) {
      // Paste case(s) into targetSwitch!
      const targetCases = nodes.filter(n => n.type === 'CASE_CONTAINER' && (n.parentId === targetSwitch.id || n.data?.switchId === targetSwitch.id));
      const targetHasDefault = targetCases.some(c => c.data?.isDefault);

      // Rule: you cannot copy default into the same switch (it will do nothing).
      // But in a different switch it will copy it (if there is not one already).
      const validCopiedCases = copiedCases.filter(c => {
        if (!c.data?.isDefault) return true;
        const sourceSwitchId = c.parentId || c.data?.switchId;
        if (targetSwitch.id === sourceSwitchId) return false;
        if (targetHasDefault) return false;
        return true;
      });

      if (validCopiedCases.length === 0) {
        return;
      }

      const defCase = targetCases.find(c => c.data?.isDefault);
      const isDefRight = defCase && targetCases.every(c => c.id === defCase.id || c.position.x < defCase.position.x);

      // Non-default cases come first (sorted by x), and any copied default case is placed last!
      const sortedCopiedCases = [...validCopiedCases].sort((a, b) => {
        if (a.data?.isDefault) return 1;
        if (b.data?.isDefault) return -1;
        return a.position.x - b.position.x;
      });

      const nonDefaultCopiedCount = sortedCopiedCases.filter(c => !c.data?.isDefault).length;
      const shiftDefX = isDefRight ? nonDefaultCopiedCount * 265 : 0;
      let nextSlotX = isDefRight ? defCase.position.x : (targetCases.length > 0 ? Math.max(...targetCases.map(c => c.position.x)) + 265 : 15);

      const idMap = {};
      const casePositions = new Map();

      sortedCopiedCases.forEach(c => {
        const newId = 'case_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
        idMap[c.id] = newId;
        casePositions.set(c.id, { x: nextSlotX, y: 44 });
        nextSlotX += 265;
      });

      // Find inner blocks in clipboard that belong to each valid copied case
      const innerBlocksNewNodes = [];
      const validCaseIds = new Set(validCopiedCases.map(c => c.id));
      const nonCaseCopiedNodes = clipboard.nodes.filter(n => n.type !== 'CASE_CONTAINER' && n.type !== 'SWITCH_CONTAINER');

      nonCaseCopiedNodes.forEach(n => {
        let associatedCase = null;
        if (n.parentId && casePositions.has(n.parentId)) {
          associatedCase = copiedCases.find(c => c.id === n.parentId);
        } else {
          associatedCase = copiedCases.find(c => {
            const switchNode = c.parentId ? (nodes.find(p => p.id === c.parentId) || clipboard.nodes.find(p => p.id === c.parentId)) : null;
            const cX = (switchNode ? switchNode.position.x : 0) + c.position.x;
            const cY = (switchNode ? switchNode.position.y : 0) + c.position.y;
            const cW = c.style?.width ? parseInt(c.style.width) : 250;
            const cH = c.measured?.height || parseInt(c.style?.height || 166);
            const cx = n.position.x + (n.measured?.width || 100) / 2;
            const cy = n.position.y + (n.measured?.height || 50) / 2;
            return cx >= cX && cx <= cX + cW && cy >= cY && cy <= cY + cH + 30;
          }) || copiedCases[0];
        }

        if (!associatedCase || !validCaseIds.has(associatedCase.id)) {
          return;
        }

        const newId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
        idMap[n.id] = newId;

        const targetCasePos = casePositions.get(associatedCase.id) || { x: 15, y: 44 };
        const sourceSwitch = associatedCase ? (nodes.find(p => p.id === associatedCase.parentId || p.id === associatedCase.data?.switchId) || clipboard.nodes.find(p => p.id === associatedCase.parentId || p.id === associatedCase.data?.switchId)) : null;
        const origCaseAbsX = (sourceSwitch ? sourceSwitch.position.x : 0) + (associatedCase ? associatedCase.position.x : 15);
        const origCaseAbsY = (sourceSwitch ? sourceSwitch.position.y : 0) + (associatedCase ? associatedCase.position.y : 44);
        const offX = n.position.x - origCaseAbsX;
        const offY = n.position.y - origCaseAbsY;

        const newAbsX = targetSwitch.position.x + targetCasePos.x + offX;
        const newAbsY = targetSwitch.position.y + targetCasePos.y + offY;

        innerBlocksNewNodes.push({
          ...n,
          id: newId,
          position: { x: Math.round(newAbsX), y: Math.round(newAbsY) },
          selected: true,
          parentId: undefined,
          data: {
            ...n.data,
            onStartEdit: takeSnapshot,
            onChange: (e) => updateNodeLabel(newId, e.target.value, true),
            onUpdateData: (newData) => updateNodeData(newId, newData)
          }
        });
      });

      const newCaseNodes = sortedCopiedCases.map(c => {
        const newId = idMap[c.id];
        const newPos = casePositions.get(c.id);
        return {
          ...c,
          id: newId,
          parentId: targetSwitch.id,
          position: newPos,
          selected: true,
          data: {
            ...c.data,
            switchId: targetSwitch.id,
            isDefault: !!c.data?.isDefault,
            onStartEdit: takeSnapshot,
            onChange: (e) => updateNodeLabel(newId, e.target.value, true),
            onUpdateData: (newData) => updateNodeData(newId, newData)
          }
        };
      });

      const defInnerNodes = (isDefRight && defCase) ? nodes.filter(n => {
        if (['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER', 'LOOP_CONTAINER', 'FOR_CONTAINER'].includes(n.type)) return false;
        if (n.parentId === defCase.id) return true;
        if (n.parentId && n.parentId !== targetSwitch.id) return false;
        const defAbsX = targetSwitch.position.x + defCase.position.x;
        const defAbsY = targetSwitch.position.y + defCase.position.y;
        const defW = defCase.style?.width ? parseInt(defCase.style.width) : 250;
        const cx = n.position.x + (n.measured?.width || 100) / 2;
        const cy = n.position.y + (n.measured?.height || 50) / 2;
        return cx >= defAbsX && cx <= defAbsX + defW && cy >= defAbsY;
      }) : [];
      const defInnerIds = new Set(defInnerNodes.map(inN => inN.id));

      const newEdges = clipboard.edges
        .filter(e => idMap[e.source] && idMap[e.target])
        .map(e => ({
          ...e,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          source: idMap[e.source],
          target: idMap[e.target],
          selected: true
        }));

      const targetContainerWidth = Math.max(350, (targetCases.length + sortedCopiedCases.length) * 265 + 65);

      let allNextNodes = [];
      setNodes(nds => {
        const next = nds.map(n => {
          if (n.id === targetSwitch.id) {
            const currentW = n.style?.width ? parseInt(n.style.width) : 350;
            return {
              ...n,
              style: {
                ...n.style,
                width: Math.max(currentW, targetContainerWidth)
              }
            };
          }
          if (isDefRight && n.id === defCase.id) {
            return { ...n, position: { ...n.position, x: n.position.x + shiftDefX } };
          }
          if (defInnerIds.has(n.id)) {
            return { ...n, position: { ...n.position, x: n.position.x + shiftDefX } };
          }
          return { ...n, selected: false };
        }).concat(newCaseNodes).concat(innerBlocksNewNodes);
        allNextNodes = next;
        return next;
      });

      setEdges(eds => {
        let nextEds = eds.map(e => ({ ...e, selected: false })).concat(newEdges);
        newCaseNodes.forEach(cn => {
          nextEds = syncCaseAutoWiring(cn, allNextNodes, nextEds, edgeStyle);
        });
        return nextEds;
      });
      return;
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
  }, [clipboard, onLogAction, updateNodeLabel, updateNodeData, setNodes, setEdges, handleInteract, screenToFlowPosition, takeSnapshot, edgeStyle, nodes]);

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

    // Also include any blocks spatially inside duplicated cases
    const caseNodes = nodes.filter(n => selectedNodeIds.has(n.id) && n.type === 'CASE_CONTAINER');
    caseNodes.forEach(caseNode => {
      const switchNode = caseNode.parentId ? nodes.find(p => p.id === caseNode.parentId) : (caseNode.data?.switchId ? nodes.find(p => p.id === caseNode.data.switchId) : null);
      const cAbsX = (switchNode ? switchNode.position.x : 0) + caseNode.position.x;
      const cAbsY = (switchNode ? switchNode.position.y : 0) + caseNode.position.y;
      const cW = caseNode.style?.width ? parseInt(caseNode.style.width) : 250;
      const cH = caseNode.measured?.height || parseInt(caseNode.style?.height || 166);
      
      nodes.forEach(n => {
        if (selectedNodeIds.has(n.id)) return;
        if (['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER', 'LOOP_CONTAINER', 'FOR_CONTAINER'].includes(n.type)) return;
        const nW = n.measured?.width || n.width || 100;
        const nH = n.measured?.height || n.height || 50;
        const cx = n.position.x + nW / 2;
        const cy = n.position.y + nH / 2;
        if (cx >= cAbsX && cx <= cAbsX + cW && cy >= cAbsY && cy <= cAbsY + cH + 30) {
          selectedNodeIds.add(n.id);
        }
      });
    });

    // Rule: you cannot duplicate default at all!
    if (!selectedNodes.some(n => n.type === 'SWITCH_CONTAINER')) {
      const defaultCases = nodes.filter(n => selectedNodeIds.has(n.id) && n.type === 'CASE_CONTAINER' && n.data?.isDefault);
      defaultCases.forEach(defNode => {
        selectedNodeIds.delete(defNode.id);
        const switchNode = defNode.parentId ? nodes.find(p => p.id === defNode.parentId) : (defNode.data?.switchId ? nodes.find(p => p.id === defNode.data.switchId) : null);
        const cAbsX = (switchNode ? switchNode.position.x : 0) + defNode.position.x;
        const cAbsY = (switchNode ? switchNode.position.y : 0) + defNode.position.y;
        const cW = defNode.style?.width ? parseInt(defNode.style.width) : 250;
        const cH = defNode.measured?.height || parseInt(defNode.style?.height || 166);
        nodes.forEach(n => {
          if (n.parentId === defNode.id) {
            selectedNodeIds.delete(n.id);
          } else {
            const cx = n.position.x + (n.measured?.width || 100) / 2;
            const cy = n.position.y + (n.measured?.height || 50) / 2;
            if (cx >= cAbsX && cx <= cAbsX + cW && cy >= cAbsY && cy <= cAbsY + cH + 30) {
              selectedNodeIds.delete(n.id);
            }
          }
        });
      });

      if (selectedNodeIds.size === 0) {
        return;
      }
    }

    const nonDefaultCaseNodes = nodes.filter(n => selectedNodeIds.has(n.id) && n.type === 'CASE_CONTAINER' && !n.data?.isDefault);
    const onlyCases = nonDefaultCaseNodes.length > 0 && !selectedNodes.some(n => n.type === 'SWITCH_CONTAINER');
    const targetSwitch = onlyCases ? nodes.find(p => p.id === nonDefaultCaseNodes[0].parentId || p.id === nonDefaultCaseNodes[0].data?.switchId) : null;

    if (onlyCases && targetSwitch) {
      const targetCases = nodes.filter(n => n.type === 'CASE_CONTAINER' && (n.parentId === targetSwitch.id || n.data?.switchId === targetSwitch.id));
      const defCase = targetCases.find(c => c.data?.isDefault);
      const isDefRight = defCase && targetCases.every(c => c.id === defCase.id || c.position.x < defCase.position.x);

      const sortedCopiedCases = [...nonDefaultCaseNodes].sort((a, b) => a.position.x - b.position.x);
      const shiftDefX = isDefRight ? sortedCopiedCases.length * 265 : 0;
      let nextSlotX = isDefRight ? defCase.position.x : (targetCases.length > 0 ? Math.max(...targetCases.map(c => c.position.x)) + 265 : 15);

      const idMap = {};
      const casePositions = new Map();

      sortedCopiedCases.forEach(c => {
        const newId = 'case_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
        idMap[c.id] = newId;
        casePositions.set(c.id, { x: nextSlotX, y: 44 });
        nextSlotX += 265;
      });

      const innerBlocksNewNodes = [];
      const nonCaseCopiedNodes = nodes.filter(n => selectedNodeIds.has(n.id) && n.type !== 'CASE_CONTAINER' && n.type !== 'SWITCH_CONTAINER');

      nonCaseCopiedNodes.forEach(n => {
        const newId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
        idMap[n.id] = newId;

        let associatedCase = null;
        if (n.parentId && casePositions.has(n.parentId)) {
          associatedCase = caseNodes.find(c => c.id === n.parentId);
        } else {
          associatedCase = caseNodes.find(c => {
            const switchNode = c.parentId ? nodes.find(p => p.id === c.parentId) : null;
            const cX = (switchNode ? switchNode.position.x : 0) + c.position.x;
            const cY = (switchNode ? switchNode.position.y : 0) + c.position.y;
            const cW = c.style?.width ? parseInt(c.style.width) : 250;
            const cH = c.measured?.height || parseInt(c.style?.height || 166);
            const cx = n.position.x + (n.measured?.width || 100) / 2;
            const cy = n.position.y + (n.measured?.height || 50) / 2;
            return cx >= cX && cx <= cX + cW && cy >= cY && cy <= cY + cH + 30;
          }) || caseNodes[0];
        }

        const targetCasePos = associatedCase ? casePositions.get(associatedCase.id) : { x: 15, y: 44 };
        const sourceSwitch = targetSwitch;
        const origCaseAbsX = sourceSwitch.position.x + (associatedCase ? associatedCase.position.x : 15);
        const origCaseAbsY = sourceSwitch.position.y + (associatedCase ? associatedCase.position.y : 44);
        const offX = n.position.x - origCaseAbsX;
        const offY = n.position.y - origCaseAbsY;

        const newAbsX = targetSwitch.position.x + targetCasePos.x + offX;
        const newAbsY = targetSwitch.position.y + targetCasePos.y + offY;

        innerBlocksNewNodes.push({
          ...n,
          id: newId,
          position: { x: Math.round(newAbsX), y: Math.round(newAbsY) },
          selected: true,
          parentId: undefined,
          data: {
            ...n.data,
            onStartEdit: takeSnapshot,
            onChange: (e) => updateNodeLabel(newId, e.target.value, true),
            onUpdateData: (newData) => updateNodeData(newId, newData)
          }
        });
      });

      const newCaseNodes = sortedCopiedCases.map(c => {
        const newId = idMap[c.id];
        const newPos = casePositions.get(c.id);
        return {
          ...c,
          id: newId,
          parentId: targetSwitch.id,
          position: newPos,
          selected: true,
          data: {
            ...c.data,
            switchId: targetSwitch.id,
            onStartEdit: takeSnapshot,
            onChange: (e) => updateNodeLabel(newId, e.target.value, true),
            onUpdateData: (newData) => updateNodeData(newId, newData)
          }
        };
      });

      const defInnerNodes = (isDefRight && defCase) ? nodes.filter(n => {
        if (['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER', 'LOOP_CONTAINER', 'FOR_CONTAINER'].includes(n.type)) return false;
        if (n.parentId === defCase.id) return true;
        if (n.parentId && n.parentId !== targetSwitch.id) return false;
        const defAbsX = targetSwitch.position.x + defCase.position.x;
        const defAbsY = targetSwitch.position.y + defCase.position.y;
        const defW = defCase.style?.width ? parseInt(defCase.style.width) : 250;
        const cx = n.position.x + (n.measured?.width || 100) / 2;
        const cy = n.position.y + (n.measured?.height || 50) / 2;
        return cx >= defAbsX && cx <= defAbsX + defW && cy >= defAbsY;
      }) : [];
      const defInnerIds = new Set(defInnerNodes.map(inN => inN.id));

      const newEdges = edges
        .filter(e => idMap[e.source] && idMap[e.target])
        .map(e => ({
          ...e,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          source: idMap[e.source],
          target: idMap[e.target],
          selected: true
        }));

      let allNextNodes = [];
      setNodes(nds => {
        const next = nds.map(n => {
          if (isDefRight && n.id === defCase.id) {
            return { ...n, position: { ...n.position, x: n.position.x + shiftDefX } };
          }
          if (defInnerIds.has(n.id)) {
            return { ...n, position: { ...n.position, x: n.position.x + shiftDefX } };
          }
          return { ...n, selected: false };
        }).concat(newCaseNodes).concat(innerBlocksNewNodes);
        allNextNodes = next;
        return next;
      });

      setEdges(eds => {
        let nextEds = eds.map(e => ({ ...e, selected: false })).concat(newEdges);
        newCaseNodes.forEach(cn => {
          nextEds = syncCaseAutoWiring(cn, allNextNodes, nextEds, edgeStyle);
        });
        return nextEds;
      });

      if (onLogAction) onLogAction('NODES_DUPLICATED', { count: newCaseNodes.length + innerBlocksNewNodes.length });
      return;
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

  const handleZoom = useCallback((factor) => {
    if (!reactFlowInstance) return;
    const reactFlowEl = document.querySelector('.react-flow');
    if (reactFlowEl && screenToFlowPosition) {
      const bounds = reactFlowEl.getBoundingClientRect();
      let clientX = lastMousePosRef.current ? lastMousePosRef.current.x : null;
      let clientY = lastMousePosRef.current ? lastMousePosRef.current.y : null;

      const isInside = clientX !== null && clientY !== null &&
        clientX >= bounds.left && clientX <= bounds.right &&
        clientY >= bounds.top && clientY <= bounds.bottom;

      if (!isInside) {
        clientX = bounds.left + bounds.width / 2;
        clientY = bounds.top + bounds.height / 2;
      }

      const currentZoom = reactFlowInstance.getZoom();
      const newZoom = Math.max(0.2, Math.min(3.0, currentZoom * factor));
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });

      const relX = clientX - bounds.left;
      const relY = clientY - bounds.top;
      const newX = relX - flowPos.x * newZoom;
      const newY = relY - flowPos.y * newZoom;

      reactFlowInstance.setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 150 });
      return;
    }
    if (factor > 1) reactFlowInstance.zoomIn();
    else reactFlowInstance.zoomOut();
  }, [reactFlowInstance, screenToFlowPosition]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (readOnly) return;
      if (deleteConfirm) {
        if (e.key === 'Enter') { e.preventDefault(); executeDelete(); } 
        else if (e.key === 'Escape') { e.preventDefault(); setDeleteConfirm(false); }
        return;
      }

      const isInput = e.target && (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable ||
        Boolean(e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]'))
      );

      if (e.key === 'Escape') {
        if (isInput) e.target.blur();
        keyPanActiveRef.current = false;
        lastPanMousePosRef.current = null;
        if (keyLassoActiveRef.current) {
          keyLassoActiveRef.current = false;
          keyLassoKeyRef.current = null;
          const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
          if (pane) {
            pane.dispatchEvent(new PointerEvent('pointerup', {
              bubbles: true,
              cancelable: true,
              clientX: lastMousePosRef.current.x,
              clientY: lastMousePosRef.current.y,
              button: 0,
              buttons: 0,
              isPrimary: true,
              pointerId: 1
            }));
          }
        }
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        setEdges(eds => eds.map(edge => ({ ...edge, selected: false })));
        setContextMenu(null); setShowExportMenu(false);
        if (onPaneClickRef.current) onPaneClickRef.current();
        return;
      }
      
      const safeHotkeys = hotkeys || {};

      // Custom keyboard lasso (holding custom lasso key and moving mouse without holding mouse1)
      const isCustomKeyLasso = (safeHotkeys.lassoSelect || []).some(s => {
        const lower = s.toLowerCase().trim();
        return !lower.startsWith('mouse') && !lower.includes('tažení') && !lower.includes('tazeni') && !lower.includes('klik') && !lower.includes('drag') && checkSingleHotkey(e, s);
      });
      if (isCustomKeyLasso && !isInput) {
        if (!e.repeat && !keyLassoActiveRef.current) {
          e.preventDefault();
          keyLassoActiveRef.current = true;
          keyLassoKeyRef.current = e.key ? e.key.toLowerCase() : '';
          const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
          if (pane) {
            const origSetCapture = pane.setPointerCapture;
            pane.setPointerCapture = () => {};
            pane.dispatchEvent(new PointerEvent('pointerdown', {
              bubbles: true,
              cancelable: true,
              clientX: lastMousePosRef.current.x,
              clientY: lastMousePosRef.current.y,
              button: 0,
              buttons: 1,
              isPrimary: true,
              pointerId: 1
            }));
            pane.setPointerCapture = origSetCapture;
          }
        }
        return;
      }

      // Custom keyboard pan (holding pan key and moving mouse without holding mouse1)
      const isCustomKeyPan = (safeHotkeys.pan || []).some(s => {
        const lower = s.toLowerCase().trim();
        return !lower.startsWith('mouse') && !lower.includes('tažení') && !lower.includes('klik') && checkSingleHotkey(e, s);
      });
      if (isCustomKeyPan && !isInput) {
        e.preventDefault();
        keyPanActiveRef.current = true;
        lastPanMousePosRef.current = { ...lastMousePosRef.current };
        return;
      }

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
        // Multi-select toggle under cursor
        if (lastMousePosRef.current && (lastMousePosRef.current.x || lastMousePosRef.current.y)) {
          const elUnderCursor = document.elementFromPoint(lastMousePosRef.current.x, lastMousePosRef.current.y);
          if (elUnderCursor) {
            const targetNodeEl = elUnderCursor.closest('.react-flow__node');
            if (targetNodeEl) {
              const targetNodeId = targetNodeEl.getAttribute('data-id');
              if (targetNodeId) {
                e.preventDefault();
                setNodes(nds => nds.map(n => {
                  if (n.id === targetNodeId) {
                    return { ...n, selected: !n.selected };
                  }
                  return n;
                }));
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
          if (elUnderCursor) {
            const targetNodeEl = elUnderCursor.closest('.react-flow__node');
            if (targetNodeEl) {
              const targetId = targetNodeEl.getAttribute('data-id');
              const nodeToCopy = nodes.find(n => n.id === targetId);
              if (nodeToCopy) {
                handleCopy([nodeToCopy]);
                return;
              }
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
        handleZoom(1.4);
      } else if (checkHotkey(e, safeHotkeys.zoomOut || ['Ctrl+-']) && !isInput) {
        e.preventDefault();
        handleZoom(1 / 1.4);
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
          const conn = connectingNodeRef.current;
          connectingNodeRef.current = null;
          const flowPos = screenToFlowPosition({ x: mouseX, y: mouseY });
          return { 
            mouseX, 
            mouseY, 
            flowX: flowPos.x, 
            flowY: flowPos.y, 
            connectSource: conn, 
            openedAt: Date.now() 
          };
        });
      } else if (e.key === 'Escape') {
        if (contextMenuRef.current) {
          setContextMenu(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && !e.shiftKey && !e.altKey && !isInput && selectedNodes.length > 0) {
        e.preventDefault();
        handleDuplicate();
      }
    };

    const handleKeyUp = (e) => {
      if (keyPanActiveRef.current) {
        const isCustomKeyPan = (safeHotkeys.pan || []).some(s => {
          const lower = s.toLowerCase().trim();
          return !lower.startsWith('mouse') && !lower.includes('tažení') && !lower.includes('klik');
        });
        if (isCustomKeyPan) {
          keyPanActiveRef.current = false;
          lastPanMousePosRef.current = null;
        }
      }

      if (keyLassoActiveRef.current) {
        if (e.key?.toLowerCase() === keyLassoKeyRef.current) {
          keyLassoActiveRef.current = false;
          keyLassoKeyRef.current = null;
          const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
          if (pane) {
            const origRelease = pane.releasePointerCapture;
            pane.releasePointerCapture = () => {};
            pane.dispatchEvent(new PointerEvent('pointerup', {
              bubbles: true,
              cancelable: true,
              clientX: lastMousePosRef.current.x,
              clientY: lastMousePosRef.current.y,
              button: 0,
              buttons: 0,
              isPrimary: true,
              pointerId: 1
            }));
            pane.releasePointerCapture = origRelease;
          }
        }
      }
    };

    const handleBlur = () => {
      keyPanActiveRef.current = false;
      lastPanMousePosRef.current = null;
      if (keyLassoActiveRef.current) {
        keyLassoActiveRef.current = false;
        keyLassoKeyRef.current = null;
        const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
        if (pane) {
          const origRelease = pane.releasePointerCapture;
          pane.releasePointerCapture = () => {};
          pane.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            clientX: lastMousePosRef.current.x,
            clientY: lastMousePosRef.current.y,
            button: 0,
            buttons: 0,
            isPrimary: true,
            pointerId: 1
          }));
          pane.releasePointerCapture = origRelease;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [selectedNodes, selectedEdges, clipboard, readOnly, deleteConfirm, executeDelete, handleCopy, handlePaste, handleUndo, handleRedo, handleDuplicate, setNodes, setEdges, hotkeys, handleZoom, reactFlowInstance, screenToFlowPosition, handleInteract]);

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

  const onNodeDragStart = useCallback((event, node, draggedNodesList) => {
    takeSnapshot();
    handleInteract();
    const startMap = new Map();
    const currentNodes = reactFlowInstance ? reactFlowInstance.getNodes() : (nodesRef.current || nodes || []);
    currentNodes.forEach(n => {
      if (n && n.position) {
        startMap.set(n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) });
      }
    });
    if (node && node.id && !startMap.has(node.id) && node.position) {
      startMap.set(node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) });
    }
    if (Array.isArray(draggedNodesList)) {
      draggedNodesList.forEach(dn => {
        if (dn && dn.id && !startMap.has(dn.id) && dn.position) {
          startMap.set(dn.id, { x: Math.round(dn.position.x), y: Math.round(dn.position.y) });
        }
      });
    }
    dragStartPositionsRef.current = startMap;

    if (node?.type === 'SWITCH_CONTAINER') {
      const swNode = currentNodes.find(n => n.id === node.id) || node;
      const myCases = currentNodes.filter(n => n.type === 'CASE_CONTAINER' && (n.data?.switchId === node.id || n.parentId === node.id));
      const caseIds = new Set(myCases.map(c => c.id));
      
      const swPos = getNodeAbsPos(swNode);
      const swX = swPos.x;
      const swY = swPos.y;
      const swW = swNode.style?.width ? parseInt(swNode.style.width) : (swNode.measured?.width || 350);
      const swH = swNode.style?.height ? parseInt(swNode.style.height) : (swNode.measured?.height || 230);

      const innerNodes = currentNodes.filter(n => {
        if (n.id === node.id || caseIds.has(n.id)) return false;
        if (['GROUP_BG', 'START_END', 'LOOP_CONTAINER', 'FOR_CONTAINER', 'SWITCH_CONTAINER'].includes(n.type)) return false;
        if (n.parentId && caseIds.has(n.parentId)) return true;
        
        const nPos = getNodeAbsPos(n);
        const nX = nPos.x;
        const nY = nPos.y;
        const nW = n.measured?.width || n.width || 100;
        const nH = n.measured?.height || n.height || 50;
        const cx = nX + nW / 2;
        const cy = nY + nH / 2;
        return cx >= swX && cx <= swX + swW && cy >= swY;
      });

      const currentEdges = reactFlowInstance ? reactFlowInstance.getEdges() : edges;
      const innerIds = new Set([node.id, ...caseIds, ...innerNodes.map(inNode => inNode.id)]);
      const innerEdges = currentEdges.filter(e => innerIds.has(e.source) && innerIds.has(e.target)).map(e => e.id);

      const allMovedElements = [
        ...myCases.map(cNode => {
          const cPos = getNodeAbsPos(cNode);
          return { id: cNode.id, absX: cPos.x, absY: cPos.y, startX: cNode.position.x, startY: cNode.position.y };
        }),
        ...innerNodes.map(inNode => {
          const inPos = getNodeAbsPos(inNode);
          return { id: inNode.id, absX: inPos.x, absY: inPos.y, startX: inNode.position.x, startY: inNode.position.y };
        })
      ];

      switchDragRef.current = {
        switchId: node.id,
        startX: swNode.position.x,
        startY: swNode.position.y,
        movedElements: allMovedElements,
        innerEdges
      };
    } else if (node?.type === 'CASE_CONTAINER') {
      const caseNode = currentNodes.find(n => n.id === node.id) || node;
      const switchId = caseNode.data?.switchId || caseNode.parentId;
      const allSwitchCases = currentNodes.filter(n => n.type === 'CASE_CONTAINER' && (n.data?.switchId === switchId || n.parentId === switchId));
      const regularCases = allSwitchCases.filter(c => !c.data?.isDefault);
      if (regularCases.length <= 1) {
        caseDragRef.current = null;
        switchDragRef.current = null;
        return;
      }

      const cPos = getNodeAbsPos(caseNode);
      const cAbsX = cPos.x;
      const cAbsY = cPos.y;
      const cW = caseNode.style?.width ? parseInt(caseNode.style.width) : (caseNode.measured?.width || 250);
      const cH = caseNode.style?.height ? parseInt(caseNode.style.height) : (caseNode.measured?.height || 150);

      const innerNodes = currentNodes.filter(n => {
        if (n.id === caseNode.id) return false;
        if (['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER', 'LOOP_CONTAINER', 'FOR_CONTAINER'].includes(n.type)) return false;
        if (n.parentId === caseNode.id) return true;
        if (n.parentId && n.parentId !== caseNode.id && n.parentId !== switchId) return false;
        const nW = n.measured?.width || n.width || 100;
        const nH = n.measured?.height || n.height || 50;
        const nPos = getNodeAbsPos(n);
        const cx = nPos.x + nW / 2;
        const cy = nPos.y + nH / 2;
        return cx >= cAbsX && cx <= cAbsX + cW && cy >= cAbsY && cy <= cAbsY + cH + 30;
      });

      const siblingCases = currentNodes.filter(n => n.type === 'CASE_CONTAINER' && n.id !== node.id && (n.data?.switchId === switchId || n.parentId === switchId));

      const allCases = [
        { id: caseNode.id, startX: caseNode.position.x, w: cW, isDragged: true },
        ...siblingCases.map(sc => ({
          id: sc.id,
          startX: sc.position.x,
          w: sc.style?.width ? parseInt(sc.style.width) : (sc.measured?.width || 250),
          isDragged: false
        }))
      ];
      allCases.sort((a, b) => a.startX - b.startX);

      const currentEdges = reactFlowInstance ? reactFlowInstance.getEdges() : edges;
      const caseInnerIds = new Set([caseNode.id, ...innerNodes.map(inN => inN.id)]);
      const caseInnerEdges = currentEdges.filter(e => caseInnerIds.has(e.source) && caseInnerIds.has(e.target)).map(e => e.id);

      caseDragRef.current = {
        caseId: node.id,
        switchId,
        cW,
        cH,
        startX: caseNode.position.x,
        startY: caseNode.position.y,
        allCasesInitialOrder: allCases,
        innerEdges: caseInnerEdges,
        innerNodes: innerNodes.map(inNode => {
          const inPos = getNodeAbsPos(inNode);
          return {
            id: inNode.id,
            absX: inPos.x,
            absY: inPos.y,
            relX: inPos.x - cAbsX,
            relY: inPos.y - cAbsY,
            startX: inNode.position.x,
            startY: inNode.position.y
          };
        }),
        siblingCases: siblingCases.map(sc => {
          const scPos = getNodeAbsPos(sc);
          const scAbsX = scPos.x;
          const scAbsY = scPos.y;
          const scW = sc.style?.width ? parseInt(sc.style.width) : (sc.measured?.width || 250);
          const scH = sc.style?.height ? parseInt(sc.style.height) : (sc.measured?.height || 150);
          const scInner = currentNodes.filter(n => {
            if (n.id === sc.id || ['GROUP_BG', 'START_END', 'CASE_CONTAINER', 'SWITCH_CONTAINER', 'LOOP_CONTAINER', 'FOR_CONTAINER'].includes(n.type)) return false;
            if (n.parentId === sc.id) return true;
            if (n.parentId && n.parentId !== sc.id && n.parentId !== switchId) return false;
            const nW = n.measured?.width || n.width || 100;
            const nH = n.measured?.height || n.height || 50;
            const nPos = getNodeAbsPos(n);
            const cx = nPos.x + nW / 2;
            const cy = nPos.y + nH / 2;
            return cx >= scAbsX && cx <= scAbsX + scW && cy >= scAbsY && cy <= scAbsY + scH + 30;
          });
          const scIds = new Set([sc.id, ...scInner.map(scIn => scIn.id)]);
          const scEdges = currentEdges.filter(e => scIds.has(e.source) && scIds.has(e.target)).map(e => e.id);
          return {
            id: sc.id,
            absX: scAbsX,
            absY: scAbsY,
            startX: sc.position.x,
            w: scW,
            innerEdges: scEdges,
            innerNodes: scInner.map(inNode => {
              const inPos = getNodeAbsPos(inNode);
              return {
                id: inNode.id,
                absX: inPos.x,
                absY: inPos.y,
                relX: inPos.x - scAbsX,
                relY: inPos.y - scAbsY,
                startX: inNode.position.x,
                startY: inNode.position.y
              };
            }),
            currentShiftX: 0
          };
        })
      };

      const caseEl = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
      if (caseEl) {
        caseEl.classList.add('is-dragging-case');
        caseEl.style.transition = 'none';
      }
      innerNodes.forEach(inN => {
        const inEl = document.querySelector(`.react-flow__node[data-id="${inN.id}"]`);
        if (inEl) {
          inEl.classList.add('case-inner-dragging');
          inEl.style.transition = 'none';
        }
      });
      caseDragRef.current.siblingCases?.forEach(sc => {
        const scEl = document.querySelector(`.react-flow__node[data-id="${sc.id}"]`);
        if (scEl) {
          scEl.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)';
        }
        sc.innerNodes?.forEach(scIn => {
          const scInEl = document.querySelector(`.react-flow__node[data-id="${scIn.id}"]`);
          if (scInEl) {
            scInEl.classList.add('case-inner-sliding');
            scInEl.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)';
          }
        });
      });
      switchDragRef.current = null;
    } else {
      switchDragRef.current = null;
      caseDragRef.current = null;
    }
  }, [takeSnapshot, handleInteract, reactFlowInstance, nodes]);

  const onNodeDrag = useCallback((event, node) => {
    if (readOnly) return;
    setContextMenu(null); setShowExportMenu(false);

    if (switchDragRef.current && node?.id === switchDragRef.current.switchId) {
      const dx = node.position.x - switchDragRef.current.startX;
      const dy = node.position.y - switchDragRef.current.startY;
      switchDragRef.current.movedElements.forEach(item => {
        const el = document.querySelector(`.react-flow__node[data-id="${item.id}"]`);
        if (el) {
          el.style.transform = `translate(${item.absX + dx}px, ${item.absY + dy}px)`;
        }
      });
    }

    if (caseDragRef.current && node?.id === caseDragRef.current.caseId) {
      const currentX = node.position.x;
      caseDragRef.current.currentX = currentX;
      const dx = currentX - caseDragRef.current.startX;

      // Move inner blocks of the dragged case synchronously
      caseDragRef.current.innerNodes.forEach(item => {
        const el = document.querySelector(`.react-flow__node[data-id="${item.id}"]`);
        if (el) {
          el.style.transform = `translate(${item.absX + dx}px, ${item.absY}px)`;
        }
      });

      // Animate sibling cases and their inner blocks based on slot midpoint boundaries
      const allCases = caseDragRef.current.allCasesInitialOrder || [];
      const myInitialIndex = allCases.findIndex(c => c.id === node.id);
      let targetIndex = 0;
      const draggedCenter = currentX + caseDragRef.current.cW / 2;
      for (let i = 0; i < allCases.length - 1; i++) {
        const slotCenter_i = allCases[i].startX + allCases[i].w / 2;
        const slotCenter_next = allCases[i+1].startX + allCases[i+1].w / 2;
        const boundary = (slotCenter_i + slotCenter_next) / 2;
        if (draggedCenter > boundary) {
          targetIndex = i + 1;
        }
      }
      caseDragRef.current.targetIndex = targetIndex;

      const GAP = 15;
      caseDragRef.current.siblingCases?.forEach(sc => {
        const scIndex = allCases.findIndex(c => c.id === sc.id);
        let shiftX = 0;
        if (myInitialIndex < targetIndex) {
          if (scIndex > myInitialIndex && scIndex <= targetIndex) {
            shiftX = -(caseDragRef.current.cW + GAP);
          }
        } else if (myInitialIndex > targetIndex) {
          if (scIndex >= targetIndex && scIndex < myInitialIndex) {
            shiftX = caseDragRef.current.cW + GAP;
          }
        }
        sc.currentShiftX = shiftX;

        const scEl = document.querySelector(`.react-flow__node[data-id="${sc.id}"]`);
        if (scEl) {
          scEl.style.transform = `translate(${sc.absX + shiftX}px, ${sc.absY}px)`;
        }
        sc.innerNodes?.forEach(scIn => {
          const scInEl = document.querySelector(`.react-flow__node[data-id="${scIn.id}"]`);
          if (scInEl) {
            scInEl.style.transform = `translate(${scIn.absX + shiftX}px, ${scIn.absY}px)`;
          }
        });
      });
    }

    let draggedNodes = nodes.filter(n => n.selected && n.type !== 'GROUP_BG');
    if (draggedNodes.length === 0) draggedNodes = [node];
    
    if (draggedNodes.some(n => n.type === 'COMMENT' || n.type === 'GROUP_BG' || n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER')) return;

    // Real-time automatic case wiring/unwiring while dragging connectable blocks
    if (['ACTION', 'IO', 'CONDITION'].includes(node?.type)) {
      const draggedIds = new Set(draggedNodes.map(n => n.id));
      const startPosNode = dragStartPositionsRef.current?.get(node.id) || node.position;
      const dx = node.position.x - startPosNode.x;
      const dy = node.position.y - startPosNode.y;

      const liveNodes = (reactFlowInstance ? reactFlowInstance.getNodes() : nodes).map(n => {
        if (n.id === node.id) {
          return { ...n, position: node.position, positionAbsolute: node.positionAbsolute ?? node.position, dragging: true };
        }
        if (draggedIds.has(n.id) && dragStartPositionsRef.current?.has(n.id)) {
          const sp = dragStartPositionsRef.current.get(n.id);
          const pos = { x: sp.x + dx, y: sp.y + dy };
          return { ...n, position: pos, positionAbsolute: pos, dragging: true };
        }
        return n;
      });
      const caseContainers = liveNodes.filter(n => n.type === 'CASE_CONTAINER');
      if (caseContainers.length > 0) {
        setEdges(eds => {
          let nextEds = eds;
          caseContainers.forEach(cNode => {
            nextEds = syncCaseAutoWiring(cNode, liveNodes, nextEds, edgeStyle);
          });
          const changed = nextEds.length !== eds.length || nextEds.some((e, i) => e.id !== eds[i]?.id || e.source !== eds[i]?.source || e.target !== eds[i]?.target);
          return changed ? nextEds : eds;
        });
      }
    }

    const draggedIds = new Set(draggedNodes.map(n => n.id));
    if (edges.some(e => (draggedIds.has(e.source) && !draggedIds.has(e.target)) || (draggedIds.has(e.target) && !draggedIds.has(e.source)))) return;

    // Morphing logic for dropping multiple nodes into a loop/for container (disabled per user request)
    const ENABLE_LOOP_INSERTION = false;
    if (ENABLE_LOOP_INSERTION && draggedNodes.length > 1) {
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
  }, [edges, nodes, readOnly, setNodes, setEdges, edgeStyle, reactFlowInstance]);

  const onNodeDragStop = useCallback((event, node, draggedNodesList) => {
    if (readOnly) return;
    handleInteract();
    if (hoveredEdgeRef.current) { hoveredEdgeRef.current.classList.remove('drop-target'); hoveredEdgeRef.current = null; }

    document.querySelectorAll('.react-flow__node-SWITCH_CONTAINER.drop-target-switch').forEach(el => el.classList.remove('drop-target-switch'));
    document.querySelectorAll('.is-dragging-case').forEach(el => {
      el.classList.remove('is-dragging-case');
      el.style.transition = '';
    });
    document.querySelectorAll('.case-inner-dragging').forEach(el => {
      el.classList.remove('case-inner-dragging');
      el.style.transition = '';
    });
    document.querySelectorAll('.case-inner-sliding').forEach(el => {
      el.classList.remove('case-inner-sliding');
      el.style.transition = '';
    });
    document.querySelectorAll('.react-flow__node-CASE_CONTAINER').forEach(el => {
      el.style.transition = '';
    });

    if (switchDragRef.current && node?.id === switchDragRef.current.switchId) {
      const dx = node.position.x - switchDragRef.current.startX;
      const dy = node.position.y - switchDragRef.current.startY;

      // Maintain DOM node transforms at their final positions to prevent any visual flicker or collapse
      switchDragRef.current.movedElements.forEach(item => {
        const el = document.querySelector(`.react-flow__node[data-id="${item.id}"]`);
        if (el) {
          el.style.transform = `translate(${item.absX + dx}px, ${item.absY + dy}px)`;
        }
      });
      const currentNodes = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
      const moveMap = new Map();
      if (switchDragRef.current.movedElements.length > 0 && (dx !== 0 || dy !== 0)) {
        switchDragRef.current.movedElements.forEach(item => {
          const inNode = currentNodes.find(n => n.id === item.id);
          // If the node has parentId (i.e. parented to a case or switch), its position is RELATIVE!
          // Moving the parent already moves the child; its relative position must NOT be overwritten!
          if (!inNode?.parentId || inNode.parentId === '1') {
            const finalX = Math.round(item.absX + dx);
            const finalY = Math.round(item.absY + dy);
            moveMap.set(item.id, { x: finalX, y: finalY });
          }
        });
      }

      const movedIds = new Set(switchDragRef.current.movedElements.map(m => m.id));
      let updatedNodesState = [];
      setNodes(nds => {
        const next = nds.map(n => {
          if (moveMap.has(n.id)) {
            return { ...n, position: moveMap.get(n.id) };
          }
          if (n.id === node.id) {
            return { ...n, position: { x: Math.round(node.position.x), y: Math.round(node.position.y) } };
          }
          if (movedIds.has(n.id)) {
            // Touch child nodes with new object reference so React Flow recomputes positionAbsolute
            return { ...n };
          }
          return n;
        });
        updatedNodesState = next;
        return next;
      });

      setEdges(eds => {
        let nextEds = [...eds];
        const stateNodes = updatedNodesState.length > 0 ? updatedNodesState : (reactFlowInstance ? reactFlowInstance.getNodes() : nodes);
        const myCases = stateNodes.filter(n => n.type === 'CASE_CONTAINER' && (n.data?.switchId === node.id || n.parentId === node.id));
        myCases.forEach(c => {
          nextEds = syncCaseAutoWiring(c, stateNodes, nextEds, edgeStyle);
        });
        return nextEds;
      });
      switchDragRef.current = null;
      return;
    }

    if (caseDragRef.current && node?.id === caseDragRef.current.caseId) {
      const allCases = caseDragRef.current.allCasesInitialOrder || [];
      const myInitialIndex = allCases.findIndex(c => c.id === node.id);
      const targetIndex = caseDragRef.current.targetIndex ?? myInitialIndex;

      const reorderedCases = [...allCases];
      const [draggedItem] = reorderedCases.splice(myInitialIndex, 1);
      reorderedCases.splice(targetIndex, 0, draggedItem);

      // Clean up DOM classes and transitions (do not wipe transform)
      const caseEl = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
      if (caseEl) {
        caseEl.classList.remove('is-dragging-case');
        caseEl.style.transition = 'none';
      }
      
      caseDragRef.current.innerNodes.forEach(item => {
        const el = document.querySelector(`.react-flow__node[data-id="${item.id}"]`);
        if (el) {
          el.classList.remove('case-inner-dragging');
          el.style.transition = 'none';
        }
      });

      caseDragRef.current.siblingCases?.forEach(sc => {
        const scEl = document.querySelector(`.react-flow__node[data-id="${sc.id}"]`);
        if (scEl) {
          scEl.style.transition = 'none';
        }
        sc.innerNodes?.forEach(scIn => {
          const scInEl = document.querySelector(`.react-flow__node[data-id="${scIn.id}"]`);
          if (scInEl) {
            scInEl.classList.remove('case-inner-sliding');
            scInEl.style.transition = 'none';
          }
        });
      });

      // 3. Assign target slots
      const GAP = 15;
      let curSlotX = GAP;
      const finalMoves = new Map();
      const currentNodes = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
      const swNode = currentNodes.find(n => n.id === caseDragRef.current.switchId);
      const swPos = swNode ? getNodeAbsPos(swNode) : { x: 0, y: 0 };
      const swAbsX = swPos.x;
      const swAbsY = swPos.y;

      reorderedCases.forEach(c => {
        const targetX = curSlotX;
        const targetY = 44;
        finalMoves.set(c.id, { x: targetX, y: targetY });

        const cEl = document.querySelector(`.react-flow__node[data-id="${c.id}"]`);
        if (cEl) {
          cEl.style.transform = `translate(${swAbsX + targetX}px, ${swAbsY + targetY}px)`;
        }

        const totalDx = targetX - c.startX;
        const siblingObj = (c.id === node.id) ? caseDragRef.current : caseDragRef.current.siblingCases?.find(sc => sc.id === c.id);
        const innerNodes = siblingObj?.innerNodes || [];

        innerNodes.forEach(inItem => {
          const inNode = currentNodes.find(n => n.id === inItem.id);
          const finalX = (inNode?.parentId === c.id) ? inItem.startX : Math.round(inItem.startX + totalDx);
          const finalY = inItem.startY;
          finalMoves.set(inItem.id, { x: finalX, y: finalY });

          const inEl = document.querySelector(`.react-flow__node[data-id="${inItem.id}"]`);
          if (inEl) {
            const finalAbsX = (inNode?.parentId === c.id) ? (swAbsX + targetX + inItem.startX) : (inItem.absX + totalDx);
            inEl.style.transform = `translate(${finalAbsX}px, ${inItem.absY}px)`;
          }
        });

        curSlotX += c.w + GAP;
      });

      let updatedNodesState = [];
      setNodes(currentNds => {
        const next = currentNds.map(n => finalMoves.has(n.id) ? { ...n, position: finalMoves.get(n.id) } : n);
        updatedNodesState = next;
        return next;
      });

      // 4. Auto-wire all cases in switch
      setEdges(eds => {
        let nextEds = [...eds];
        reorderedCases.forEach(c => {
          const cNode = updatedNodesState.find(n => n.id === c.id) || (reactFlowInstance ? reactFlowInstance.getNode(c.id) : null);
          if (cNode) {
            nextEds = syncCaseAutoWiring(cNode, updatedNodesState, nextEds, edgeStyle);
          }
        });
        return nextEds;
      });

      caseDragRef.current = null;
      return;
    }

    let draggedNodes = (draggedNodesList && draggedNodesList.length > 0)
      ? draggedNodesList
      : nodes.filter(n => n.selected && n.type !== 'GROUP_BG');
    if (draggedNodes.length === 0 && node) draggedNodes = [node];

    const draggedIds = new Set(draggedNodes.map(n => n.id));
    
    let snappedPositions = new Map();
    if (screenToFlowPosition) {
        const mousePos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const intersectingContainers = nodes.filter(n => {
            if (!['LOOP_CONTAINER', 'FOR_CONTAINER', 'SWITCH_CONTAINER', 'CASE_CONTAINER'].includes(n.type)) return false;
            if (draggedIds.has(n.id)) return false;
            
            let tcW = n.measured?.width || parseInt(n.style?.width || 0);
            let tcH = n.measured?.height || parseInt(n.style?.height || 0);
            if (!tcW && n.type === 'CASE_CONTAINER') tcW = 250;
            if (!tcH && n.type === 'CASE_CONTAINER') tcH = 166;
            if (!tcW && n.type === 'SWITCH_CONTAINER') tcW = 350;
            if (!tcH && n.type === 'SWITCH_CONTAINER') tcH = 230;

            const pNode = n.parentId ? nodes.find(p => p.id === n.parentId) : null;
            let absX = (pNode ? pNode.position.x : 0) + n.position.x;
            let absY = (pNode ? pNode.position.y : 0) + n.position.y;

            const nEl = document.querySelector(`.react-flow__node[data-id="${n.id}"]`);
            if (nEl && nEl.style.transform) {
                const match = nEl.style.transform.match(/translate(?:3d)?\((-?[\d.]+)px,?\s*(-?[\d.]+)px/);
                if (match) {
                    absX = parseFloat(match[1]);
                    absY = parseFloat(match[2]);
                }
            }
            if (nEl) {
                if (nEl.style.width) tcW = parseInt(nEl.style.width);
                if (nEl.style.height) tcH = parseInt(nEl.style.height);
            }

            const yMatch = n.type === 'CASE_CONTAINER' 
                ? (mousePos.y >= absY && mousePos.y <= absY + tcH + 30) 
                : (mousePos.y >= absY && mousePos.y <= absY + tcH);
            return mousePos.x >= absX && mousePos.x <= absX + tcW && yMatch;
        });

        const targetContainer = intersectingContainers.length > 0 ? intersectingContainers.sort((a, b) => {
            const areaA = (a.measured?.width || parseInt(a.style?.width || 250)) * (a.measured?.height || parseInt(a.style?.height || 150));
            const areaB = (b.measured?.width || parseInt(b.style?.width || 250)) * (b.measured?.height || parseInt(b.style?.height || 150));
            return areaA - areaB;
        })[0] : null;

        let needsSnap = false;
        const newPositions = new Map();
        const unparentedCaseIds = new Set();

        draggedNodes.forEach(dn => {
            if (!['ACTION', 'IO', 'CONDITION'].includes(dn.type)) return;

            const dnW = dn.measured?.width || parseInt(dn.style?.width || 100);
            const dnH = dn.measured?.height || parseInt(dn.style?.height || 50);

            if (targetContainer && targetContainer.type === 'CASE_CONTAINER') {
                const targetParent = targetContainer.parentId ? nodes.find(p => p.id === targetContainer.parentId) : null;
                let tcAbsX = (targetParent ? targetParent.position.x : 0) + targetContainer.position.x;
                let tcAbsY = (targetParent ? targetParent.position.y : 0) + targetContainer.position.y;
                let tcW = targetContainer.measured?.width || parseInt(targetContainer.style?.width || 250);
                let tcH = targetContainer.measured?.height || parseInt(targetContainer.style?.height || 166);

                const tcEl = document.querySelector(`.react-flow__node[data-id="${targetContainer.id}"]`);
                if (tcEl && tcEl.style.transform) {
                    const match = tcEl.style.transform.match(/translate(?:3d)?\((-?[\d.]+)px,?\s*(-?[\d.]+)px/);
                    if (match) {
                        tcAbsX = parseFloat(match[1]);
                        tcAbsY = parseFloat(match[2]);
                    }
                }
                if (tcEl) {
                    if (tcEl.style.width) tcW = parseInt(tcEl.style.width);
                    if (tcEl.style.height) tcH = parseInt(tcEl.style.height);
                }

                if (dn.parentId === targetContainer.id) {
                    // Block is already inside this case: clamp relative position inside case bounds
                    const clampedX = Math.max(15, Math.min(tcW - dnW - 15, Math.round(dn.position.x)));
                    const clampedY = Math.max(50, Math.round(dn.position.y));
                    if (clampedX !== dn.position.x || clampedY !== dn.position.y) {
                        newPositions.set(dn.id, { x: clampedX, y: clampedY, parentId: targetContainer.id });
                        needsSnap = true;
                    }
                } else {
                    // Block entered this case from outside: convert canvas absolute pos to relative case pos
                    if (dn.parentId && dn.parentId !== targetContainer.id) {
                        unparentedCaseIds.add(dn.parentId);
                    }
                    const relX = Math.max(15, Math.min(tcW - dnW - 15, Math.round(mousePos.x - tcAbsX - dnW / 2)));
                    const relY = Math.max(50, Math.round(mousePos.y - tcAbsY - dnH / 2));
                    newPositions.set(dn.id, { x: relX, y: relY, parentId: targetContainer.id });
                    needsSnap = true;
                }
            } else if (dn.parentId && nodes.find(p => p.id === dn.parentId)?.type === 'CASE_CONTAINER') {
                // Block dragged OUT of a case container onto canvas: un-parent and convert to absolute coordinates
                const prevCase = nodes.find(p => p.id === dn.parentId);
                if (prevCase) unparentedCaseIds.add(prevCase.id);
                const absX = Math.round(mousePos.x - dnW / 2);
                const absY = Math.round(mousePos.y - dnH / 2);
                newPositions.set(dn.id, { x: absX, y: absY, parentId: '1' });
                needsSnap = true;
            }
        });

        if (needsSnap) {
            snappedPositions = newPositions;
            setNodes(nds => nds.map(n => {
                if (newPositions.has(n.id)) {
                    const posInfo = newPositions.get(n.id);
                    return { ...n, position: { x: posInfo.x, y: posInfo.y }, parentId: posInfo.parentId };
                }
                return n;
            }));
        }

        // Commit real-time case and switch dimensions from DOM to React state
        setNodes(nds => {
            let modified = false;
            const nextNodes = nds.map(n => {
                if (n.type === 'CASE_CONTAINER' || n.type === 'SWITCH_CONTAINER') {
                    const el = document.querySelector(`.react-flow__node[data-id="${n.id}"]`);
                    if (el) {
                        const h = el.style.height ? parseInt(el.style.height) : null;
                        const w = el.style.width ? parseInt(el.style.width) : null;
                        const curH = parseInt(n.style?.height || 0);
                        const curW = parseInt(n.style?.width || 0);
                        if ((h && curH !== h) || (w && curW !== w)) {
                            modified = true;
                            return { ...n, style: { ...n.style, ...(h ? { height: h } : {}), ...(w ? { width: w } : {}) } };
                        }
                    }
                }
                return n;
            });
            return modified ? nextNodes : nds;
        });

        // Auto-wire all cases to highest and lowest connectable blocks, and remove disconnected edges
        setEdges(eds => {
            let nextEds = eds;
            if (unparentedCaseIds.size > 0) {
                const unparentedIds = new Set([...newPositions.keys()]);
                nextEds = nextEds.filter(e => 
                    !(unparentedCaseIds.has(e.source) && unparentedIds.has(e.target)) &&
                    !(unparentedIds.has(e.source) && unparentedCaseIds.has(e.target))
                );
            }
            const allCurrentNodes = (reactFlowInstance ? reactFlowInstance.getNodes() : nodes).map(n => 
                newPositions.has(n.id) 
                    ? { ...n, position: { x: newPositions.get(n.id).x, y: newPositions.get(n.id).y }, parentId: newPositions.get(n.id).parentId }
                    : n
            );
            const caseContainers = allCurrentNodes.filter(n => n.type === 'CASE_CONTAINER');
            caseContainers.forEach(caseNode => {
                nextEds = syncCaseAutoWiring(caseNode, allCurrentNodes, nextEds, edgeStyle);
            });
            return nextEds;
        });
    }

    // --- Record block move in log ---
    if (dragStartPositionsRef.current) {
        if (onLogAction) {
            const movedNodes = [];
            draggedNodes.forEach(dn => {
                if (dn.type === 'GROUP_BG') return;
                const fromPos = dragStartPositionsRef.current.get(dn.id);
                if (!fromPos) return;

                let toX = dn.position.x;
                let toY = dn.position.y;
                if (snappedPositions.has(dn.id)) {
                    const sp = snappedPositions.get(dn.id);
                    toX = sp.x;
                    toY = sp.y;
                } else if (dn.data?.morphOffset) {
                    toX += dn.data.morphOffset.x;
                    toY += dn.data.morphOffset.y;
                } else if (dn.id === node?.id && node?.position) {
                    toX = node.position.x;
                    toY = node.position.y;
                } else {
                    const rfNode = reactFlowInstance?.getNode(dn.id);
                    if (rfNode?.position) {
                        toX = rfNode.position.x;
                        toY = rfNode.position.y;
                    }
                }

                const from = { x: Math.round(fromPos.x), y: Math.round(fromPos.y) };
                const to = { x: Math.round(toX), y: Math.round(toY) };

                if (from.x !== to.x || from.y !== to.y) {
                    movedNodes.push({
                        id: dn.id,
                        type: dn.type,
                        label: dn.data?.label || '',
                        from,
                        to
                    });
                }
            });

            if (movedNodes.length === 1) {
                onLogAction('NODE_MOVED', {
                    id: movedNodes[0].id,
                    type: movedNodes[0].type,
                    label: movedNodes[0].label,
                    from: movedNodes[0].from,
                    to: movedNodes[0].to
                });
            } else if (movedNodes.length > 1) {
                onLogAction('NODES_MOVED', {
                    count: movedNodes.length,
                    nodes: movedNodes
                });
            }
        }
        dragStartPositionsRef.current = null;
    }

    if (draggedNodes.some(n => n.type === 'COMMENT' || n.type === 'GROUP_BG' || n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER')) return;

    if (edges.some(e => (draggedIds.has(e.source) && !draggedIds.has(e.target)) || (draggedIds.has(e.target) && !draggedIds.has(e.source)))) return;

    // Morphing logic for dropping multiple nodes into a loop/for container (disabled per user request)
    const ENABLE_LOOP_INSERTION = false;
    if (ENABLE_LOOP_INSERTION && draggedNodes.length > 1) {
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
  }, [edges, nodes, setEdges, edgeStyle, readOnly, handleInteract, onLogAction, screenToFlowPosition, reactFlowInstance]);


  
  useEffect(() => {
    if (xml && xml !== lastXmlRef.current) {
      lastXmlRef.current = xml;
      const { nodes: parsedNodes, edges: parsedEdges } = drawioToReactFlow(xml);
      setNodes(prev => parsedNodes.map(n => ({ 
          ...n, 
          selected: prev.find(p => p.id === n.id)?.selected || false, 
          data: { ...n.data, readOnly, edgeStyle, onStartEdit: takeSnapshot, handleInteract, onChange: (e) => updateNodeLabel(n.id, e.target.value, true), onUpdateData: (newData) => updateNodeData(n.id, newData) } 
      })));
      
      setEdges(prev => parsedEdges.map(e => {
          const srcNode = parsedNodes.find(n => n.id === e.source);
          const isCond = e.data?.isCondition || srcNode?.type === 'CONDITION' || ['ano', 'ne', 'yes', 'no', 'true', 'false', '+', '-'].includes((e.data?.label || '').toLowerCase().trim());
          const pref = edgeLabels[edgeStyle || 'true-false'];
          const isSwapped = srcNode?.data?.isSwapped === true;
          const label = e.data?.label || (isCond ? (e.sourceHandle === 's-right' ? (isSwapped ? pref.t : pref.f) : (isSwapped ? pref.f : pref.t)) : '');
          return { 
              ...e, 
              type: 'customEdge',
              selected: prev.find(p => p.id === e.id)?.selected || false, 
              data: { ...e.data, label, readOnly, edgeStyle, isCondition: isCond, handleInteract, takeSnapshot }, 
              markerEnd: { type: MarkerType.ArrowClosed } 
          };
      }));
    }
  }, [xml, readOnly, edgeStyle, setNodes, setEdges, updateNodeLabel, updateNodeData, handleInteract, takeSnapshot]);

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
        if (innerNode.parentId === containerNode.id) return true;
        const inPos = getNodeAbsPos ? getNodeAbsPos(innerNode) : { x: (innerNode.positionAbsolute?.x || innerNode.position.x), y: (innerNode.positionAbsolute?.y || innerNode.position.y) };
        const cPos = getNodeAbsPos ? getNodeAbsPos(containerNode) : { x: (containerNode.positionAbsolute?.x || containerNode.position.x), y: (containerNode.positionAbsolute?.y || containerNode.position.y) };
        const cx = inPos.x + (innerNode.measured?.width || 100) / 2;
        const cy = inPos.y + (innerNode.measured?.height || 50) / 2;
        const cX = cPos.x;
        const cY = cPos.y;
        const cW = containerNode.measured?.width || parseInt(containerNode.style?.width || 250);
        const cH = containerNode.measured?.height || parseInt(containerNode.style?.height || 150);
        if (containerNode.type === 'CASE_CONTAINER') {
            return cx >= cX && cx <= cX + cW && cy >= cY && cy <= cY + cH + 30;
        }
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

    let data = { edgeStyle, handleInteract, takeSnapshot };
    if (sourceNode?.type === 'CONDITION') {
        const currentEdges = getEdges();
        const outEdges = currentEdges.filter(e => e.source === params.source);
        const pref = edgeLabels[edgeStyle || 'true-false'];
        
        const isSwapped = sourceNode.data?.isSwapped === true;
        let newLabel = params.sourceHandle === 's-right' 
            ? (isSwapped ? pref.t : pref.f) 
            : (isSwapped ? pref.f : pref.t);
        
        if (outEdges.length === 1) {
            const existingLabel = outEdges[0].data?.label;
            const isPos = ['+', 'Ano', 'Yes', 'True'].includes(existingLabel);
            if (isPos) newLabel = pref.f;
            else newLabel = pref.t;
        }
        data.label = newLabel;
        data.isCondition = true;
    }

    setEdges(eds => {
        let filteredEds = eds.filter(e => {
            // Remove existing outgoing edge on the source handle
            if (sourceNode && sourceNode.type !== 'CONDITION' && e.source === params.source) return false;
            if (sourceNode && sourceNode.type === 'CONDITION' && e.source === params.source && e.sourceHandle === params.sourceHandle) return false;

            // Check existing incoming edge on target handle
            const isSameTargetHandle = e.target === params.target && (e.targetHandle || null) === (params.targetHandle || null);
            if (isSameTargetHandle) {
                // 1. ENDFUNCTION / END node or MERGE node can always have multiple incoming edges
                if (targetNode?.type === 'START_END' && targetNode.data?.mode === 'end') return true;
                if (targetNode?.type === 'MERGE') return true;

                const existingSourceNode = getNode(e.source);

                // 2. Loopback to CONDITION (IF) block
                if (targetNode?.type === 'CONDITION') {
                    const isDownstream = (startId, targetId, visited = new Set()) => {
                        if (startId === targetId) return true;
                        if (visited.has(startId)) return false;
                        visited.add(startId);
                        return eds.filter(ed => ed.source === startId).some(ed => isDownstream(ed.target, targetId, visited));
                    };
                    const isNewLoopback = isDownstream(targetNode.id, params.source) || (sourceNode && sourceNode.position.y > targetNode.position.y);
                    const isExistingLoopback = isDownstream(targetNode.id, e.source) || (existingSourceNode && existingSourceNode.position.y > targetNode.position.y);
                    if (isNewLoopback || isExistingLoopback) return true;
                }

                // 3. Convergence of two branches of an IF (CONDITION) block
                const getConditionBranches = (startNodeId, startHandle = null) => {
                    const result = new Map();
                    const queue = [{ id: startNodeId, handle: startHandle }];
                    const visited = new Set();
                    while (queue.length > 0) {
                        const curr = queue.shift();
                        const key = `${curr.id}_${curr.handle || ''}`;
                        if (visited.has(key)) continue;
                        visited.add(key);

                        const n = getNode(curr.id);
                        if (n && n.type === 'CONDITION' && curr.handle) {
                            if (!result.has(n.id)) result.set(n.id, new Set());
                            result.get(n.id).add(curr.handle);
                        }

                        eds.filter(ed => ed.target === curr.id).forEach(ed => {
                            queue.push({ id: ed.source, handle: ed.sourceHandle });
                        });
                    }
                    return result;
                };

                const newBranches = getConditionBranches(params.source, sourceNode?.type === 'CONDITION' ? params.sourceHandle : null);
                const existingBranches = getConditionBranches(e.source, existingSourceNode?.type === 'CONDITION' ? e.sourceHandle : null);

                let isIfBranchConvergence = false;
                for (const [condId, newSet] of newBranches.entries()) {
                    if (existingBranches.has(condId)) {
                        const existingSet = existingBranches.get(condId);
                        const hasDifferentBranch = Array.from(newSet).some(h => !existingSet.has(h)) ||
                                                   Array.from(existingSet).some(h => !newSet.has(h));
                        if (hasDifferentBranch) {
                            isIfBranchConvergence = true;
                            break;
                        }
                    }
                }
                if (isIfBranchConvergence) return true;

                // In all other cases: delete the existing incoming edge (replace with new connection)
                return false;
            }

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
    const position = clientPos 
      ? (clientPos.flowX !== undefined && clientPos.flowY !== undefined
          ? { x: clientPos.flowX, y: clientPos.flowY }
          : screenToFlowPosition({ x: clientPos.mouseX, y: clientPos.mouseY }))
      : (() => {
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
            ...(type === 'FOR_CONTAINER' ? { forInit: 'i = 0', forLimit: '10', forStep: '1' } : {}),
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
    const CONNECTABLE_TYPES = ['IO', 'ACTION', 'CONDITION'];
    if (conn && conn.nodeId && CONNECTABLE_TYPES.includes(type)) {
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
    const conn = connectingNodeRef.current;
    connectingNodeRef.current = null;
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setContextMenu({ 
      mouseX: e.clientX, 
      mouseY: e.clientY, 
      flowX: flowPos.x, 
      flowY: flowPos.y, 
      connectSource: conn, 
      openedAt: Date.now() 
    }); 
  }, [readOnly, screenToFlowPosition]);

  const handlePaneMouseDown = useCallback((e) => {
    if (readOnly) return;
    if (e.button === 1) {
      if (contextMenuRef.current && contextMenuRef.current.connectSource) {
        return;
      }
    }
    const slots = Array.isArray(safeHotkeys.contextMenu) ? safeHotkeys.contextMenu : (safeHotkeys.contextMenu ? [safeHotkeys.contextMenu] : []);
    const isMouse3 = slots.some(s => s.toLowerCase().trim() === 'mouse 3');
    if (e.button === 1 && isMouse3) {
      e.preventDefault();
      const conn = connectingNodeRef.current;
      connectingNodeRef.current = null;
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setContextMenu({ 
        mouseX: e.clientX, 
        mouseY: e.clientY, 
        flowX: flowPos.x, 
        flowY: flowPos.y, 
        connectSource: conn, 
        openedAt: Date.now() 
      });
    }
  }, [readOnly, safeHotkeys.contextMenu, screenToFlowPosition]);

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
    const codes = getReactFlowKeyCodes(safeHotkeys.pan);
    return codes || 'Space';
  }, [safeHotkeys.pan]);

  const multiSelectionKeyCode = useMemo(() => {
    return getReactFlowKeyCodes(safeHotkeys.multiSelect) || ['Control', 'Meta'];
  }, [safeHotkeys.multiSelect]);

  const isPanOnMouse1 = useMemo(() => {
    const slots = Array.isArray(safeHotkeys.pan) ? safeHotkeys.pan : (safeHotkeys.pan ? [safeHotkeys.pan] : []);
    return slots.some(s => {
      const lower = s.toLowerCase().trim();
      return lower === 'mouse 1' || lower === 'tažení' || lower === 'drag' || lower === 'tazeni';
    });
  }, [safeHotkeys.pan]);

  const selectionKeyCode = useMemo(() => {
    return getReactFlowKeyCodes(safeHotkeys.lassoSelect);
  }, [safeHotkeys.lassoSelect]);

  const panOnDrag = useMemo(() => {
    if (isPanOnMouse1) return [0, 1, 2];
    const slots = Array.isArray(safeHotkeys.pan) ? safeHotkeys.pan : (safeHotkeys.pan ? [safeHotkeys.pan] : []);
    const buttons = [];
    const hasMouse2 = slots.some(s => s.toLowerCase().trim() === 'mouse 2');
    const hasMouse3 = slots.some(s => s.toLowerCase().trim() === 'mouse 3');
    if (hasMouse3 || slots.length === 0) buttons.push(1);
    if (hasMouse2) buttons.push(2);
    if (buttons.length === 0) buttons.push(1);
    return buttons;
  }, [isPanOnMouse1, safeHotkeys.pan]);

  const hasPureDragLasso = useMemo(() => {
    const slots = Array.isArray(safeHotkeys.lassoSelect) ? safeHotkeys.lassoSelect : (safeHotkeys.lassoSelect ? [safeHotkeys.lassoSelect] : []);
    return slots.some(s => {
      const lower = s.toLowerCase().trim();
      return lower === 'tažení' || lower === 'tazeni' || lower === 'drag' || lower === 'mouse 1';
    });
  }, [safeHotkeys.lassoSelect]);

  const selectionOnDrag = useMemo(() => {
    return hasPureDragLasso && !isPanOnMouse1;
  }, [hasPureDragLasso, isPanOnMouse1]);

  return (
    <div className="w-full h-full relative outline-none" tabIndex={0} onClick={(e) => { 
      if (e && e.button === 1) return;
      if (contextMenuRef.current && Date.now() - (contextMenuRef.current.openedAt || 0) > 350) {
        setContextMenu(null);
      }
      setShowExportMenu(false); 
    }} onPointerMove={handlePointerMove} onPointerUp={clearHover} onPointerLeave={clearHover}>
      <style>{`
        .react-flow__edge.drop-target .react-flow__edge-path { stroke: #4f46e5 !important; stroke-width: 4px !important; filter: drop-shadow(0 0 6px rgba(79,70,229,0.5)); transition: all 0.2s ease; }
        .react-flow__edgelabel-renderer { z-index: 1000 !important; pointer-events: none; }
        .react-flow__edgelabel-renderer > * { pointer-events: all; }
      `}</style>
      
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
      
      {(() => {
        const isCaseSelected = selectedNodes.some(n => n.type === 'CASE_CONTAINER');
        const isSwitchSelected = selectedNodes.some(n => n.type === 'SWITCH_CONTAINER');
        let dialogTitle = "Smazat vybrané prvky?";
        let dialogDesc = undefined;
        let maxWidth = "max-w-[280px]";
        
        if (isCaseSelected) {
          dialogTitle = "Smazat větev (Case) a její bloky?";
          dialogDesc = "Smazáním této větve budou odstraněny i všechny bloky umístěné uvnitř.";
          maxWidth = "max-w-[320px]";
        } else if (isSwitchSelected) {
          dialogTitle = "Smazat Switch a jeho větve?";
          dialogDesc = "Smazáním tohoto přepínače budou odstraněny všechny jeho větve a bloky uvnitř.";
          maxWidth = "max-w-[320px]";
        }

        return (
          <ConfirmDialog
            isOpen={deleteConfirm}
            position="absolute"
            title={dialogTitle}
            desc={dialogDesc}
            confirmText="Smazat (Enter)"
            cancelText="Zrušit (Esc)"
            confirmVariant="danger"
            maxWidth={maxWidth}
            onConfirm={executeDelete}
            onCancel={() => setDeleteConfirm(false)}
          />
        );
      })()}

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

      <div className="absolute top-4 left-4 z-10 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 dark:border-gray-700">
        <button data-testid="Start/Konec" onClick={() => { clearHover(); addNodeAt('START_END', DEFAULT_BLOCK_STRINGS.START_END); }} onMouseEnter={(e) => handlePointerDown('START_END', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('START_END', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Circle size={18} className={colorMode ? "text-fuchsia-600" : ""} /></button>
        <button data-testid="Operace" onClick={() => { clearHover(); addNodeAt('ACTION', DEFAULT_BLOCK_STRINGS.ACTION); }} onMouseEnter={(e) => handlePointerDown('ACTION', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('ACTION', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Square size={18} className={colorMode ? "text-blue-600" : ""} /></button>
        <button data-testid="Vstup/Výstup" onClick={() => { clearHover(); addNodeAt('IO', DEFAULT_BLOCK_STRINGS.IO); }} onMouseEnter={(e) => handlePointerDown('IO', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('IO', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><IoIcon size={18} className={colorMode ? "text-emerald-600" : ""} /></button>
        <button data-testid="Podmínka" onClick={() => { clearHover(); addNodeAt('CONDITION', DEFAULT_BLOCK_STRINGS.CONDITION); }} onMouseEnter={(e) => handlePointerDown('CONDITION', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('CONDITION', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Diamond size={18} className={colorMode ? "text-orange-600" : ""} /></button>
        {editorMode !== 'advanced' && (
          <>
            <button data-testid="Cyklus" onClick={() => { clearHover(); addNodeAt('LOOP_CONTAINER', DEFAULT_BLOCK_STRINGS.LOOP_CONTAINER); }} onMouseEnter={(e) => handlePointerDown('LOOP_CONTAINER', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('LOOP_CONTAINER', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Hexagon size={18} className={colorMode ? "text-purple-600" : ""} /></button>
            <button data-testid="FOR Cyklus" onClick={() => { clearHover(); addNodeAt('FOR_CONTAINER', DEFAULT_BLOCK_STRINGS.FOR_CONTAINER); }} onMouseEnter={(e) => handlePointerDown('FOR_CONTAINER', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('FOR_CONTAINER', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Box size={18} className={colorMode ? "text-indigo-600" : ""} /></button>
            <button data-testid="Switch" onClick={() => { clearHover(); addNodeAt('SWITCH_CONTAINER', DEFAULT_BLOCK_STRINGS.SWITCH_CONTAINER); }} onMouseEnter={(e) => handlePointerDown('SWITCH_CONTAINER', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('SWITCH_CONTAINER', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><Columns size={18} className={colorMode ? "text-rose-600" : ""} /></button>
          </>
        )}
        <button data-testid="Komentář" onClick={() => { clearHover(); addNodeAt('COMMENT', DEFAULT_BLOCK_STRINGS.COMMENT); }} onMouseEnter={(e) => handlePointerDown('COMMENT', e)} onMouseLeave={clearHover} onTouchStart={(e) => handlePointerDown('COMMENT', e)} onTouchEnd={clearHover} onTouchCancel={clearHover} disabled={readOnly} className={btnClass}><MessageSquare size={18} className={colorMode ? "text-yellow-600" : ""} /></button>
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
          <label htmlFor="diagram-file-import" className={`p-2 rounded cursor-pointer text-gray-700 dark:text-gray-300 ${readOnly ? 'opacity-25 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <Upload size={18}/>
            <input id="diagram-file-import" name="diagramFileImport" aria-label="Import diagramu" type="file" accept=".xml,.drawio,.json" className="hidden" onChange={handleImport} disabled={readOnly} />
          </label>
        </Tooltip>
        <div className="relative">
            <Tooltip text="Export diagramu" position="bottom-left">
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

      <div className="w-full h-full" onContextMenu={handlePaneContextMenu} onMouseDown={handlePaneMouseDown}>
        <ReactFlow 
          nodes={allNodes} edges={allEdges} 
          attributionPosition="bottom-left"
          onNodesChange={(changes) => { 
              const isUserChange = changes.some(c => c.type !== 'dimensions' && c.type !== 'replace');
              if (isUserChange) handleInteract(); 
              if (readOnly) return;

              let finalChanges = changes;
              const hasCaseChange = changes.some(c => c.type === 'position' && c.position);
              if (hasCaseChange) {
                finalChanges = [...changes];
                changes.forEach(c => {
                  if (c.type === 'position' && c.position) {
                    const node = (reactFlowInstance ? reactFlowInstance.getNode(c.id) : null) || nodes.find(n => n.id === c.id);
                    if (node?.type === 'CASE_CONTAINER') {
                      const switchId = node.data?.switchId || node.parentId;
                      const allSwitchContainers = nodes.filter(n => n.type === 'SWITCH_CONTAINER');
                      const switchNode = (reactFlowInstance ? reactFlowInstance.getNode(switchId) : null) || nodes.find(n => n.id === switchId);
                      const allSwitchCases = nodes.filter(n => n.type === 'CASE_CONTAINER' && (n.data?.switchId === switchId || n.parentId === switchId));
                      const regularCases = allSwitchCases.filter(sc => !sc.data?.isDefault);

                      c.position.y = 44;

                      if (regularCases.length <= 1) {
                        c.position.x = caseDragRef.current?.startX ?? node.position.x;
                        return;
                      }

                      const swEl = document.querySelector(`.react-flow__node[data-id="${switchId}"]`);
                      const domSwW = swEl ? (parseInt(swEl.style.width) || swEl.offsetWidth) : 0;
                      const swW = Math.max(domSwW, switchNode?.style?.width ? parseInt(switchNode.style.width) : (switchNode?.measured?.width || 350));
                      const cW = node.style?.width ? parseInt(node.style.width) : (node.measured?.width || 250);
                      const minX = 15;
                      let maxX = Math.max(minX, swW - cW - 15);
                      if (caseDragRef.current?.allCasesInitialOrder) {
                        const lastCase = caseDragRef.current.allCasesInitialOrder[caseDragRef.current.allCasesInitialOrder.length - 1];
                        if (lastCase) {
                          maxX = Math.max(maxX, lastCase.startX + Math.max(0, lastCase.w - cW) + 20);
                        }
                      }
                      c.position.x = Math.max(minX, Math.min(maxX, c.position.x));

                      if (caseDragRef.current && caseDragRef.current.caseId === node.id) {
                        caseDragRef.current.currentX = c.position.x;
                      }
                    }
                  }
                });
              }

              onNodesChange(finalChanges); 
          }} 
          onEdgesChange={(changes) => { 
              const isUserChange = changes.some(c => c.type !== 'replace');
              if (isUserChange) handleInteract(); 
              if (!readOnly) onEdgesChange(changes); 
          }} 
          onConnect={(params) => { if (!readOnly) onConnect(params); }} 
          onConnectStart={(event, params) => { connectingNodeRef.current = params; }}
          onConnectEnd={() => { setTimeout(() => { if (!contextMenuRef.current) connectingNodeRef.current = null; }, 150); }}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={(e) => { 
            handleInteract(); 
            if (e && e.button === 1) return;
            if (contextMenuRef.current && Date.now() - (contextMenuRef.current.openedAt || 0) > 350) {
              setContextMenu(null);
            }
            setShowExportMenu(false); 
            if (onPaneClickRef.current) onPaneClickRef.current(); 
          }}
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
          deleteKeyCode={null} 
          selectionOnDrag={selectionOnDrag} 
          panOnDrag={panOnDrag} 
          panOnScroll={true} 
          selectionMode={selectionMode === 'full' ? 'full' : 'partial'}
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
          <ViewportPortal>
            {contextMenu && (
              <div 
                ref={contextMenuDomRef}
                className={`nodrag nopan absolute z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl flex flex-col pb-1 overflow-hidden min-w-[170px] ${!contextMenu.connectSource ? 'pt-1' : ''}`} 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `translate(${contextMenu.flowX}px, ${contextMenu.flowY}px)`,
                  pointerEvents: 'all'
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
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
                    const t = item.type;
                    const txt = DEFAULT_BLOCK_STRINGS[t] ?? '';
                    
                    if (contextMenu.connectSource && (t === 'LOOP_CONTAINER' || t === 'FOR_CONTAINER')) {
                        addNodeAt(t, txt, contextMenu);
                        setContextMenu(prev => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                mouseX: prev.mouseX + 40,
                                mouseY: prev.mouseY + 40,
                                flowX: prev.flowX + 40,
                                flowY: prev.flowY + 40,
                                openedAt: Date.now()
                            };
                        });
                        return;
                    }
                    
                    addNodeAt(t, txt, contextMenu); 
                    setContextMenu(null); 
                  }} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    {item.type === 'IO' ? <IoIcon size={14} className={item.color} /> : <item.icon size={14} className={item.color} />} {item.label}
                  </button>
                ))}
              </div>
            )}
          </ViewportPortal>
        </ReactFlow>

        {/* Bottom-left zoom & center controls styled to match EduCode app UI (vertical orientation) */}
        <div className="absolute bottom-6 left-4 z-10 flex flex-col items-center gap-0.5 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <Tooltip text="Přiblížit" position="right">
            <button
              type="button"
              onClick={() => handleZoom(1.2)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors"
              aria-label="Přiblížit"
            >
              <ZoomIn size={16} />
            </button>
          </Tooltip>
          <Tooltip text="Oddálit" position="right">
            <button
              type="button"
              onClick={() => handleZoom(1 / 1.2)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors"
              aria-label="Oddálit"
            >
              <ZoomOut size={16} />
            </button>
          </Tooltip>
          <div className="w-4 h-px bg-gray-200 dark:bg-gray-700 my-0.5" />
          <Tooltip text="Vycentrovat" position="right">
            <button
              type="button"
              onClick={() => reactFlowInstance?.fitView({ padding: 0.2, duration: 250 })}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors"
              aria-label="Vycentrovat"
            >
              <Maximize2 size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default function DiagramEditor(props) {
  return <ReactFlowProvider><EditorCanvas {...props} /></ReactFlowProvider>;
}