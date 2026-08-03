import React from 'react';
import { Handle, Position, useReactFlow, useEdges, NodeResizeControl, useStoreApi } from '@xyflow/react';
import { RefreshCcw, MousePointer2 } from 'lucide-react';
import { calculateStretchLimits } from '../../utils/stretchLimits';
import { useContainerBounds } from './useContainerBounds';
import { edgeLabels, getHighlightClass } from './constants';

const DragHandle = () => <div className="custom-drag-handle w-8 h-1.5 cursor-grab bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors mx-auto mb-1" title="Chytit a přesunout" />;

const useDoubleClickEdit = (readOnly) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const inputRef = React.useRef(null);
    React.useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current.select) inputRef.current.select();
        }
    }, [isEditing]);
    const onDoubleClick = React.useCallback((e) => {
        if (!readOnly) {
            e.stopPropagation();
            setIsEditing(true);
        }
    }, [readOnly]);
    const onBlur = React.useCallback(() => {
        setIsEditing(false);
    }, []);
    return { isEditing, inputRef, onDoubleClick, onBlur };
};

const handleInputMouseDown = (e, selected) => {
  if (!selected && document.activeElement !== e.target) e.preventDefault();
};

const handleInputResize = (e) => {
  e.target.style.height = 'auto';
  e.target.style.height = e.target.scrollHeight + 'px';
  e.target.style.width = 'auto';
  e.target.style.width = Math.max(100, e.target.scrollWidth) + 'px';
};

const handleNodeKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.target.blur();
  }
};

export const GroupBgNode = ({ data }) => (
    <div style={{ backgroundColor: data.bgColor, borderColor: data.borderColor }} className="w-full h-full rounded-[2rem] border-[3px] border-dashed pointer-events-none" />
);

