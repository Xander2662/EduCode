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

    // 2. Seskupení těl Cyklů (pouze větve, které se reálně vrací do podmínky)
    edges.forEach(e => {
        const src = nodes.find(n => n.id === e.source);
        const tgt = nodes.find(n => n.id === e.target);
        
        // Zjistíme, zda jde o zpětnou hranu (cyklus)
        if (src && tgt && tgt.position.y <= src.position.y && tgt.type === 'CONDITION') {
            // BFS pozpátku: najdeme VŠECHNY uzly, které vedou do tohoto návratu
            const lGrp = new Set([tgt.id, src.id]);
            const queue = [src.id];
            
            while(queue.length > 0) {
                const curr = queue.shift();
                edges.forEach(edge => {
                    // Hledáme hrany jdoucí DO aktuálního uzlu (jdeme proti proudu)
                    if (edge.target === curr) {
                        const prevNode = edge.source;
                        // Pokud uzel ještě nemáme a NENÍ to hlavní podmínka (zastávka)
                        if (!lGrp.has(prevNode)) {
                            lGrp.add(prevNode);
                            queue.push(prevNode); 
                        }
                    }
                });
            }

            // Výpočet pro asymetrický padding (Zda se šipka vrací zleva nebo zprava)
            const srcW = src.measured?.width || (src.type === 'CONDITION' ? 140 : (src.type === 'IO' ? 120 : 100));
            const tgtW = tgt.measured?.width || 140;
            const srcCenterX = src.position.x + srcW / 2;
            const tgtCenterX = tgt.position.x + tgtW / 2;
            const routeLeft = srcCenterX < tgtCenterX;

            groupDefs.push({ id: `bg-loop-${gId++}`, type: 'LOOP', nodes: Array.from(lGrp), routeLeft });
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
         
         // Kaskádové pravidlo pro vrstvení a dynamický padding pro zpětnou šipku cyklu
         if (g.type === 'LOOP') {
             padTop = 40;
             padBottom = 40;
             if (g.routeLeft) {
                 padLeft = 70; // Přidáno +45px doleva, aby šipka nečouhala ven
                 padRight = 40;
             } else {
                 padLeft = 40;
                 padRight = 70; // Přidáno +45px doprava
             }
         }

         // Sytější inline barvy odolné proti smazání kompilátorem
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