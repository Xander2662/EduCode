import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, useNodes, useEdges, Position, MarkerType } from '@xyflow/react';
import { RefreshCcw } from 'lucide-react';
import { edgeLabels } from './constants';

export const CustomEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data, selected }) => {
  const { setEdges } = useReactFlow();
  const nodes = useNodes();
  const edges = useEdges();
  const isCondition = nodes.find(n => n.id === source)?.type === 'CONDITION';
  const isTargetMerge = nodes.find(n => n.id === target)?.type === 'MERGE';
  
  const [edgePath, labelX, labelY, catcher] = (() => {
    const isBackEdge = sourceY > targetY + 25;
    
    if (isBackEdge) {
        let maxX = Math.max(sourceX, targetX);
        let minX = Math.min(sourceX, targetX);
        
        const adj = {};
        edges.forEach(e => {
            if (!adj[e.source]) adj[e.source] = [];
            if (!adj[e.target]) adj[e.target] = [];
            adj[e.source].push(e.target);
            adj[e.target].push(e.source);
        });
        
        const connectedNodes = new Set();
        const queue = [source];
        connectedNodes.add(source);
        
        while (queue.length > 0) {
            const curr = queue.shift();
            if (adj[curr]) {
                adj[curr].forEach(neighbor => {
                    if (!connectedNodes.has(neighbor)) {
                        connectedNodes.add(neighbor);
                        queue.push(neighbor);
                    }
                });
            }
        }
        
        nodes.forEach(n => {
            if (!connectedNodes.has(n.id)) return;
            if (n.position.y >= targetY - 30 && n.position.y <= sourceY + 30) {
                const nodeX = n.position.x;
                const nodeMaxX = nodeX + (n.measured?.width || n.width || 150);
                if (nodeMaxX > maxX) maxX = nodeMaxX;
                if (nodeX < minX) minX = nodeX;
            }
        });
        
        const srcIsLeft = (data?.sourceHandle === 's-left' || sourcePosition === Position.Left || sourcePosition === 'left');
        const srcIsRight = (data?.sourceHandle === 's-right' || sourcePosition === Position.Right || sourcePosition === 'right');
        
        let routeLeft;
        if (srcIsLeft) {
            routeLeft = true;
        } else if (srcIsRight) {
            routeLeft = false;
        } else {
            const loopNode = nodes.find(n => n.id === target);
            const loopCenterX = loopNode ? loopNode.position.x + (loopNode.measured?.width || loopNode.width || 120) / 2 : targetX;
            routeLeft = sourceX < loopCenterX;
        }
        
        let topY = targetY - 30;
        if (sourceY - topY < 25) {
            topY = sourceY - 25; 
        }
        
        const bottomY = Math.max(sourceY + 30, targetY + 30); 
        const r = 10;                 
        
        let path, finalLabelX;
        
        if (routeLeft) {
            const leftEdgeX = Math.min(minX - 80, sourceX - 80, targetX - 80);
            
            if (srcIsLeft) {
                path = `M ${sourceX} ${sourceY} L ${leftEdgeX + r} ${sourceY} A ${r} ${r} 0 0 1 ${leftEdgeX} ${sourceY - r} L ${leftEdgeX} ${topY + r} A ${r} ${r} 0 0 1 ${leftEdgeX + r} ${topY} L ${targetX - r} ${topY} A ${r} ${r} 0 0 1 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
            } else {
                path = `M ${sourceX} ${sourceY} L ${sourceX} ${bottomY - r} A ${r} ${r} 0 0 1 ${sourceX - r} ${bottomY} L ${leftEdgeX + r} ${bottomY} A ${r} ${r} 0 0 1 ${leftEdgeX} ${bottomY - r} L ${leftEdgeX} ${topY + r} A ${r} ${r} 0 0 1 ${leftEdgeX + r} ${topY} L ${targetX - r} ${topY} A ${r} ${r} 0 0 1 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
            }
            finalLabelX = leftEdgeX;
        } else {
            const rightEdgeX = Math.max(maxX + 80, sourceX + 80, targetX + 80);
            
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
      
      if (!sibling) return eds.map(edge => edge.id === id ? { ...edge, data: { ...edge.data, label: toggleLabel(edge.data.label) } } : edge);
      
      return eds.map(edge => {
        if (edge.id === id) return { ...edge, data: { ...edge.data, label: toggleLabel(edge.data.label) } };
        if (edge.id === sibling.id) return { ...edge, data: { ...edge.data, label: toggleLabel(sibling.data.label) } };
        return edge;
      });
    });
  };

  const labelText = data?.label;
  const isPos = ['+', 'Ano', 'Yes', 'True'].includes(labelText);
  const isNeg = ['-', 'Ne', 'No', 'False'].includes(labelText);
  const colorClass = isPos ? 'text-emerald-600' : (isNeg ? 'text-rose-600' : 'text-gray-500 dark:text-gray-400');
  const bgClass = isPos ? 'bg-emerald-50 border-emerald-200' : (isNeg ? 'bg-rose-50 border-rose-200' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700');

  const showRefresh = data?.edgeStyle === 'while-do';

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={isTargetMerge ? undefined : markerEnd} style={{ ...style, strokeWidth: selected ? 3 : 2, stroke: selected ? '#6366f1' : (isCondition ? (isPos ? '#10b981' : '#f43f5e') : (style?.stroke || '#94a3b8')) }} />
      {catcher && <g className="pointer-events-none">{catcher}</g>}
      {labelText && (
        <EdgeLabelRenderer>
          <div
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm flex items-center gap-1 cursor-pointer transition-transform hover:scale-110 ${bgClass} ${colorClass}`}
          >
            {showRefresh && <RefreshCcw size={10} className="text-orange-500" />}
            {labelText}
            {!data?.readOnly && isCondition && (
                <div onClick={onSwap} className="cursor-pointer hover:text-indigo-600">
                  <RefreshCcw size={10} />
                </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};