export const StartEndNode = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  let mode = data.mode || 'unassigned';
  let entityType = data.entityType || 'FUNCTION';
  
  const { isEditing, inputRef, onDoubleClick, onBlur } = useDoubleClickEdit(data.readOnly);

  const setMode = (newMode) => {
    let newLabel = data.label;
    if (newMode === 'start' && !newLabel) newLabel = 'main';
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, mode: newMode, label: newLabel } } : n));
  };


  const isGray = data.colorMode === false;
  const bgClass = isGray ? 'bg-gray-100 dark:bg-gray-800' : 'bg-fuchsia-50 dark:bg-fuchsia-900/30';
  const borderClass = isGray ? 'border-gray-400 dark:border-gray-600' : 'border-fuchsia-300 dark:border-fuchsia-700';
  const titleColor = isGray ? 'text-gray-500' : 'text-fuchsia-500';
  const handleClass = isGray ? '!bg-gray-400' : '!bg-fuchsia-600';
  
  const highlightClass = getHighlightClass(data.isRuntimeActive, data.externalHighlight, selected, borderClass);

  return (
    <div className={`${bgClass} border-2 rounded-[2rem] min-w-[140px] min-h-[40px] flex flex-col justify-center items-center p-2 transition-all relative ${highlightClass} ${data.isBreakpoint ? 'ring-4 ring-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : ''}`}>
      {data.showDebugger && (
          <button onClick={() => data.onBreakpointToggle && data.onBreakpointToggle(id)} className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white shadow-md z-50 transition-colors ${data.isBreakpoint ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-200 hover:bg-red-400'}`} title="Zarážka (Breakpoint)" />
      )}

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
        <div className="w-full flex-1 flex flex-col px-2 relative pb-1" onDoubleClick={onDoubleClick}>
          <div className="flex justify-between items-center w-full mb-1 px-1">
            <span className={`text-[9px] font-bold w-12 text-left ${titleColor}`}>START</span>
            <div className={`custom-drag-handle w-8 h-1.5 cursor-grab rounded-full transition-colors ${isGray ? 'bg-gray-300 dark:bg-gray-600' : 'bg-fuchsia-200 dark:bg-fuchsia-800'}`} />
            <span onClick={data.onToggleEntityType} className={`text-[9px] font-bold w-12 text-right cursor-pointer hover:opacity-75 ${titleColor} ${data.readOnly ? 'pointer-events-none' : 'pointer-events-auto'}`} title="Kliknutím přepnete na CLASS">{entityType}</span>
          </div>
          <input ref={inputRef} defaultValue={data.label} onChange={data.onChange} onKeyDown={handleNodeKeyDown} onBlur={onBlur} onMouseDown={(e) => { if(isEditing) e.stopPropagation(); else handleInputMouseDown(e, selected); }} readOnly={data.readOnly || !isEditing} className={`w-full flex-1 text-center outline-none bg-transparent text-sm font-mono font-bold nodrag text-gray-900 dark:text-gray-100 ${isEditing ? 'pointer-events-auto' : 'pointer-events-none cursor-text'}`} />
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

export const ActionNode = ({ id, data, selected }) => {
  const isGray = data.colorMode === false;
  const bgClass = isGray ? 'bg-gray-50 dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/30';
  const baseBorder = isGray ? 'border-gray-400 dark:border-gray-600' : 'border-blue-300 dark:border-blue-700';
  const handleClass = isGray ? '!bg-gray-400' : '!bg-blue-600';
  
  const { isEditing, inputRef, onDoubleClick, onBlur } = useDoubleClickEdit(data.readOnly);
  const highlightClass = getHighlightClass(data.isRuntimeActive, data.externalHighlight, selected, baseBorder);

  return (
    <div onDoubleClick={onDoubleClick} className={`${bgClass} border-2 p-2 min-w-[100px] min-h-[50px] flex flex-col rounded-md relative transition-all ${highlightClass} ${data.isBreakpoint ? 'ring-4 ring-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : ''}`}>
      {data.showDebugger && (
          <button onClick={() => data.onBreakpointToggle && data.onBreakpointToggle(id)} className={`absolute -left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white shadow-md z-50 transition-colors ${data.isBreakpoint ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-200 hover:bg-red-400'}`} title="Zarážka (Breakpoint)" />
      )}
      
      <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />

      <DragHandle />
      <textarea ref={inputRef} rows={1} defaultValue={data.label} onChange={data.onChange} onKeyDown={handleNodeKeyDown} onBlur={onBlur} onInput={handleInputResize} onMouseDown={(e) => { if(isEditing) e.stopPropagation(); else handleInputMouseDown(e, selected); }} readOnly={data.readOnly || !isEditing} className={`w-full flex-1 text-center outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden text-gray-900 dark:text-gray-100 ${isEditing ? 'pointer-events-auto' : 'pointer-events-none cursor-text'}`} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-2 !h-2 ${handleClass}`} />
    </div>
  );
};

export const IONode = ({ id, data, selected }) => {
  const isGray = data.colorMode === false;
  const isInput = (data.ioType || 'input') === 'input';

  const { isEditing, inputRef, onDoubleClick, onBlur } = useDoubleClickEdit(data.readOnly);

  const fillClass = isGray 
      ? 'fill-gray-50 dark:fill-gray-800' 
      : (isInput ? 'fill-emerald-50 dark:fill-emerald-900/30' : 'fill-cyan-50 dark:fill-cyan-900/30');
  const defaultStroke = isGray 
      ? 'text-gray-400 dark:text-gray-600' 
      : (isInput ? 'text-emerald-400 dark:text-emerald-700' : 'text-cyan-400 dark:text-cyan-700');
  const handleClass = isGray 
      ? '!bg-gray-400' 
      : (isInput ? '!bg-emerald-600' : '!bg-cyan-600');
  const badgeColor = isGray 
      ? 'text-gray-500' 
      : (isInput ? 'text-emerald-700/60 dark:text-emerald-400/60' : 'text-cyan-700/60 dark:text-cyan-400/60');
  
  let strokeClass = defaultStroke;
  let shadowClass = '';
  let strokeW = "2";
  
  if (data.isRuntimeActive) {
      strokeClass = 'text-red-500 dark:text-red-500';
      shadowClass = 'drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]';
      strokeW = "4";
  } else if (data.externalHighlight) {
      strokeClass = 'text-emerald-500';
      strokeW = "4";
  } else if (selected) {
      strokeClass = 'text-indigo-600 dark:text-indigo-500';
      strokeW = "4";
  }

  if (data.isBreakpoint) {
      strokeClass = 'text-red-500';
      shadowClass = 'drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]';
      strokeW = "4";
  }

  const handleUserChange = (e) => {
      let val = e.target.value;
      let lowerVal = val.toLowerCase();
      if (lowerVal.startsWith('vstup ') || lowerVal.startsWith('input ') || lowerVal.startsWith('input(')) {
          val = val.replace(/^(vstup|input)\s*\(/i, '').replace(/^(vstup|input)\s+/i, '').trim();
          if (lowerVal.startsWith('input(') && val.endsWith(')')) val = val.substring(0, val.length - 1);
          e.target.value = val;
          if (data.ioType !== 'input') data.onToggleIOType();
      } else if (lowerVal.startsWith('vystup ') || lowerVal.startsWith('výstup ') || lowerVal.startsWith('print ') || lowerVal.startsWith('print(')) {
          val = val.replace(/^(vystup|výstup|print)\s*\(/i, '').replace(/^(vystup|výstup|print)\s+/i, '').trim();
          if (lowerVal.startsWith('print(') && val.endsWith(')')) val = val.substring(0, val.length - 1);
          e.target.value = val;
          if (data.ioType !== 'output') data.onToggleIOType();
      } else if (lowerVal === 'vstup' || lowerVal === 'vystup' || lowerVal === 'výstup' || lowerVal === 'print' || lowerVal === 'input') {
          val = '';
          e.target.value = val;
      }
      data.onChange(e);
  };

  return (
    <div onDoubleClick={onDoubleClick} className={`relative min-w-[120px] min-h-[50px] flex flex-col transition-all ${data.isRuntimeActive ? 'z-50' : ''}`}>
      {data.showDebugger && (
          <button onClick={() => data.onBreakpointToggle && data.onBreakpointToggle(id)} className={`absolute -left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white shadow-md z-50 transition-colors ${data.isBreakpoint ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-200 hover:bg-red-400'}`} title="Zarážka (Breakpoint)" />
      )}
      
      <svg className={`absolute inset-0 w-full h-full pointer-events-none -z-10 ${strokeClass} ${shadowClass}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon points="15,2 98,2 85,98 2,98" className={fillClass} stroke="currentColor" strokeWidth={strokeW} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      
      <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />
      
      <div className="pt-2 z-10"><DragHandle /></div>
      
      <span onClick={data.onToggleIOType} className={`absolute top-[4px] left-[35px] text-[9px] font-bold cursor-pointer hover:opacity-75 ${badgeColor} select-none z-20 ${data.readOnly ? 'pointer-events-none' : 'pointer-events-auto'} flex items-center gap-1`} title="Kliknutím přepnete typ bloku">
          {isInput ? 'VSTUP' : 'VÝSTUP'}
          <RefreshCcw size={8} className="opacity-80" />
      </span>
      
      <textarea ref={inputRef} rows={1} defaultValue={data.label} onChange={handleUserChange} onKeyDown={handleNodeKeyDown} onBlur={onBlur} onInput={handleInputResize} onMouseDown={(e) => { if(isEditing) e.stopPropagation(); else handleInputMouseDown(e, selected); }} readOnly={data.readOnly || !isEditing} className={`w-full flex-1 text-center outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden text-gray-900 dark:text-gray-100 ${isEditing ? 'pointer-events-auto' : 'pointer-events-none cursor-text'} relative z-10 px-[35px] pt-1`} />
      
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-2 !h-2 ${handleClass}`} />
    </div>
  );
};

export const ConditionNode = ({ id, data, selected }) => {
  const edges = useEdges();
  const outEdges = edges.filter(e => e.source === id).length;
  const hasWarning = outEdges === 1;

  const { isEditing, inputRef, onDoubleClick, onBlur } = useDoubleClickEdit(data.readOnly);
  const isGray = data.colorMode === false;

  const fillClass = isGray ? 'fill-gray-50 dark:fill-gray-800' : (hasWarning ? 'fill-red-50 dark:fill-red-900/20' : 'fill-orange-50 dark:fill-orange-900/30');
  const defaultStroke = isGray ? 'text-gray-400 dark:text-gray-600' : 'text-orange-400 dark:text-orange-700';
  const handleClass = isGray ? '!bg-gray-400' : '!bg-orange-600';
  
  let strokeClass = defaultStroke;
  let shadowClass = '';
  let strokeW = "2";
  
  if (data.isRuntimeActive) {
      strokeClass = 'text-red-500 dark:text-red-500';
      shadowClass = 'drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]';
      strokeW = "4";
  } else if (data.externalHighlight) {
      strokeClass = 'text-emerald-500';
      strokeW = "4";
  } else if (selected) {
      strokeClass = 'text-indigo-600 dark:text-indigo-500';
      strokeW = "4";
  }

  if (data.isBreakpoint) {
      strokeClass = 'text-red-500';
      shadowClass = 'drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]';
      strokeW = "4";
  }
  
  const pref = edgeLabels[data.edgeStyle || 'true-false'];
  const tChar = pref.t.charAt(0).toUpperCase();
  const fChar = pref.f.charAt(0).toUpperCase();

  const bottomEdge = edges.find(e => e.source === id && e.sourceHandle === 's-bottom');
  const rightEdge = edges.find(e => e.source === id && e.sourceHandle === 's-right');
  const { setEdges } = useReactFlow();

  let bIsT = true;
  if (bottomEdge && bottomEdge.data?.label) {
      bIsT = ['True', 'Ano', '+', 'Yes', pref.t].includes(bottomEdge.data.label);
  } else if (rightEdge && rightEdge.data?.label) {
      bIsT = !(['True', 'Ano', '+', 'Yes', pref.t].includes(rightEdge.data.label));
  }
  
  const expectedBottomLabel = bIsT ? pref.t : pref.f;
  const expectedRightLabel = bIsT ? pref.f : pref.t;
  
  const isBottomTrue = bIsT;
  const isRightTrue = !bIsT;

  React.useEffect(() => {
      if (data.readOnly) return;
      let needsUpdate = false;
      if (bottomEdge && bottomEdge.data?.label !== expectedBottomLabel) needsUpdate = true;
      if (rightEdge && rightEdge.data?.label !== expectedRightLabel) needsUpdate = true;
      
      if (needsUpdate) {
          // Push to end of event loop to avoid React warning about updating state during render
          setTimeout(() => {
              setEdges(eds => eds.map(e => {
                  if (bottomEdge && e.id === bottomEdge.id) return { ...e, data: { ...e.data, label: expectedBottomLabel } };
                  if (rightEdge && e.id === rightEdge.id) return { ...e, data: { ...e.data, label: expectedRightLabel } };
                  return e;
              }));
          }, 0);
      }
  }, [bottomEdge, rightEdge, expectedBottomLabel, expectedRightLabel, data.readOnly, setEdges]);

  const bottomChar = isBottomTrue ? tChar : fChar;
  const rightChar = isRightTrue ? tChar : fChar;
  
  const bottomBorderColor = isGray ? '!border-gray-500 !text-gray-600' : (isBottomTrue ? '!border-green-500 !text-green-600' : '!border-red-500 !text-red-600');
  const rightBorderColor = isGray ? '!border-gray-500 !text-gray-600' : (isRightTrue ? '!border-green-500 !text-green-600' : '!border-red-500 !text-red-600');

  const isDiamond = data.conditionShape === 'diamond';
  const polygonPoints = isDiamond ? "50,2 98,50 50,98 2,50" : "15,2 85,2 98,50 85,98 15,98 2,50";

  return (
    // Zvětšeno z min-w-[120px] min-h-[60px] na 160px x 80px, aby se posuvník pohodlně vešel do obou tvarů
    <div onDoubleClick={onDoubleClick} className={`relative flex flex-col items-center justify-center min-w-[160px] min-h-[80px] transition-all ${data.isRuntimeActive ? 'z-50' : ''}`}>
      {data.showDebugger && (
          <button onClick={() => data.onBreakpointToggle && data.onBreakpointToggle(id)} className={`absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white shadow-md z-50 transition-colors ${data.isBreakpoint ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-200 hover:bg-red-400'}`} title="Zarážka (Breakpoint)" />
      )}

      <svg className={`absolute inset-0 w-full h-full pointer-events-none -z-10 ${strokeClass} ${shadowClass}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon points={polygonPoints} className={fillClass} stroke="currentColor" strokeWidth={strokeW} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />

      {/* Změněno z top-1 na top-2.5, aby se u kosočtverce drag handle neřezal o hranu (přidává to padding zespoda špičky) */}
      <div className="absolute top-2.5 z-10"><DragHandle /></div>
      
      {/* Větší max šířka textarea, protože celý blok je nyní větší */}
      <textarea ref={inputRef} rows={1} defaultValue={data.label} onChange={data.onChange} onKeyDown={handleNodeKeyDown} onBlur={onBlur} onInput={handleInputResize} onMouseDown={(e) => { if(isEditing) e.stopPropagation(); else handleInputMouseDown(e, selected); }} readOnly={data.readOnly || !isEditing} className={`min-w-[90px] max-w-[130px] text-center outline-none bg-transparent text-sm font-mono nodrag mt-3 z-10 resize-none overflow-hidden text-gray-900 dark:text-gray-100 px-1 ${hasWarning ? 'text-red-700 dark:text-red-400 font-bold' : ''} ${isEditing ? 'pointer-events-auto' : 'pointer-events-none cursor-text'}`} />
      
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-white dark:!bg-gray-800 !border-2 ${bottomBorderColor} !text-[10px] !font-bold flex items-center justify-center !rounded-sm z-20 cursor-crosshair leading-none p-0`}>{bottomChar}</Handle>
      <Handle type="source" position={Position.Right} id="s-right" className={`!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-white dark:!bg-gray-800 !border-2 ${rightBorderColor} !text-[10px] !font-bold flex items-center justify-center !rounded-sm z-20 cursor-crosshair leading-none p-0`}>{rightChar}</Handle>
    </div>
  );
};

export const CommentNode = ({ data, selected }) => {
  const isGray = data.colorMode === false;
  const bgClass = isGray ? 'bg-gray-50 dark:bg-gray-800' : 'bg-yellow-50 dark:bg-yellow-900/30';
  const borderClass = isGray ? 'border-gray-400 dark:border-gray-600' : 'border-yellow-300 dark:border-yellow-700';
  const highlightClass = getHighlightClass(data.isRuntimeActive, data.externalHighlight, selected, borderClass);
  const { isEditing, inputRef, onDoubleClick, onBlur } = useDoubleClickEdit(data.readOnly);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [data.label, isEditing, inputRef]);

  return (
    <div onDoubleClick={onDoubleClick} className={`${bgClass} border-2 p-2 min-w-[160px] flex flex-col rounded-md relative transition-all ${highlightClass}`}>
      <DragHandle />
      <div className="flex w-full items-start gap-1.5 mt-1">
        <span className="text-gray-400 dark:text-gray-500 font-mono select-none shrink-0 pointer-events-none leading-normal">#</span>
        <textarea ref={inputRef} rows={1} defaultValue={data.label} onChange={data.onChange} onKeyDown={handleNodeKeyDown} onBlur={onBlur} onInput={handleInputResize} onMouseDown={(e) => { if(isEditing) e.stopPropagation(); else handleInputMouseDown(e, selected); }} readOnly={data.readOnly || !isEditing} className={`w-full flex-1 outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden text-gray-700 dark:text-yellow-100 leading-normal ${isEditing ? 'pointer-events-auto' : 'pointer-events-none cursor-text'}`} style={{ minHeight: '30px' }} />
      </div>
    </div>
  );
};

