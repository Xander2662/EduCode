import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, useNodes, Position, MarkerType } from '@xyflow/react';
import { RefreshCcw } from 'lucide-react';
import { edgeLabels } from './constants';

export const CustomEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data, selected }) => {
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
            const srcIsLeft = (data?.sourceHandle === 's-left' || sourcePosition === Position.Left || sourcePosition === 'left');
            
            if (srcIsLeft) {
                path = `M ${sourceX} ${sourceY} L ${leftEdgeX + r} ${sourceY} A ${r} ${r} 0 0 1 ${leftEdgeX} ${sourceY - r} L ${leftEdgeX} ${topY + r} A ${r} ${r} 0 0 1 ${leftEdgeX + r} ${topY} L ${targetX - r} ${topY} A ${r} ${r} 0 0 1 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
            } else {
                path = `M ${sourceX} ${sourceY} L ${sourceX} ${bottomY - r} A ${r} ${r} 0 0 1 ${sourceX - r} ${bottomY} L ${leftEdgeX + r} ${bottomY} A ${r} ${r} 0 0 1 ${leftEdgeX} ${bottomY - r} L ${leftEdgeX} ${topY + r} A ${r} ${r} 0 0 1 ${leftEdgeX + r} ${topY} L ${targetX - r} ${topY} A ${r} ${r} 0 0 1 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
            }
            finalLabelX = leftEdgeX;
        } else {
            const rightEdgeX = maxX + 40; 
            const srcIsRight = (data?.sourceHandle === 's-right' || sourcePosition === Position.Right || sourcePosition === 'right');
            
            if (srcIsRight) {
                path = `M ${sourceX} ${sourceY} L ${rightEdgeX - r} ${sourceY} A ${r} ${r} 0 0 0 ${rightEdgeX} ${sourceY - r} L ${rightEdgeX} ${topY + r} A ${r} ${r} 0 0 0 ${rightEdgeX - r} ${topY} L ${targetX + r} ${topY} A ${r} ${r} 0 0 0 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
            } else {
                path = `M ${sourceX} ${sourceY} L ${sourceX} ${bottomY - r} A ${r} ${r} 0 0 0 ${sourceX + r} ${bottomY} L ${rightEdgeX - r} ${bottomY} A ${r} ${r} 0 0 0 ${rightEdgeX} ${bottomY - r} L ${rightEdgeX} ${topY + r} A ${r} ${r} 0 0 0 ${rightEdgeX - r} ${topY} L ${targetX + r} ${topY} A ${r} ${r} 0 0 0 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
            }
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
      const toggleLabel = (l) => (l === pref.t || l === 'Ano' || l === '+' || l === 'Yes' || l === 'True') ? pref.f : pref.t;
      
      if (!sibling) return eds;
      return eds.map(edge => {
        if (edge.id === id) return { ...edge, data: { ...edge.data, label: toggleLabel(edge.data.label) } };
        if (edge.id === sibling.id) return { ...edge, data: { ...edge.data, label: toggleLabel(sibling.data.label) } };
        return edge;
      });
    });
  };

  const labelText = data?.label || '';
  const pref = edgeLabels[data.edgeStyle || 'true-false'];
  const isPositive = labelText === pref.t || labelText === 'Ano' || labelText === '+' || labelText === 'Yes' || labelText === 'True';

  return (
    <>
      <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={30} className="react-flow__edge-interaction cursor-crosshair" />
      <BaseEdge path={edgePath} markerEnd={isTargetMerge ? undefined : markerEnd} className={`react-flow__edge-path custom-edge-${id} ${selected ? "!stroke-indigo-500" : "!stroke-gray-800 dark:!stroke-gray-400"}`} style={{ strokeWidth: selected ? 3 : 2 }} />
      {isCondition && labelText && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
               className={`group bg-white dark:bg-gray-800 border ${selected ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' : 'border-gray-300 dark:border-gray-600'} rounded px-2 py-1 text-xs font-bold shadow-sm flex items-center gap-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700`}>
            <span className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{labelText}</span>
            {!data?.readOnly && (
              <button onClick={onSwap} className="hidden group-hover:block text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
                  <RefreshCcw size={12} />
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};