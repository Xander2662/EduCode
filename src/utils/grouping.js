export const getGroupDefs = (nodes, edges) => {
    if (!Array.isArray(nodes) || !Array.isArray(edges)) return [];
    const groupDefs = [];
    let gId = 0;
    const visited = new Set();
    
    nodes.forEach(n => {
        if ((n.type === 'ACTION' || n.type === 'IO') && !visited.has(n.id)) {
            const grp = [];
            const queue = [n.id];
            const type = n.type;

            while (queue.length > 0) {
                const curr = queue.shift();
                if (!visited.has(curr)) {
                    visited.add(curr);
                    grp.push(curr);
                    
                    edges.forEach(e => {
                        if (e.source === curr) {
                            const tgt = nodes.find(x => x.id === e.target);
                            if (tgt && tgt.type === type && !visited.has(tgt.id)) queue.push(tgt.id);
                        }
                        if (e.target === curr) {
                            const src = nodes.find(x => x.id === e.source);
                            if (src && src.type === type && !visited.has(src.id)) queue.push(src.id);
                        }
                    });
                }
            }
            if (grp.length > 1) {
                groupDefs.push({ id: `bg-grp-${gId++}`, type, nodes: grp });
            }
        }
    });

    edges.forEach(e => {
        const tgt = nodes.find(n => n.id === e.target);
        
        let conditionNode = null;
        if (tgt && tgt.type === 'CONDITION') conditionNode = tgt;
        else if (tgt && tgt.type === 'MERGE') {
            const edgeToCond = edges.find(ed => ed.source === tgt.id);
            const nextNode = edgeToCond ? nodes.find(n => n.id === edgeToCond.target) : null;
            if (nextNode && nextNode.type === 'CONDITION') conditionNode = nextNode;
        }

        if (conditionNode) {
            let isBackEdge = false;
            let current = nodes.find(n => n.id === e.source);
            
            if (current && conditionNode.position.y < current.position.y) {
                isBackEdge = true;
            }

            if (isBackEdge) {
                const lGrp = new Set();
                const q = [current.id];
                const v2 = new Set();
                
                while (q.length > 0) {
                    const c = q.shift();
                    if (!v2.has(c)) {
                        v2.add(c);
                        if (c === conditionNode.id) continue;
                        lGrp.add(c);
                        
                        edges.forEach(ed => {
                            if (ed.target === c) q.push(ed.source);
                        });
                    }
                }
                
                let routeLeft = true;
                const src = current;
                const srcW = src?.measured?.width || 120;
                const tgtW = conditionNode.measured?.width || 140;
                
                const entryEdge = edges.find(ed => ed.source === conditionNode.id && lGrp.has(ed.target));
                
                if (entryEdge && entryEdge.sourceHandle === 's-right') {
                    routeLeft = false;
                } else if (entryEdge && entryEdge.sourceHandle === 's-left') {
                    routeLeft = true;
                } else {
                    const edgeOutHandle = e.sourceHandle || 's-bottom';
                    if (edgeOutHandle === 's-right') {
                        routeLeft = false;
                    } else if (edgeOutHandle === 's-left') {
                        routeLeft = true;
                    } else {
                        const srcCenterX = (src?.position.x || 0) + srcW / 2;
                        const tgtCenterX = conditionNode.position.x + tgtW / 2;
                        routeLeft = srcCenterX < tgtCenterX;
                    }
                }

                // Include conditionNode (the block which starts the cycle) so the loop container covers the whole cycle
                lGrp.add(conditionNode.id);
                if (tgt && tgt.type === 'MERGE') {
                    lGrp.add(tgt.id);
                }

                groupDefs.push({ id: `bg-loop-${gId++}`, type: 'LOOP', nodes: Array.from(lGrp), routeLeft });
            }
        }
    });
    return groupDefs;
};

export const computeGroupBounds = (nodes, groupDefs) => {
    if (!Array.isArray(nodes) || !Array.isArray(groupDefs)) return [];
    return groupDefs.map(g => {
         let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
         g.nodes.forEach(nid => {
             const n = nodes.find(x => x.id === nid);
             if (n) {
                 const w = n.measured?.width || n.width || (n.type === 'CONDITION' ? 140 : (n.type === 'IO' ? 120 : 100));
                 const h = n.measured?.height || n.height || (n.type === 'CONDITION' ? 70 : 50);
                 minX = Math.min(minX, n.position.x);
                 minY = Math.min(minY, n.position.y);
                 maxX = Math.max(maxX, n.position.x + w);
                 maxY = Math.max(maxY, n.position.y + h);
             }
         });
         
         if (minX === Infinity) return null;
         
         let padTop = 35, padBottom = 35, padLeft = 35, padRight = 35;
         
         if (g.type === 'LOOP') {
             padTop = 45;     
             padBottom = 45;  
             if (g.routeLeft) {
                 padLeft = 85; 
                 padRight = 40;
             } else {
                 padLeft = 40;
                 padRight = 85; 
             }
         }

         let bgColor = '', borderColor = '';
         if (g.type === 'ACTION') { bgColor = 'rgba(96, 165, 250, 0.25)'; borderColor = 'rgba(59, 130, 246, 0.6)'; }
         if (g.type === 'IO') { bgColor = 'rgba(52, 211, 153, 0.25)'; borderColor = 'rgba(16, 185, 129, 0.6)'; }
         if (g.type === 'LOOP') { bgColor = 'rgba(251, 191, 36, 0.25)'; borderColor = 'rgba(245, 158, 11, 0.6)'; }

         const groupW = maxX - minX + padLeft + padRight;
         const groupH = maxY - minY + padTop + padBottom;

         return {
             id: g.id,
             type: 'GROUP_BG',
             position: { x: minX - padLeft, y: minY - padTop },
             width: groupW,  
             height: groupH, 
             data: { bgColor, borderColor, width: groupW, height: groupH },
             style: { width: groupW, height: groupH, pointerEvents: 'none', opacity: 1 },
             zIndex: g.type === 'LOOP' ? -16000 : -15000,
             selectable: false,
             draggable: false,
             focusable: false,
             deletable: false,
         };
    }).filter(Boolean);
};  