export const MergeNode = () => (
    <div className="w-2 h-2 bg-transparent pointer-events-none">
        <Handle type="target" position={Position.Top} id="t-top" className="opacity-0" />
        <Handle type="target" position={Position.Right} id="t-right" className="opacity-0" />
        <Handle type="target" position={Position.Left} id="t-left" className="opacity-0" />
        <Handle type="source" position={Position.Bottom} id="s-bottom" className="opacity-0" />
    </div>
);

export const LoopContainerNode = ({ id, data, selected, dragging }) => {
  const isGray = data.colorMode === false;
  const borderColor = (selected || data.isRuntimeActive) ? 'border-indigo-500' : (isGray ? 'border-gray-400 dark:border-gray-600' : 'border-purple-400 dark:border-purple-600');
  const bgColor = isGray ? 'bg-gray-50/50 dark:bg-gray-900/50' : 'bg-purple-50/30 dark:bg-purple-900/10';
  
  const isDoWhile = data.doWhile === true;
  const {
      containerRef,
      rightLimitTopRef,
      rightLimitBottomRef,
      bottomLimitLeftRef,
      bottomLimitRightRef,
      handleSelectAll
  } = useContainerBounds(id, { ...data, isForContainer: false }, dragging, 300, 150);
  
  const toggleDoWhile = (e) => {
    e.stopPropagation();
    if (data.onUpdateData) {
        data.onUpdateData({ doWhile: !isDoWhile });
    } else {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, doWhile: !isDoWhile } } : n));
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full rounded-lg border-2 border-dashed ${borderColor} ${bgColor} flex flex-col overflow-visible ${selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-blue-50/50' : ''}`}>
      {/* Hlavička cyklu - Zde přidáme custom-drag-handle pro React Flow */}
      <div className={`custom-drag-handle absolute -top-4 left-4 px-2 py-1 bg-white dark:bg-gray-800 text-xs font-bold rounded shadow-sm border ${borderColor} flex items-center gap-2 pointer-events-auto cursor-grab active:cursor-grabbing`}>
        <RefreshCcw size={12} className="text-purple-500" />
        <span className="text-purple-700 dark:text-purple-300">WHILE</span>
        
        <input 
            type="text" 
            defaultValue={data.label} 
            onChange={data.onChange}
            onMouseDown={e => e.stopPropagation()}
            className="outline-none bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 px-1 py-0.5 rounded text-xs font-mono w-24 border border-transparent focus:border-purple-300 cursor-text"
            placeholder="Podmínka"
        />

        {/* Toggle přesunutý napravo od inputu */}
        <div className="flex items-center gap-1 ml-1 pl-2 border-l border-gray-200 dark:border-gray-600">
            <span className="text-[10px] font-bold text-gray-500">DO</span>
            <div 
            onClick={toggleDoWhile}
            className={`w-7 h-3.5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${isDoWhile ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            title="Přepnout na testování podmínky na konci cyklu (Do-While)"
            >
            <div className={`bg-white w-2.5 h-2.5 rounded-full shadow-md transform transition-transform ${isDoWhile ? 'translate-x-3.5' : 'translate-x-0'}`}></div>
            </div>
        </div>
      </div>

      {/* Tlačítko pro vybrání všeho uvnitř */}
      <button 
        onPointerDown={handleSelectAll}
        className={`absolute -top-3 -right-3 w-6 h-6 bg-white dark:bg-gray-800 rounded-full shadow-sm border ${borderColor} flex items-center justify-center pointer-events-auto hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors z-10 cursor-grab active:cursor-grabbing`}
        title="Vybrat vše v cyklu a přesunout"
      >
        <MousePointer2 size={12} className="text-purple-500" />
      </button>

      {/* Right Limit Extensions */}
      <div ref={rightLimitTopRef} className="absolute bottom-full right-0 w-0 h-[40px] border-r-2 border-dashed border-purple-400 opacity-0 transition-opacity pointer-events-none" />
      <div ref={rightLimitBottomRef} className="absolute top-full right-0 w-0 h-[40px] border-r-2 border-dashed border-purple-400 opacity-0 transition-opacity pointer-events-none" />
      
      {/* Bottom Limit Extensions */}
      <div ref={bottomLimitLeftRef} className="absolute right-full bottom-0 h-0 w-[40px] border-b-2 border-dashed border-purple-400 opacity-0 transition-opacity pointer-events-none" />
      <div ref={bottomLimitRightRef} className="absolute left-full bottom-0 h-0 w-[40px] border-b-2 border-dashed border-purple-400 opacity-0 transition-opacity pointer-events-none" />
    </div>
  );
};

export const ForContainerNode = ({ id, data, selected, dragging }) => {
  const isGray = data.colorMode === false;
  const borderColor = (selected || data.isRuntimeActive) ? 'border-indigo-500' : (isGray ? 'border-gray-400 dark:border-gray-600' : 'border-indigo-400 dark:border-indigo-600');
  const bgColor = isGray ? 'bg-gray-50/50 dark:bg-gray-900/50' : 'bg-indigo-50/30 dark:bg-indigo-900/10';
  
  const {
      containerRef,
      rightLimitTopRef,
      rightLimitBottomRef,
      bottomLimitLeftRef,
      bottomLimitRightRef,
      handleSelectAll
  } = useContainerBounds(id, { ...data, isForContainer: true }, dragging, 350, 200);

  const updateField = (field, value) => {
      if (data.onUpdateData) {
          data.onUpdateData({ [field]: value });
      } else {
          setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n));
      }
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full rounded-lg border-2 border-dashed ${borderColor} ${bgColor} flex flex-col overflow-visible ${selected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-indigo-50/50' : ''}`}>
      <div className={`custom-drag-handle absolute -top-4 left-4 px-2 py-1 bg-white dark:bg-gray-800 text-xs font-bold rounded shadow-sm border ${borderColor} flex items-center gap-2 pointer-events-auto cursor-grab active:cursor-grabbing`}>
        <RefreshCcw size={12} className="text-indigo-500" />
        <span className="text-indigo-700 dark:text-indigo-300">FOR</span>
        
        <input 
            type="text" 
            value={data.forInit || 'i = 0'} 
            onChange={(e) => updateField('forInit', e.target.value)}
            onMouseDown={e => e.stopPropagation()}
            className="outline-none bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 px-1 py-0.5 rounded text-[10px] font-mono w-16 border border-transparent focus:border-indigo-300 cursor-text"
            placeholder="Init"
            title="Výchozí hodnota (např. i = 0)"
        />
        <span className="text-[10px] text-gray-500">TO</span>
        <input 
            type="text" 
            value={data.forLimit || '10'} 
            onChange={(e) => updateField('forLimit', e.target.value)}
            onMouseDown={e => e.stopPropagation()}
            className="outline-none bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 px-1 py-0.5 rounded text-[10px] font-mono w-12 border border-transparent focus:border-indigo-300 cursor-text text-center"
            placeholder="Limit"
            title="Podmínka konce (např. 10)"
        />
        <span className="text-[10px] text-gray-500">STEP</span>
        <input 
            type="text" 
            value={data.forStep || '1'} 
            onChange={(e) => updateField('forStep', e.target.value)}
            onMouseDown={e => e.stopPropagation()}
            className="outline-none bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 px-1 py-0.5 rounded text-[10px] font-mono w-10 border border-transparent focus:border-indigo-300 cursor-text text-center"
            placeholder="Step"
            title="Iterace / Krok (např. 1)"
        />
      </div>

      <button 
        onPointerDown={handleSelectAll}
        className={`absolute -top-3 -right-3 w-6 h-6 bg-white dark:bg-gray-800 rounded-full shadow-sm border ${borderColor} flex items-center justify-center pointer-events-auto hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors z-10 cursor-grab active:cursor-grabbing`}
        title="Vybrat vše v cyklu a přesunout"
      >
        <MousePointer2 size={12} className="text-indigo-500" />
      </button>

      <div ref={rightLimitTopRef} className="absolute bottom-full right-0 w-0 h-[40px] border-r-2 border-dashed border-indigo-400 opacity-0 transition-opacity pointer-events-none" />
      <div ref={rightLimitBottomRef} className="absolute top-full right-0 w-0 h-[40px] border-r-2 border-dashed border-indigo-400 opacity-0 transition-opacity pointer-events-none" />
      
      <div ref={bottomLimitLeftRef} className="absolute right-full bottom-0 h-0 w-[40px] border-b-2 border-dashed border-indigo-400 opacity-0 transition-opacity pointer-events-none" />
      <div ref={bottomLimitRightRef} className="absolute left-full bottom-0 h-0 w-[40px] border-b-2 border-dashed border-indigo-400 opacity-0 transition-opacity pointer-events-none" />
    </div>
  );
};