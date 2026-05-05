import React from 'react';
import { Handle, Position, useReactFlow, useEdges } from '@xyflow/react';
import { edgeLabels, getSelectClass, extHighlightClass } from './constants';

const DragHandle = () => <div className="custom-drag-handle w-8 h-1.5 cursor-grab bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors mx-auto mb-1" title="Chytit a přesunout" />;

const handleInputMouseDown = (e, selected) => {
  if (!selected && document.activeElement !== e.target) e.preventDefault();
};

const handleInputResize = (e) => {
  e.target.style.height = 'auto';
  e.target.style.height = e.target.scrollHeight + 'px';
  e.target.style.width = 'auto';
  e.target.style.width = Math.max(100, e.target.scrollWidth) + 'px';
};

export const GroupBgNode = ({ data }) => (
    <div style={{ backgroundColor: data.bgColor, borderColor: data.borderColor }} className="w-full h-full rounded-[2rem] border-[3px] border-dashed pointer-events-none" />
);

export const StartEndNode = ({ id, data, selected }) => {
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
  
  const highlightClass = data.externalHighlight ? extHighlightClass : getSelectClass(selected, borderClass, data.isRuntimeActive);

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
          <span className="w-full text-center text-sm font-mono font-bold text-gray-900 dark:text-gray-100 block mt-1">{data.label || `END${entityType}`}</span>
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
  const highlightClass = data.externalHighlight ? extHighlightClass : getSelectClass(selected, baseBorder, data.isRuntimeActive);

  return (
    <div className={`${bgClass} border-2 p-2 min-w-[100px] min-h-[50px] flex flex-col rounded-md relative transition-all ${highlightClass}`}>
      <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />
      <DragHandle />
      <textarea rows={1} defaultValue={data.label} onChange={data.onChange} onInput={handleInputResize} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-full flex-1 text-center outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden text-gray-900 dark:text-gray-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-2 !h-2 ${handleClass}`} />
    </div>
  );
};

export const IONode = ({ id, data, selected }) => {
  const isExt = data.externalHighlight;
  const isSel = selected;
  const isGray = data.colorMode === false;

  const fillClass = isGray ? 'fill-gray-50 dark:fill-gray-800' : 'fill-emerald-50 dark:fill-emerald-900/30';
  const defaultStroke = isGray ? 'text-gray-400 dark:text-gray-600' : 'text-emerald-400 dark:text-emerald-700';
  const handleClass = isGray ? '!bg-gray-400' : '!bg-emerald-600';
  
  // Zvláštní Highlight logiky pro Runtime
  let strokeClass = isExt ? 'text-emerald-500' : (isSel ? 'text-indigo-600 dark:text-indigo-500' : defaultStroke);
  let shadowClass = '';
  
  if (data.isRuntimeActive) {
      strokeClass = 'text-red-500 dark:text-red-500';
      shadowClass = 'drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] z-50';
  }

  return (
    <div className={`relative min-w-[120px] min-h-[50px] flex flex-col transition-all ${data.isRuntimeActive ? 'z-50' : ''}`}>
      <svg className={`absolute inset-0 w-full h-full pointer-events-none -z-10 ${strokeClass} ${shadowClass}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon points="15,2 98,2 85,98 2,98" className={fillClass} stroke="currentColor" strokeWidth={isSel || isExt || data.isRuntimeActive ? "4" : "2"} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />
      <div className="pt-2 z-10"><DragHandle /></div>
      <textarea rows={1} defaultValue={data.label} onChange={data.onChange} onInput={handleInputResize} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-full flex-1 text-center outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden px-6 z-10 text-gray-900 dark:text-gray-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-2 !h-2 ${handleClass}`} />
    </div>
  );
};

export const ConditionNode = ({ id, data, selected }) => {
  const edges = useEdges();
  const outEdges = edges.filter(e => e.source === id).length;
  const hasWarning = outEdges === 1;

  const isExt = data.externalHighlight;
  const isSel = selected;
  const isGray = data.colorMode === false;

  const fillClass = isGray ? 'fill-gray-50 dark:fill-gray-800' : (hasWarning ? 'fill-red-50 dark:fill-red-900/20' : 'fill-orange-50 dark:fill-orange-900/30');
  const defaultStroke = isGray ? 'text-gray-400 dark:text-gray-600' : 'text-orange-400 dark:text-orange-700';
  const handleClass = isGray ? '!bg-gray-400' : '!bg-orange-600';
  
  let strokeClass = isExt ? 'text-emerald-500' : (isSel ? 'text-indigo-600 dark:text-indigo-500' : defaultStroke);
  let shadowClass = '';
  
  if (data.isRuntimeActive) {
      strokeClass = 'text-red-500 dark:text-red-500';
      shadowClass = 'drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] z-50';
  }
  
  const pref = edgeLabels[data.edgeStyle || 'true-false'];
  const tChar = pref.t.charAt(0).toUpperCase();
  const fChar = pref.f.charAt(0).toUpperCase();

  const bottomEdge = edges.find(e => e.source === id && e.sourceHandle === 's-bottom');
  const rightEdge = edges.find(e => e.source === id && e.sourceHandle === 's-right');

  let isBottomTrue = true;
  if (bottomEdge && bottomEdge.data?.label) {
      isBottomTrue = (bottomEdge.data.label === pref.t || bottomEdge.data.label === 'Ano' || bottomEdge.data.label === '+' || bottomEdge.data.label === 'Yes' || bottomEdge.data.label === 'True');
  }

  let isRightTrue = false;
  if (rightEdge && rightEdge.data?.label) {
      isRightTrue = (rightEdge.data.label === pref.t || rightEdge.data.label === 'Ano' || rightEdge.data.label === '+' || rightEdge.data.label === 'Yes' || rightEdge.data.label === 'True');
  }

  const bottomChar = isBottomTrue ? tChar : fChar;
  const rightChar = isRightTrue ? tChar : fChar;
  
  const bottomBorderColor = isGray ? '!border-gray-500 !text-gray-600' : (isBottomTrue ? '!border-green-500 !text-green-600' : '!border-red-500 !text-red-600');
  const rightBorderColor = isGray ? '!border-gray-500 !text-gray-600' : (isRightTrue ? '!border-green-500 !text-green-600' : '!border-red-500 !text-red-600');

  return (
    <div className={`relative flex flex-col items-center justify-center min-w-[120px] min-h-[60px] transition-all ${data.isRuntimeActive ? 'z-50' : ''}`}>
      <svg className={`absolute inset-0 w-full h-full pointer-events-none -z-10 ${strokeClass} ${shadowClass}`} preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon points="15,2 85,2 98,50 85,98 15,98 2,50" className={fillClass} stroke="currentColor" strokeWidth={isSel || isExt || data.isRuntimeActive ? "4" : "2"} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <Handle type="target" position={Position.Top} id="t-top" className={`!w-2 !h-2 ${handleClass}`} />
      <div className="absolute top-1 z-10"><DragHandle /></div>
      <textarea rows={1} defaultValue={data.label} onChange={data.onChange} onInput={handleInputResize} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`min-w-[70px] max-w-[100px] text-center outline-none bg-transparent text-sm font-mono nodrag mt-2 z-10 resize-none overflow-hidden text-gray-900 dark:text-gray-100 px-1 ${hasWarning ? 'text-red-700 dark:text-red-400 font-bold' : ''} ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} />
      
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={`!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-white dark:!bg-gray-800 !border-2 ${bottomBorderColor} !text-[10px] !font-bold flex items-center justify-center !rounded-sm z-20 cursor-crosshair leading-none p-0`}>{bottomChar}</Handle>
      <Handle type="source" position={Position.Right} id="s-right" className={`!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-white dark:!bg-gray-800 !border-2 ${rightBorderColor} !text-[10px] !font-bold flex items-center justify-center !rounded-sm z-20 cursor-crosshair leading-none p-0`}>{rightChar}</Handle>
    </div>
  );
};

export const CommentNode = ({ id, data, selected }) => {
  const isGray = data.colorMode === false;
  const bgClass = isGray ? 'bg-gray-50 dark:bg-gray-800' : 'bg-yellow-50 dark:bg-yellow-900/30';
  const borderClass = isGray ? 'border-gray-400 dark:border-gray-600' : 'border-yellow-300 dark:border-yellow-700';
  const highlightClass = data.externalHighlight ? extHighlightClass : getSelectClass(selected, borderClass, data.isRuntimeActive);

  return (
    <div className={`${bgClass} border-2 p-2 min-w-[160px] flex flex-col rounded-md relative transition-all ${highlightClass}`}>
      <DragHandle />
      <textarea rows={1} defaultValue={data.label} onChange={data.onChange} onInput={handleInputResize} onMouseDown={(e) => handleInputMouseDown(e, selected)} readOnly={data.readOnly} className={`w-full flex-1 outline-none bg-transparent text-sm font-mono nodrag resize-none overflow-hidden text-gray-700 dark:text-yellow-100 ${selected && !data.readOnly ? 'pointer-events-auto' : 'pointer-events-none'}`} style={{ minHeight: '30px' }} />
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