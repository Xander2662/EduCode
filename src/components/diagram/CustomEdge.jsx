import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, useNodes, useEdges, Position, MarkerType } from '@xyflow/react';
import { RefreshCcw, ChevronRight } from 'lucide-react';
import { edgeLabels } from './constants';

export const CustomEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data, selected }) => {
  const { setEdges } = useReactFlow();
  const nodes = useNodes();
  const edges = useEdges();
  const isCondition = nodes.find(n => n.id === source)?.type === 'CONDITION';
  const isTargetMerge = nodes.find(n => n.id === target)?.type === 'MERGE';

  const loopNodes = nodes.filter(n => n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER');
  
  const isInside = (nodeId, loop) => {
      const n = nodes.find(x => x.id === nodeId);
      if (!n) return false;
      const nX = n.position.x;
      const nY = n.position.y;
      const nW = n.measured?.width || n.width || 100;
      const nH = n.measured?.height || n.height || 50;
      const coreW = nW * 0.5, coreH = nH * 0.5;
      const coreX = nX + (nW - coreW) / 2, coreY = nY + (nH - coreH) / 2;
      
      const loopW = loop.measured?.width || loop.width || (loop.type === 'FOR_CONTAINER' ? 350 : 300);
      const loopH = loop.measured?.height || loop.height || (loop.type === 'FOR_CONTAINER' ? 200 : 150);
      
      return (coreX < loop.position.x + loopW && coreX + coreW > loop.position.x && coreY < loop.position.y + loopH && coreY + coreH > loop.position.y);
  };

  const [edgePath, labelX, labelY, segments] = (() => {
    const isBackEdge = sourceY > targetY;
    let computedSegments = [];
    
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
            const isLoop = n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER';
            if (!connectedNodes.has(n.id) && !isLoop) return;
            
            if (isLoop) {
                if (!isInside(source, n) && !isInside(target, n)) return;
            }
            
            if (n.position.y >= targetY - 30 && n.position.y <= sourceY + 30) {
                const nodeX = n.position.x;
                const defaultW = n.type === 'FOR_CONTAINER' ? 350 : (n.type === 'LOOP_CONTAINER' ? 300 : 150);
                const nodeMaxX = nodeX + (n.measured?.width || n.width || defaultW);
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
        
        let topY = targetY - 10;
        if (sourceY - topY < 15) {
            topY = sourceY - 15; 
        }
        
        let bottomY = Math.max(sourceY + 10, targetY + 10); 
        
        loopNodes.forEach(loop => {
            const loopH = loop.measured?.height || loop.height || 150;
            const lTop = loop.position.y;
            const lBottom = loop.position.y + loopH;
            const sInside = isInside(source, loop);
            const tInside = isInside(target, loop);
            
            if (sInside && !tInside) {
                bottomY = Math.max(bottomY, lBottom + 5);
            } else if (!sInside && tInside) {
                topY = Math.min(topY, lTop - 5);
            }
        });
        const r = 5;                 
        
        let path, finalLabelX;
        
        const isTargetMergeOrLoop = loopNodes.some(n => n.id === target) || nodes.some(n => n.id === target && n.type === 'MERGE');
        const shouldWrap = isTargetMergeOrLoop || (sourceY - targetY > 40);
        
        if (shouldWrap) {
            if (routeLeft) {
                const leftEdgeX = Math.min(minX - 40, sourceX - 40, targetX - 40);
                
                if (srcIsLeft) {
                    path = `M ${sourceX} ${sourceY} L ${leftEdgeX + r} ${sourceY} A ${r} ${r} 0 0 1 ${leftEdgeX} ${sourceY - r} L ${leftEdgeX} ${topY + r} A ${r} ${r} 0 0 1 ${leftEdgeX + r} ${topY} L ${targetX - r} ${topY} A ${r} ${r} 0 0 1 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
                    computedSegments = [
                        { x1: sourceX, y1: sourceY, x2: leftEdgeX, y2: sourceY },
                        { x1: leftEdgeX, y1: sourceY, x2: leftEdgeX, y2: topY },
                        { x1: leftEdgeX, y1: topY, x2: targetX, y2: topY },
                        { x1: targetX, y1: topY, x2: targetX, y2: targetY }
                    ];
                } else {
                    path = `M ${sourceX} ${sourceY} L ${sourceX} ${bottomY - r} A ${r} ${r} 0 0 1 ${sourceX - r} ${bottomY} L ${leftEdgeX + r} ${bottomY} A ${r} ${r} 0 0 1 ${leftEdgeX} ${bottomY - r} L ${leftEdgeX} ${topY + r} A ${r} ${r} 0 0 1 ${leftEdgeX + r} ${topY} L ${targetX - r} ${topY} A ${r} ${r} 0 0 1 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
                    computedSegments = [
                        { x1: sourceX, y1: sourceY, x2: sourceX, y2: bottomY },
                        { x1: sourceX, y1: bottomY, x2: leftEdgeX, y2: bottomY },
                        { x1: leftEdgeX, y1: bottomY, x2: leftEdgeX, y2: topY },
                        { x1: leftEdgeX, y1: topY, x2: targetX, y2: topY },
                        { x1: targetX, y1: topY, x2: targetX, y2: targetY }
                    ];
                }
                finalLabelX = leftEdgeX;
            } else {
                const rightEdgeX = Math.max(maxX + 40, sourceX + 40, targetX + 40);
                
                if (srcIsRight) {
                    path = `M ${sourceX} ${sourceY} L ${rightEdgeX - r} ${sourceY} A ${r} ${r} 0 0 0 ${rightEdgeX} ${sourceY - r} L ${rightEdgeX} ${topY + r} A ${r} ${r} 0 0 0 ${rightEdgeX - r} ${topY} L ${targetX + r} ${topY} A ${r} ${r} 0 0 0 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
                    computedSegments = [
                        { x1: sourceX, y1: sourceY, x2: rightEdgeX, y2: sourceY },
                        { x1: rightEdgeX, y1: sourceY, x2: rightEdgeX, y2: topY },
                        { x1: rightEdgeX, y1: topY, x2: targetX, y2: topY },
                        { x1: targetX, y1: topY, x2: targetX, y2: targetY }
                    ];
                } else {
                    path = `M ${sourceX} ${sourceY} L ${sourceX} ${bottomY - r} A ${r} ${r} 0 0 0 ${sourceX + r} ${bottomY} L ${rightEdgeX - r} ${bottomY} A ${r} ${r} 0 0 0 ${rightEdgeX} ${bottomY - r} L ${rightEdgeX} ${topY + r} A ${r} ${r} 0 0 0 ${rightEdgeX - r} ${topY} L ${targetX + r} ${topY} A ${r} ${r} 0 0 0 ${targetX} ${topY + r} L ${targetX} ${targetY}`;
                    computedSegments = [
                        { x1: sourceX, y1: sourceY, x2: sourceX, y2: bottomY },
                        { x1: sourceX, y1: bottomY, x2: rightEdgeX, y2: bottomY },
                        { x1: rightEdgeX, y1: bottomY, x2: rightEdgeX, y2: topY },
                        { x1: rightEdgeX, y1: topY, x2: targetX, y2: topY },
                        { x1: targetX, y1: topY, x2: targetX, y2: targetY }
                    ];
                }
                finalLabelX = rightEdgeX;
            }
        } else {
            // It's a non-loop edge where sourceY > targetY (back edge but not loop)
            // Route it neatly avoiding nodes by taking a simple snake route with border radius!
            let midX = (sourceX + targetX) / 2;
            if (Math.abs(targetX - sourceX) < 20) {
                midX = Math.max(maxX + 20, sourceX + 40); // Force it out to the right to create a C-shape
            }
            
            const sweep1 = midX > sourceX ? 0 : 1;
            const sweep2 = targetX > midX ? 1 : 0;
            const d1 = midX > sourceX ? r : -r;
            const d2 = targetX > midX ? r : -r;
            
            // If the horizontal distance is less than 2*r, we shouldn't curve
            if (Math.abs(midX - sourceX) < 2 * r || Math.abs(targetX - midX) < 2 * r) {
                path = `M ${sourceX} ${sourceY} L ${sourceX} ${sourceY + 15} L ${midX} ${sourceY + 15} L ${midX} ${targetY - 15} L ${targetX} ${targetY - 15} L ${targetX} ${targetY}`;
            } else {
                path = `M ${sourceX} ${sourceY} L ${sourceX} ${sourceY + 15 - r} A ${r} ${r} 0 0 ${sweep1} ${sourceX + d1} ${sourceY + 15} L ${midX - d1} ${sourceY + 15} A ${r} ${r} 0 0 ${sweep1} ${midX} ${sourceY + 15 - r} L ${midX} ${targetY - 15 + r} A ${r} ${r} 0 0 ${sweep2} ${midX + d2} ${targetY - 15} L ${targetX - d2} ${targetY - 15} A ${r} ${r} 0 0 ${sweep2} ${targetX} ${targetY - 15 + r} L ${targetX} ${targetY}`;
            }
            computedSegments = [
                { x1: sourceX, y1: sourceY, x2: sourceX, y2: sourceY + 15 },
                { x1: sourceX, y1: sourceY + 15, x2: midX, y2: sourceY + 15 },
                { x1: midX, y1: sourceY + 15, x2: midX, y2: targetY - 15 },
                { x1: midX, y1: targetY - 15, x2: targetX, y2: targetY - 15 },
                { x1: targetX, y1: targetY - 15, x2: targetX, y2: targetY }
            ];
            finalLabelX = midX;
        }

        
        return [path, finalLabelX, (bottomY + topY) / 2, computedSegments];
    } else {
        let path = "";
        let finalLabelX = 0;
        let finalLabelY = 0;
        
        let enteringLoop = null;
        loopNodes.forEach(loop => {
            if (!isInside(source, loop) && isInside(target, loop)) {
                enteringLoop = loop;
            }
        });
        
        if (sourcePosition === Position.Right) {
            let lX, lY;
            [path, lX, lY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 5 });
            finalLabelX = lX;
            finalLabelY = lY;
            
            const cX = sourceX + Math.max(20, (targetX - sourceX) / 2);
            computedSegments = [
                { x1: sourceX, y1: sourceY, x2: cX, y2: sourceY },
                { x1: cX, y1: sourceY, x2: cX, y2: targetY },
                { x1: cX, y1: targetY, x2: targetX, y2: targetY }
            ];
        } else if (targetY - sourceY < 30 && sourcePosition !== Position.Right) {
            // Target is slightly below source, but too close for getSmoothStepPath to route down properly.
            // Just use a dynamic offset that fits perfectly in the gap!
            const offset = (targetY - sourceY) / 2;
            const midY = sourceY + offset;
            
            const r = Math.min(5, offset);
            const sweep1 = targetX > sourceX ? 0 : 1;
            const sweep2 = targetX > sourceX ? 1 : 0;
            const dX = targetX > sourceX ? r : -r;
            
            if (Math.abs(targetX - sourceX) < 2 * r || r < 1) {
                path = `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
            } else {
                path = `M ${sourceX} ${sourceY} L ${sourceX} ${midY - r} A ${r} ${r} 0 0 ${sweep1} ${sourceX + dX} ${midY} L ${targetX - dX} ${midY} A ${r} ${r} 0 0 ${sweep2} ${targetX} ${midY + r} L ${targetX} ${targetY}`;
            }
            
            computedSegments = [
                { x1: sourceX, y1: sourceY, x2: sourceX, y2: midY },
                { x1: sourceX, y1: midY, x2: targetX, y2: midY },
                { x1: targetX, y1: midY, x2: targetX, y2: targetY }
            ];
            finalLabelX = (sourceX + targetX) / 2;
            finalLabelY = midY;
        } else if (enteringLoop && sourceY + 10 < enteringLoop.position.y + 30) {
            const loopW = enteringLoop.measured?.width || enteringLoop.width || 300;
            const lTop = enteringLoop.position.y;
            const lLeft = enteringLoop.position.x;
            const lRight = enteringLoop.position.x + loopW;
            
            const routeLeft = sourceX < (lLeft + loopW / 2);
            const sideX = routeLeft ? Math.min(lLeft - 40, sourceX) : Math.max(lRight + 40, sourceX);
            
            let inY = targetY - 30; 
            if (inY < lTop + 40) inY = lTop + 40; 
            if (inY > targetY - 10) inY = targetY - 10; 
            
            let r2 = 5;
            const effSideX = Math.abs(sideX - sourceX) < 1 ? sourceX : sideX;
            if (Math.abs(targetX - effSideX) < 10) r2 = Math.abs(targetX - effSideX) / 2;
            
            const d2 = targetX > effSideX ? 1 : -1;
            
            if (Math.abs(sideX - sourceX) < 1) {
                path = `M ${sourceX} ${sourceY} ` +
                       `L ${sourceX} ${inY - r2} ` +
                       `A ${r2} ${r2} 0 0 ${d2 === 1 ? 0 : 1} ${sourceX + r2*d2} ${inY} ` +
                       `L ${targetX - r2*d2} ${inY} ` +
                       `A ${r2} ${r2} 0 0 ${d2 === 1 ? 1 : 0} ${targetX} ${inY + r2} ` +
                       `L ${targetX} ${targetY}`;
                       
                finalLabelX = sourceX;
                finalLabelY = (sourceY + inY) / 2;
                
                computedSegments = [
                    { x1: sourceX, y1: sourceY, x2: sourceX, y2: inY },
                    { x1: sourceX, y1: inY, x2: targetX, y2: inY },
                    { x1: targetX, y1: inY, x2: targetX, y2: targetY }
                ];
            } else {
                let topY = lTop - 40;
                if (topY < sourceY + 10) topY = sourceY + 10;
                
                let r1 = 5;
                if (Math.abs(sideX - sourceX) < 10) r1 = Math.abs(sideX - sourceX) / 2;
                if (Math.abs(inY - topY) < 10) {
                    const limit = Math.abs(inY - topY) / 2;
                    r1 = Math.min(r1, limit);
                    r2 = Math.min(r2, limit);
                }
                
                const d1 = sideX > sourceX ? 1 : -1;
                
                path = `M ${sourceX} ${sourceY} ` +
                       `L ${sourceX} ${topY - r1} ` +
                       `A ${r1} ${r1} 0 0 ${d1 === 1 ? 0 : 1} ${sourceX + r1*d1} ${topY} ` +
                       `L ${sideX - r1*d1} ${topY} ` +
                       `A ${r1} ${r1} 0 0 ${d1 === 1 ? 1 : 0} ${sideX} ${topY + r1} ` +
                       `L ${sideX} ${inY - r2} ` +
                       `A ${r2} ${r2} 0 0 ${d2 === 1 ? 0 : 1} ${sideX + r2*d2} ${inY} ` +
                       `L ${targetX - r2*d2} ${inY} ` +
                       `A ${r2} ${r2} 0 0 ${d2 === 1 ? 1 : 0} ${targetX} ${inY + r2} ` +
                       `L ${targetX} ${targetY}`;
                       
                finalLabelX = sideX;
                finalLabelY = (topY + inY) / 2;
                
                computedSegments = [
                    { x1: sourceX, y1: sourceY, x2: sourceX, y2: topY },
                    { x1: sourceX, y1: topY, x2: sideX, y2: topY },
                    { x1: sideX, y1: topY, x2: sideX, y2: inY },
                    { x1: sideX, y1: inY, x2: targetX, y2: inY },
                    { x1: targetX, y1: inY, x2: targetX, y2: targetY }
                ];
            }
        } else {
            if (sourcePosition === Position.Bottom && targetPosition === Position.Top && targetY >= sourceY - 1) {
                const midY = sourceY + (targetY - sourceY) / 2;
                if (Math.abs(targetX - sourceX) <= 1) {
                    path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
                    finalLabelX = sourceX;
                    finalLabelY = midY;
                } else {
                    const r = Math.min(5, Math.abs(targetX - sourceX) / 2, Math.max(0.1, (targetY - sourceY) / 2 - 0.1));
                    const dir = targetX > sourceX ? 1 : -1;
                    path = `M ${sourceX} ${sourceY} L ${sourceX} ${midY - r} Q ${sourceX} ${midY} ${sourceX + r * dir} ${midY} L ${targetX - r * dir} ${midY} Q ${targetX} ${midY} ${targetX} ${midY + r} L ${targetX} ${targetY}`;
                    finalLabelX = sourceX + (targetX - sourceX) / 2;
                    finalLabelY = midY;
                }
                computedSegments = [
                    { x1: sourceX, y1: sourceY, x2: sourceX, y2: midY },
                    { x1: sourceX, y1: midY, x2: targetX, y2: midY },
                    { x1: targetX, y1: midY, x2: targetX, y2: targetY }
                ];
            } else {
                const [nativePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 5 });
                path = nativePath;
                finalLabelX = labelX;
                finalLabelY = labelY;
                
                const cX = sourceX + (targetX - sourceX) / 2;
                const cY = sourceY + (targetY - sourceY) / 2;
                
                if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
                    computedSegments = [
                        { x1: sourceX, y1: sourceY, x2: cX, y2: sourceY },
                        { x1: cX, y1: sourceY, x2: cX, y2: targetY },
                        { x1: cX, y1: targetY, x2: targetX, y2: targetY }
                    ];
                } else {
                    computedSegments = [
                        { x1: sourceX, y1: sourceY, x2: sourceX, y2: cY },
                        { x1: sourceX, y1: cY, x2: targetX, y2: cY },
                        { x1: targetX, y1: cY, x2: targetX, y2: targetY }
                    ];
                }
            }
        }
        
        return [path, finalLabelX, finalLabelY, computedSegments];
    }
  })();

  const catchers = [];
  loopNodes.forEach(loop => {
      const loopX = loop.position.x;
      const loopY = loop.position.y;
      const loopW = loop.measured?.width || loop.width || (loop.type === 'FOR_CONTAINER' ? 350 : 300);
      const loopH = loop.measured?.height || loop.height || (loop.type === 'FOR_CONTAINER' ? 200 : 150);
      
      const sInside = isInside(source, loop);
      const tInside = isInside(target, loop);
      
      if (sInside !== tInside) {
          let intersectX = null;
          let intersectY = null;
          let angle = 0;
          
          for (let seg of segments) {
              if (Math.abs(seg.x1 - seg.x2) < 2) {
                  const x = seg.x1;
                  const yMin = Math.min(seg.y1, seg.y2);
                  const yMax = Math.max(seg.y1, seg.y2);
                  
                  if (yMin <= loopY && loopY <= yMax && x >= loopX && x <= loopX + loopW) {
                      intersectX = x; intersectY = loopY; 
                      angle = seg.y1 < seg.y2 ? 90 : 270;
                      break;
                  }
                  if (yMin <= loopY + loopH && loopY + loopH <= yMax && x >= loopX && x <= loopX + loopW) {
                      intersectX = x; intersectY = loopY + loopH; 
                      angle = seg.y1 < seg.y2 ? 90 : 270;
                      break;
                  }
              } else {
                  const y = seg.y1;
                  const xMin = Math.min(seg.x1, seg.x2);
                  const xMax = Math.max(seg.x1, seg.x2);
                  
                  if (xMin <= loopX && loopX <= xMax && y >= loopY && y <= loopY + loopH) {
                      intersectX = loopX; intersectY = y;
                      angle = seg.x1 < seg.x2 ? 0 : 180;
                      break;
                  }
                  if (xMin <= loopX + loopW && loopX + loopW <= xMax && y >= loopY && y <= loopY + loopH) {
                      intersectX = loopX + loopW; intersectY = y;
                      angle = seg.x1 < seg.x2 ? 0 : 180;
                      break;
                  }
              }
          }
          
          if (intersectX !== null) {
              const isFor = loop.type === 'FOR_CONTAINER';
              catchers.push(
                  <foreignObject key={loop.id} x={intersectX - 8} y={intersectY - 8} width="16" height="16" transform={`rotate(${angle}, ${intersectX}, ${intersectY})`}>
                      <div className={`w-4 h-4 rounded-full border ${isFor ? 'border-indigo-300 dark:border-indigo-600' : 'border-purple-300 dark:border-purple-600'} bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm pointer-events-auto`}>
                          <ChevronRight size={10} className={isFor ? 'text-indigo-500' : 'text-purple-500'} style={{ marginLeft: '1px' }} />
                      </div>
                  </foreignObject>
              );
          }
      }
  });

  const catcher = catchers.length > 0 ? catchers : null;

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
          >
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm flex items-center gap-1 cursor-pointer transition-transform hover:scale-110 ${bgClass} ${colorClass}`}>
              {showRefresh && <RefreshCcw size={10} className="text-orange-500" />}
              {labelText}
              {!data?.readOnly && isCondition && (
                  <div onClick={onSwap} className="cursor-pointer hover:text-indigo-600">
                    <RefreshCcw size={10} />
                  </div>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};