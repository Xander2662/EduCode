import React, { useCallback, useEffect, useRef } from 'react';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { calculateStretchLimits } from '../../utils/stretchLimits';

export function useContainerBounds(id, data, dragging, minWidth = 350, minHeight = 200) {
    const { setNodes, getNodes } = useReactFlow();
    const store = useStoreApi();

    const wasDragging = useRef(false);

    // Auto-fit height na začátku nebo po puštění (když se blok přesunul)
    const triggerAutoFit = useCallback(() => {
        setNodes(nds => {
            const myNode = nds.find(n => n.id === id);
            if (!myNode || myNode.selected) return nds;
            
            let myX = myNode.position.x;
            let myY = myNode.position.y;
            if (myNode.parentId) {
                let parent = nds.find(n => n.id === myNode.parentId);
                if (parent) {
                    myX += parent.position.x;
                    myY += parent.position.y;
                }
            }
            
            // The absolute best way to ensure NO snap-back is to read the exact visual dimensions 
            // that checkBounds just finished mutating on the DOM during the drag.
            let targetWidth = minWidth;
            let targetHeight = minHeight;
            
            if (containerRef.current) {
                const domW = parseInt(containerRef.current.style.width);
                const domH = parseInt(containerRef.current.style.height);
                if (!isNaN(domW)) targetWidth = Math.max(minWidth, domW);
                if (!isNaN(domH)) targetHeight = Math.max(minHeight, domH);
            } else {
                // Fallback math if ref is missing for some reason
                const candidateNodes = nds.filter(n => {
                    if (n.id === id) return false;
                    if (n.type === 'GROUP_BG' || n.type === 'START_END') return false;
                    if (n.type === 'COMMENT' && !data.isCaseContainer) return false;
                    if (n.type === 'CASE_CONTAINER' && !data.isSwitchContainer) return false;
                    if (n.type === 'SWITCH_CONTAINER' && data.isCaseContainer) return false;
                    return true;
                });
                const ownedNodes = candidateNodes.filter(n => ownedNodeIds.current.has(n.id));
                if (ownedNodes.length > 0) {
                    let rMaxX = -Infinity, rMaxY = -Infinity;
                    ownedNodes.forEach(n => {
                        const nW = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') ? (n.style?.width ? parseInt(n.style.width) : (n.measured?.width || 300)) : (n.measured?.width || n.width || 100);
                        const nH = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') ? (n.style?.height ? parseInt(n.style.height) : (n.measured?.height || 200)) : (n.measured?.height || n.height || 50);
                        const x2 = n.position.x + nW;
                        const y2 = n.position.y + nH;
                        if (x2 > rMaxX) rMaxX = x2;
                        if (y2 > rMaxY) rMaxY = y2;
                    });
                    targetWidth = Math.max(minWidth, (rMaxX - myX) + 20);
                    targetHeight = Math.max(minHeight, (rMaxY - myY) + 50);
                }
            }

            const candidateNodes = nds.filter(n => {
                if (n.id === id) return false;
                if (n.type === 'GROUP_BG' || n.type === 'START_END') return false;
                if (n.type === 'COMMENT' && !data.isCaseContainer) return false;
                if (n.type === 'CASE_CONTAINER' && !data.isSwitchContainer) return false;
                if (n.type === 'SWITCH_CONTAINER' && data.isCaseContainer) return false;
                return true;
            });
            const ownedNodes = candidateNodes.filter(n => ownedNodeIds.current.has(n.id));
            if (ownedNodes.length > 0) {
                const { SSL_Width, SSL_Height } = calculateStretchLimits(ownedNodes, ownedNodes, myX, myY, minWidth, minHeight, targetWidth, targetHeight);
                targetWidth = Math.min(targetWidth, SSL_Width);
                targetHeight = Math.min(targetHeight, SSL_Height);
            }
            
            return nds.map(n => {
                if (n.id === id) {
                    const nextZIndex = data.isCaseContainer ? -9999 : -Math.round(targetWidth);
                    return { ...n, data: { ...n.data, isNew: false }, zIndex: nextZIndex, style: { ...n.style, height: targetHeight, width: targetWidth } };
                }
                return n;
            });
        });
    }, [id, setNodes, minWidth, minHeight, data.isCaseContainer]);

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

            let myY = myNode.position.y;
            let myX = myNode.position.x;
            if (myNode.parentId) {
                let parent = nds.find(n => n.id === myNode.parentId);
                if (parent) {
                    myX += parent.position.x;
                    myY += parent.position.y;
                }
            }
            let myHeight = myNode.style?.height ? parseInt(myNode.style.height) : minHeight;
            let myWidth = myNode.style?.width ? parseInt(myNode.style.width) : minWidth;
            
            // Use dynamically stretched DOM size for accurate hitboxes during drag
            if (containerRef.current) {
                const domW = parseInt(containerRef.current.style.width);
                const domH = parseInt(containerRef.current.style.height);
                if (!isNaN(domW)) myWidth = domW;
                if (!isNaN(domH)) myHeight = domH;
            }
            
            const candidateNodes = nds.filter(n => {
                if (n.id === id) return false;
                if (n.type === 'GROUP_BG' || n.type === 'START_END') return false;
                if (n.type === 'COMMENT' && !data.isCaseContainer) return false;
                if (n.type === 'CASE_CONTAINER' && !data.isSwitchContainer) return false; // Loop containers do not own case groups
                if (n.type === 'SWITCH_CONTAINER' && data.isCaseContainer) return false; // Case containers do not own switch groups
                return true;
            });
            
            let currentOwned = new Set(ownedNodeIds.current);
            let hasPendingIn = false;
            
            candidateNodes.forEach(n => {
                const nW = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') ? (n.style?.width ? parseInt(n.style.width) : (n.measured?.width || 300)) : (n.measured?.width || n.width || 100);
                const nH = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') ? (n.style?.height ? parseInt(n.style.height) : (n.measured?.height || 200)) : (n.measured?.height || n.height || 50);
                const coreW = nW * 0.5;
                const coreH = nH * 0.5;
                const coreX = n.position.x + (nW - coreW) / 2;
                const coreY = n.position.y + (nH - coreH) / 2;
                
                let tagBottomOffset = 15;
                if (containerRef.current) {
                    const tag = containerRef.current.querySelector('.custom-drag-handle');
                    if (tag) {
                        tagBottomOffset = tag.offsetTop + tag.offsetHeight;
                    }
                }
                
                const nX = n.position.x;
                const nY = n.position.y;
                const isContainer = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER');
                let isInside = false;
                const dragState = nodeDragStates.current.get(n.id);
                if (dragState?.poppedThisDrag) {
                    isInside = false;
                } else if (isContainer) {
                    // A container can only own another container if it is strictly placed inside it.
                    // By enforcing that the child's top-left (nX, nY) is STRICTLY greater than the parent's (myX, myY),
                    // we make it geometrically impossible for two containers to mutually own each other.
                    const strictX = nX > myX;
                    const strictY = nY > myY;
                    
                    if (n.dragging && currentOwned.has(n.id)) {
                        isInside = strictX && strictY && nX <= myX + myWidth + 20 && nY <= myY + myHeight + 20;
                    } else {
                        isInside = strictX && strictY && nX <= myX + myWidth - 10 && nY <= myY + myHeight - 10;
                    }
                } else {
                    const centerX = nX + nW / 2;
                    const centerY = nY + nH / 2;
                    if (n.dragging && currentOwned.has(n.id)) {
                        isInside = centerX <= myX + myWidth + 10 && centerX >= myX - 10 && centerY <= myY + myHeight + 10 && centerY >= myY + tagBottomOffset - 10;
                    } else {
                        isInside = centerX <= myX + myWidth && centerX >= myX && centerY <= myY + myHeight && centerY >= myY + tagBottomOffset;
                    }
                }

                // Single-owner container containment:
                // If candidate node `n` is already inside another child container `c` that is inside this container,
                // then `c` owns `n`. We must NOT claim `n` as our direct child.
                const isInsideOtherChildContainer = candidateNodes.some(c => {
                    if (c.id === n.id) return false;
                    const cIsContainer = (c.type === 'LOOP_CONTAINER' || c.type === 'FOR_CONTAINER' || c.type === 'SWITCH_CONTAINER' || c.type === 'CASE_CONTAINER');
                    if (!cIsContainer) return false;
                    
                    const cX = c.position.x;
                    const cY = c.position.y;
                    const cW = (c.style?.width ? parseInt(c.style.width) : (c.measured?.width || 300));
                    const cH = (c.style?.height ? parseInt(c.style.height) : (c.measured?.height || 200));
                    
                    // Is `c` inside `this` container?
                    if (cX <= myX || cY <= myY || cX >= myX + myWidth || cY >= myY + myHeight) return false;
                    
                    // Is `n` inside `c`?
                    if (isContainer) {
                        return nX > cX && nY > cY && nX <= cX + cW && nY <= cY + cH;
                    } else {
                        const checkX = nX + nW / 2;
                        const checkY = nY + nH / 2;
                        return checkX >= cX && checkX <= cX + cW && checkY >= cY && checkY <= cY + cH;
                    }
                });

                if (isInsideOtherChildContainer) {
                    isInside = false;
                }
                
                if (isInside) {
                    currentOwned.add(n.id);
                    if (n.dragging) {
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
                const nW = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') ? (n.style?.width ? parseInt(n.style.width) : (n.measured?.width || 300)) : (n.measured?.width || n.width || 100);
                const nH = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') ? (n.style?.height ? parseInt(n.style.height) : (n.measured?.height || 200)) : (n.measured?.height || n.height || 50);
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
                const paddingSides = 35;
                const paddingBottom = 35;
                
                let desiredWidth = (maxX - myX) + paddingSides;
                let desiredHeight = (maxY - myY) + paddingBottom;
                
                const { SSL_Width, SSL_Height, ASL_Width, ASL_Height } = calculateStretchLimits(ownedNodes, stationaryNodes, myX, myY, minWidth, minHeight, myWidth, myHeight);
                
                let popped = false;
                newWidth = Math.min(ASL_Width, Math.max(myWidth, desiredWidth));
                newHeight = Math.min(ASL_Height, Math.max(myHeight, desiredHeight));
                
                let stretchDistRight = 0;
                let stretchDistBottom = 0;
                
                const draggingNodes = ownedNodes.filter(n => n.dragging);
                let anyAtLimitRight = false;
                let anyAtLimitBottom = false;

                draggingNodes.forEach(draggingNode => {
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


                    const stretchDistLeft = myX - minXNode;
                    let tagBottomOffset = 15;
                    if (containerRef.current) {
                        const tag = containerRef.current.querySelector('.custom-drag-handle');
                        if (tag) tagBottomOffset = tag.offsetTop + tag.offsetHeight;
                    }
                    const stretchDistTop = (myY + tagBottomOffset) - minYNode;
                    
                    let dragState = nodeDragStates.current.get(draggingNode.id);
                    if (!dragState) {
                        dragState = { joinedThisDrag: !ownedNodeIds.current.has(draggingNode.id) };
                        nodeDragStates.current.set(draggingNode.id, dragState);
                    } else if (!ownedNodeIds.current.has(draggingNode.id)) {
                        dragState.joinedThisDrag = true;
                    }

                    const physicalRightEdge = maxXNode - myX;
                    const physicalBottomEdge = maxYNode - myY;
                    
                    const physicalStretchDistRight = physicalRightEdge - ASL_Width;
                    const physicalStretchDistBottom = physicalBottomEdge - ASL_Height;

                    const centerX = minXNode + nW / 2;
                    const centerY = minYNode + nH / 2;
                    const centerDistRight = (centerX - myX) - ASL_Width;
                    const centerDistBottom = (centerY - myY) - ASL_Height;
                    const centerDistLeft = myX - centerX;
                    const centerDistTop = (myY + tagBottomOffset) - centerY;

                    const POP_TOLERANCE_RIGHT = 10; // Center crosses boundary + 10px tolerance
                    const POP_TOLERANCE_BOTTOM = 10;
                    const POP_TOLERANCE_LEFT = 10;
                    const POP_TOLERANCE_TOP = 10;
                    const GLOW_DIST = 20; // Trigger visual glow 20px before physically hitting the border
                    
                    if (centerDistRight > POP_TOLERANCE_RIGHT || centerDistBottom > POP_TOLERANCE_BOTTOM || centerDistLeft > POP_TOLERANCE_LEFT || centerDistTop > POP_TOLERANCE_TOP) {
                        currentOwned.delete(draggingNode.id);
                        popped = true;
                        dragState.poppedThisDrag = true;
                    } else {
                        if (physicalStretchDistRight > -GLOW_DIST) anyAtLimitRight = true;
                        if (physicalStretchDistBottom > -GLOW_DIST) anyAtLimitBottom = true;
                    }
                });

                if (anyAtLimitRight && !popped) atStretchLimitRight = true;
                if (anyAtLimitBottom && !popped) atStretchLimitBottom = true;
                
                if (popped) {
                    // Recalculate based on remaining nodes
                    const remainingNodes = candidateNodes.filter(n => currentOwned.has(n.id));
                    if (remainingNodes.length === 0) {
                        newWidth = minWidth; newHeight = minHeight;
                    } else {
                        let rMaxX = -Infinity, rMaxY = -Infinity;
                        remainingNodes.forEach(n => {
                            const nW = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') ? (n.style?.width ? parseInt(n.style.width) : (n.measured?.width || 300)) : (n.measured?.width || n.width || 100);
                            const nH = (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') ? (n.style?.height ? parseInt(n.style.height) : (n.measured?.height || 200)) : (n.measured?.height || n.height || 50);
                            const x2 = n.position.x + nW;
                            const y2 = n.position.y + nH;
                            if (x2 > rMaxX) rMaxX = x2;
                            if (y2 > rMaxY) rMaxY = y2;
                        });
                        newWidth = Math.max(minWidth, (rMaxX - myX) + paddingSides);
                        newHeight = Math.max(minHeight, (rMaxY - myY) + paddingBottom);
                    }
                } else {
                    newWidth = Math.min(ASL_Width, Math.max(myWidth, desiredWidth));
                    newHeight = Math.min(ASL_Height, Math.max(myHeight, desiredHeight));
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
                
                const isFor = data.isForContainer;
                
                if (atStretchLimitRight || atStretchLimitBottom) {
                    containerRef.current.classList.add(isFor ? 'bg-indigo-100/50' : 'bg-purple-100/50', isFor ? 'dark:bg-indigo-800/30' : 'dark:bg-purple-800/30');
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
                    if (!data.isCaseContainer) {
                        rfNode.style.zIndex = -Math.round(newWidth);
                    } else {
                        rfNode.style.zIndex = -9999;
                    }
                    
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
            
            let myX = myNode.position.x;
            let myY = myNode.position.y;
            if (myNode.parentId) {
                let parent = nds.find(n => n.id === myNode.parentId);
                if (parent) {
                    myX += parent.position.x;
                    myY += parent.position.y;
                }
            }
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
