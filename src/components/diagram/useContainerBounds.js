import React, { useCallback, useEffect, useRef } from 'react';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { calculateStretchLimits } from '../../utils/stretchLimits';

export function useContainerBounds(id, data, dragging, minWidth = 300, minHeight = 150) {
    const { setNodes, getNodes } = useReactFlow();
    const store = useStoreApi();

    const wasDragging = useRef(false);

    // Auto-fit height na začátku nebo po puštění (když se blok přesunul)
    const triggerAutoFit = useCallback(() => {
        setNodes(nds => {
            const myNode = nds.find(n => n.id === id);
            if (!myNode || myNode.selected) return nds;
            
            const myX = myNode.position.x;
            const myY = myNode.position.y;
            const candidateNodes = nds.filter(n => n.id !== id && !['LOOP_CONTAINER', 'FOR_CONTAINER', 'GROUP_BG'].includes(n.type));
            
            const nodesBelow = candidateNodes.filter(n => 
                n.position.y >= myY && 
                n.position.x >= myX - 100 && 
                n.position.x <= myX + 400
            ).sort((a, b) => a.position.y - b.position.y);
            
            if (nodesBelow.length > 0) {
                const lastNode = nodesBelow[nodesBelow.length - 1];
                const h = lastNode.measured?.height || lastNode.height || (lastNode.type === 'CONDITION' ? 70 : 50);
                const newHeight = (lastNode.position.y + h - myY) + 50;
                
                return nds.map(n => {
                    if (n.id === id) {
                        const finalH = Math.max(minHeight, newHeight);
                        const finalW = Math.max(minWidth, n.style?.width ? parseInt(n.style.width) : minWidth);
                        return { ...n, data: { ...n.data, isNew: false }, zIndex: -Math.round(finalW), style: { ...n.style, height: finalH, width: finalW } };
                    }
                    return n;
                });
            }
            
            return nds.map(n => n.id === id ? { ...n, data: { ...n.data, isNew: false } } : n);
        });
    }, [id, setNodes, minWidth, minHeight]);

    useEffect(() => {
        if (data.isNew) {
            setTimeout(triggerAutoFit, 50);
        }
    }, [data.isNew, triggerAutoFit]);

    // Sticky chování - reset po přesunu
    useEffect(() => {
        if (dragging) {
            wasDragging.current = true;
        } else if (wasDragging.current) {
            wasDragging.current = false;
            triggerAutoFit();
        }
    }, [dragging, triggerAutoFit]);

    const containerRef = useRef(null);
    const rightLimitTopRef = useRef(null);
    const rightLimitBottomRef = useRef(null);
    const bottomLimitLeftRef = useRef(null);
    const bottomLimitRightRef = useRef(null);
    const ownedNodeIds = useRef(new Set());
    const nodeDragStates = useRef(new Map());
    const animateResizeUntil = useRef(0);

    // Fluent Dynamic Width, X and auto-Height adjustment (bez lagu)
    useEffect(() => {
        let animationFrameId;
        const checkBounds = () => {
            const nds = getNodes();
            const myNode = nds.find(n => n.id === id);
            if (!myNode || myNode.dragging) {
                animationFrameId = requestAnimationFrame(checkBounds);
                return;
            }

            const myY = myNode.position.y;
            const myX = myNode.position.x;
            const myHeight = myNode.style?.height ? parseInt(myNode.style.height) : minHeight;
            const myWidth = myNode.style?.width ? parseInt(myNode.style.width) : minWidth;
            
            const candidateNodes = nds.filter(n => n.id !== id && n.type !== 'GROUP_BG' && n.type !== 'COMMENT' && n.type !== 'START_END');
            
            let currentOwned = new Set(ownedNodeIds.current);
            let hasPendingIn = false;
            
            candidateNodes.forEach(n => {
                const nW = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') ? (n.style?.width ? parseInt(n.style.width) : (n.measured?.width || (n.type === 'FOR_CONTAINER' ? 350 : 300))) : (n.measured?.width || n.width || 100);
                const nH = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') ? (n.style?.height ? parseInt(n.style.height) : (n.measured?.height || (n.type === 'FOR_CONTAINER' ? 200 : 150))) : (n.measured?.height || n.height || 50);
                const coreW = nW * 0.5;
                const coreH = nH * 0.5;
                const coreX = n.position.x + (nW - coreW) / 2;
                const coreY = n.position.y + (nH - coreH) / 2;
                // Prevent infinite stretching cycles: A node can ONLY be inside me if its top-left corner 
                // is mathematically positioned at or after my top-left corner. This prevents a child container 
                // from accidentally claiming ownership of its own parent!
                const isInside = (n.position.x >= myX - 5) && (n.position.y >= myY - 5) && 
                                 (coreX < myX + myWidth && coreX + coreW > myX && coreY < myY + myHeight + 150 && coreY + coreH > myY - 50);
                
                if (isInside) {
                    currentOwned.add(n.id);
                    if (n.dragging && !n.selected) {
                        hasPendingIn = true;
                    }
                } else if (!n.dragging) {
                    currentOwned.delete(n.id);
                }
            });

            // Compute bounding box and condition counts
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let statMinX = Infinity, statMinY = Infinity, statMaxX = -Infinity, statMaxY = -Infinity;
            
            const ownedNodes = candidateNodes.filter(n => currentOwned.has(n.id));
            const stationaryNodes = [];
            
            ownedNodes.forEach(n => {
                const nW = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') ? (n.style?.width ? parseInt(n.style.width) : (n.measured?.width || (n.type === 'FOR_CONTAINER' ? 350 : 300))) : (n.measured?.width || n.width || 100);
                const nH = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') ? (n.style?.height ? parseInt(n.style.height) : (n.measured?.height || (n.type === 'FOR_CONTAINER' ? 200 : 150))) : (n.measured?.height || n.height || 50);
                const x1 = n.position.x;
                const y1 = n.position.y;
                const x2 = x1 + nW;
                const y2 = y1 + nH;
                
                if (x1 < minX) minX = x1;
                if (y1 < minY) minY = y1;
                if (x2 > maxX) maxX = x2;
                if (y2 > maxY) maxY = y2;
                
                if (!n.dragging) {
                    stationaryNodes.push(n);
                    if (x1 < statMinX) statMinX = x1;
                    if (y1 < statMinY) statMinY = y1;
                    if (x2 > statMaxX) statMaxX = x2;
                    if (y2 > statMaxY) statMaxY = y2;
                }
            });
            
            let newWidth = minWidth;
            let newHeight = minHeight;
            let atStretchLimitRight = false;
            let atStretchLimitBottom = false;
            
            if (ownedNodes.length > 0) {
                const paddingSides = 20;
                const paddingBottom = 50;
                
                let desiredWidth = (maxX - myX) + paddingSides;
                let desiredHeight = (maxY - myY) + paddingBottom;
                
                const { SSL_Width, SSL_Height, ASL_Width, ASL_Height } = calculateStretchLimits(ownedNodes, stationaryNodes, myX, myY, minWidth, minHeight);
                
                let popped = false;
                newWidth = desiredWidth;
                newHeight = desiredHeight;
                
                let stretchDistRight = 0;
                let stretchDistBottom = 0;
                
                if (desiredWidth > ASL_Width) {
                    newWidth = ASL_Width;
                    atStretchLimitRight = true;
                    stretchDistRight = desiredWidth - ASL_Width;
                }
                if (desiredHeight > ASL_Height) {
                    newHeight = ASL_Height;
                    atStretchLimitBottom = true;
                    stretchDistBottom = desiredHeight - ASL_Height;
                }
                
                const draggingNode = ownedNodes.find(n => n.dragging);
                if (draggingNode) {
                    const nW = draggingNode.measured?.width || 120;
                    const nH = draggingNode.measured?.height || 50;
                    const maxXNode = draggingNode.position.x + nW;
                    const maxYNode = draggingNode.position.y + nH;
                    const minXNode = draggingNode.position.x;
                    const minYNode = draggingNode.position.y;
                    
                    const reqW = maxXNode - myX + paddingSides;
                    const reqH = maxYNode - myY + paddingBottom;
                    
                    desiredWidth = Math.max(desiredWidth, reqW);
                    desiredHeight = Math.max(desiredHeight, reqH);

                    stretchDistRight = reqW - ASL_Width;
                    stretchDistBottom = reqH - ASL_Height;
                    const stretchDistLeft = myX - minXNode;
                    const stretchDistTop = myY - minYNode;
                    
                    let dragState = nodeDragStates.current.get(draggingNode.id);
                    if (!dragState) {
                        dragState = { joinedThisDrag: !ownedNodeIds.current.has(draggingNode.id) };
                        nodeDragStates.current.set(draggingNode.id, dragState);
                    } else if (!ownedNodeIds.current.has(draggingNode.id)) {
                        dragState.joinedThisDrag = true;
                    }

                    const POP_TOLERANCE_RIGHT = 70;
                    const POP_TOLERANCE_BOTTOM = 70;
                    const POP_TOLERANCE_LEFT = 0;
                    const POP_TOLERANCE_TOP = 0;
                    
                    if (stretchDistRight > POP_TOLERANCE_RIGHT || stretchDistBottom > POP_TOLERANCE_BOTTOM || stretchDistLeft > POP_TOLERANCE_LEFT || stretchDistTop > POP_TOLERANCE_TOP) {
                        currentOwned.delete(draggingNode.id);
                        popped = true;
                        atStretchLimitRight = false;
                        atStretchLimitBottom = false;
                    } else {
                        // The block will pop out if it exceeds the POP_TOLERANCE.
                        // But the visual border feedback should ALWAYS show if the CURRENTLY DRAGGED block is exceeding the absolute ASL limits,
                        // EVEN IF it was just inserted during this drag!
                        atStretchLimitRight = stretchDistRight > 0;
                        atStretchLimitBottom = stretchDistBottom > 0;
                    }
                } else {
                    atStretchLimitRight = false;
                    atStretchLimitBottom = false;
                }
                
                if (popped) {
                    // Recalculate based on remaining nodes
                    const remainingNodes = candidateNodes.filter(n => currentOwned.has(n.id));
                    if (remainingNodes.length === 0) {
                        newWidth = minWidth; newHeight = minHeight;
                    } else {
                        let rMaxX = -Infinity, rMaxY = -Infinity;
                        remainingNodes.forEach(n => {
                            const nW = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') ? (n.style?.width ? parseInt(n.style.width) : (n.measured?.width || (n.type === 'FOR_CONTAINER' ? 350 : 300))) : (n.measured?.width || n.width || 100);
                            const nH = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') ? (n.style?.height ? parseInt(n.style.height) : (n.measured?.height || (n.type === 'FOR_CONTAINER' ? 200 : 150))) : (n.measured?.height || n.height || 50);
                            const x2 = n.position.x + nW;
                            const y2 = n.position.y + nH;
                            if (x2 > rMaxX) rMaxX = x2;
                            if (y2 > rMaxY) rMaxY = y2;
                        });
                        newWidth = Math.max(minWidth, (rMaxX - myX) + paddingSides);
                        newHeight = Math.max(minHeight, (rMaxY - myY) + paddingBottom);
                    }
                } else {
                    newWidth = Math.min(desiredWidth, ASL_Width);
                    newHeight = Math.min(desiredHeight, ASL_Height);
                }
                
                if (newWidth < minWidth) newWidth = minWidth;
                if (newHeight < minHeight) newHeight = minHeight;
            }
            const previousOwnedCount = ownedNodeIds.current.size;
            ownedNodeIds.current = new Set([...currentOwned].filter(id => candidateNodes.some(n => n.id === id)));
            
            if (currentOwned.size > previousOwnedCount) {
                animateResizeUntil.current = Date.now() + 300;
            }

            const opacityVal = '0.7';
            if (rightLimitTopRef.current) rightLimitTopRef.current.style.opacity = atStretchLimitRight ? opacityVal : '0';
            if (rightLimitBottomRef.current) rightLimitBottomRef.current.style.opacity = atStretchLimitRight ? opacityVal : '0';
            if (bottomLimitLeftRef.current) bottomLimitLeftRef.current.style.opacity = atStretchLimitBottom ? opacityVal : '0';
            if (bottomLimitRightRef.current) bottomLimitRightRef.current.style.opacity = atStretchLimitBottom ? opacityVal : '0';

            if (containerRef.current) {
                // Highlight visual feedback
                containerRef.current.classList.remove(
                    'bg-purple-100', 'dark:bg-purple-900/30', 'ring-4', 'ring-purple-400', 
                    'bg-purple-100/50', 'dark:bg-purple-800/30', 
                    'border-b-4', 'border-b-purple-500', 'border-r-4', 'border-r-purple-500',
                    'border-l-4', 'border-l-purple-500', 'border-t-4', 'border-t-purple-500',
                    'bg-indigo-100', 'dark:bg-indigo-900/30', 'ring-indigo-400', 
                    'bg-indigo-100/50', 'dark:bg-indigo-800/30',
                    'border-b-indigo-500', 'border-r-indigo-500', 'border-l-indigo-500', 'border-t-indigo-500'
                );
                
                const highlightColorClass1 = n => n.type === 'FOR_CONTAINER' ? 'bg-indigo-100/50' : 'bg-purple-100/50';
                const highlightColorClass2 = n => n.type === 'FOR_CONTAINER' ? 'dark:bg-indigo-800/30' : 'dark:bg-purple-800/30';
                const highlightColorClass3 = n => n.type === 'FOR_CONTAINER' ? 'bg-indigo-100' : 'bg-purple-100';
                const highlightColorClass4 = n => n.type === 'FOR_CONTAINER' ? 'dark:bg-indigo-900/30' : 'dark:bg-purple-900/30';
                const ringColorClass = n => n.type === 'FOR_CONTAINER' ? 'ring-indigo-400' : 'ring-purple-400';

                const isFor = data.isForContainer; // I will add this flag from the component
                
                if (atStretchLimitRight || atStretchLimitBottom) {
                    containerRef.current.classList.add(isFor ? 'bg-indigo-100/50' : 'bg-purple-100/50', isFor ? 'dark:bg-indigo-800/30' : 'dark:bg-purple-800/30');
                } else if (hasPendingIn) {
                    containerRef.current.classList.add(isFor ? 'bg-indigo-100' : 'bg-purple-100', isFor ? 'dark:bg-indigo-900/30' : 'dark:bg-purple-900/30', 'ring-4', isFor ? 'ring-indigo-400' : 'ring-purple-400');
                }
            }
            
            const anyChildDragging = candidateNodes.some(n => n.dragging && currentOwned.has(n.id));
            
            // Reset drag states if nothing is currently being dragged, so blocks can trigger the border in future drags!
            if (!candidateNodes.some(n => n.dragging)) {
                nodeDragStates.current.clear();
            }
            
            if (containerRef.current) {
                const rfNode = containerRef.current.closest('.react-flow__node');
                if (rfNode) {
                    // Strictly enforce zIndex based on width so parents ALWAYS stay behind children, 
                    // even if React Flow attempts to bring a selected node to the front!
                    rfNode.style.zIndex = -Math.round(newWidth);
                    
                    if (!anyChildDragging || Date.now() < animateResizeUntil.current) {
                        rfNode.classList.add('animate-resize');
                    } else {
                        rfNode.classList.remove('animate-resize');
                    }
                }
            }

            if (Math.abs(newWidth - myWidth) > 1 || Math.abs(newHeight - myHeight) > 1) {
                if (containerRef.current) {
                    const rfNode = containerRef.current.closest('.react-flow__node');
                    if (rfNode) {
                        rfNode.style.width = newWidth + 'px';
                        rfNode.style.height = newHeight + 'px';
                    }
                }
                
                if (!myNode.style) myNode.style = {};
                myNode.style.width = newWidth;
                myNode.style.height = newHeight;
                
                if (!anyChildDragging) {
                    setNodes(oldNds => oldNds.map(n => n.id === id ? { ...n, style: { ...n.style, width: newWidth, height: newHeight } } : n));
                } else {
                    containerRef.current.dataset.needsCommit = 'true';
                }
            } else if (!anyChildDragging && containerRef.current?.dataset.needsCommit === 'true') {
                containerRef.current.dataset.needsCommit = 'false';
                setNodes(oldNds => oldNds.map(n => n.id === id ? { ...n, style: { ...n.style, width: newWidth, height: newHeight } } : n));
            }
            
            animationFrameId = requestAnimationFrame(checkBounds);
        };
        
        animationFrameId = requestAnimationFrame(checkBounds);
        return () => cancelAnimationFrame(animationFrameId);
    }, [id, store, setNodes, getNodes, minWidth, minHeight, data.isForContainer]);

    const handleSelectAll = useCallback((e) => {
        e.stopPropagation();
        setNodes(nds => {
            const myNode = nds.find(n => n.id === id);
            if (!myNode) return nds;
            
            const myX = myNode.position.x;
            const myY = myNode.position.y;
            const myW = myNode.style?.width ? parseInt(myNode.style.width) : minWidth;
            const myH = myNode.style?.height ? parseInt(myNode.style.height) : minHeight;
            
            return nds.map(n => {
                if (n.id === id) return { ...n, selected: true };
                if (['LOOP_CONTAINER', 'FOR_CONTAINER', 'GROUP_BG'].includes(n.type)) return n;
                
                const nX = n.position.x;
                const nY = n.position.y;
                const nW = n.measured?.width || n.width || 100;
                const nH = n.measured?.height || n.height || 50;
                
                const coreW = nW * 0.5;
                const coreH = nH * 0.5;
                const coreX = nX + (nW - coreW) / 2;
                const coreY = nY + (nH - coreH) / 2;
                
                if (coreX < myX + myW && coreX + coreW > myX && coreY < myY + myH && coreY + coreH > myY) {
                    return { ...n, selected: true };
                }
                return n;
            });
        });
    }, [id, setNodes, minWidth, minHeight]);

    return {
        containerRef,
        rightLimitTopRef,
        rightLimitBottomRef,
        bottomLimitLeftRef,
        bottomLimitRightRef,
        handleSelectAll
    };
}
