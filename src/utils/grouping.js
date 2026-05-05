export const calculateGroupNodes = (nodes, edges, groupColoring) => {
    if (!groupColoring) return [];
    
    const groupDefs = [];
    let gId = 0;
    const visited = new Set();
    
    // 1. Seskupení navazujících Akcí a Vstupů (IO)
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

    // 2. Seskupení těl Cyklů (Vyhledávání cyklů pomocí DFS v orientovaném grafu)
    edges.forEach(e => {
        const tgt = nodes.find(n => n.id === e.target);
        if (tgt && tgt.type === 'CONDITION') {
            
            // Ověříme, zda vede cesta z Cíle zpět do Zdroje (zda tvoří cyklus)
            let isBackEdge = false;
            let visitedDFS = new Set();
            let stack = [tgt.id];
            
            while(stack.length > 0) {
                let curr = stack.pop();
                if (curr === e.source) { isBackEdge = true; break; }
                if (!visitedDFS.has(curr)) {
                    visitedDFS.add(curr);
                    edges.filter(x => x.source === curr).forEach(x => stack.push(x.target));
                }
            }

            if (isBackEdge) {
                // BFS pozpátku pro sesbírání všech uzlů uvnitř cyklu
                const lGrp = new Set([tgt.id, e.source]);
                const queue = [e.source];
                
                while(queue.length > 0) {
                    const curr = queue.shift();
                    edges.forEach(edge => {
                        if (edge.target === curr) {
                            const prevNode = edge.source;
                            // tgt.id už v Setu je, takže hledání se přirozeně ZASTAVÍ na Podmínce
                            if (!lGrp.has(prevNode)) {
                                lGrp.add(prevNode);
                                queue.push(prevNode); 
                            }
                        }
                    });
                }

                const src = nodes.find(n => n.id === e.source);
                const srcW = src?.measured?.width || 100;
                const tgtW = tgt.measured?.width || 140;
                const srcCenterX = (src?.position.x || 0) + srcW / 2;
                const tgtCenterX = tgt.position.x + tgtW / 2;
                const routeLeft = srcCenterX < tgtCenterX;

                groupDefs.push({ id: `bg-loop-${gId++}`, type: 'LOOP', nodes: Array.from(lGrp), routeLeft });
            }
        }
    });

    // 3. Výpočet ohraničujících boxů (Bounding Box) pro vykreslení
    return groupDefs.map(g => {
         let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
         g.nodes.forEach(nid => {
             const n = nodes.find(x => x.id === nid);
             if (n) {
                 const w = n.measured?.width || (n.type === 'CONDITION' ? 140 : (n.type === 'IO' ? 120 : 100));
                 const h = n.measured?.height || (n.type === 'CONDITION' ? 70 : 50);
                 minX = Math.min(minX, n.position.x);
                 minY = Math.min(minY, n.position.y);
                 maxX = Math.max(maxX, n.position.x + w);
                 maxY = Math.max(maxY, n.position.y + h);
             }
         });
         
         if (minX === Infinity) return null;
         
         let padTop = 25, padBottom = 25, padLeft = 25, padRight = 25;
         
         if (g.type === 'LOOP') {
             padTop = 40;
             padBottom = 40;
             if (g.routeLeft) {
                 padLeft = 70; 
                 padRight = 40;
             } else {
                 padLeft = 40;
                 padRight = 70; 
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
             zIndex: g.type === 'LOOP' ? -2 : -1,
             selectable: false,
             draggable: false,
             focusable: false,
             deletable: false,
         };
    }).filter(Boolean);
};  