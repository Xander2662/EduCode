// Počítá a generuje obalové uzly (Color Groups) v pozadí
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

    // 2. Seskupení těl Cyklů (vše mezi zpětnou hranou a podmínkou)
    edges.forEach(e => {
        const src = nodes.find(n => n.id === e.source);
        const tgt = nodes.find(n => n.id === e.target);
        if (src && tgt && tgt.position.y <= src.position.y && tgt.type === 'CONDITION') {
            const lGrp = [];
            nodes.forEach(n => {
                if (n.position.y >= tgt.position.y && n.position.y <= src.position.y && n.type !== 'COMMENT') {
                    lGrp.push(n.id);
                }
            });
            if (lGrp.length > 0) groupDefs.push({ id: `bg-loop-${gId++}`, type: 'LOOP', nodes: lGrp });
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
         const pad = 30; // Padding okolo obalu
         
         let colorClass = '';
         if (g.type === 'ACTION') colorClass = 'bg-blue-400/20 border-blue-500/50';
         if (g.type === 'IO') colorClass = 'bg-emerald-400/20 border-emerald-500/50';
         if (g.type === 'LOOP') colorClass = 'bg-amber-400/20 border-amber-500/50';

         return {
             id: g.id,
             type: 'GROUP_BG',
             position: { x: minX - pad, y: minY - pad },
             data: { colorClass, width: maxX - minX + 2*pad, height: maxY - minY + 2*pad },
             style: { width: maxX - minX + 2*pad, height: maxY - minY + 2*pad, zIndex: -1, pointerEvents: 'none' },
             selectable: false,
             draggable: false,
             focusable: false,
             deletable: false,
         };
    }).filter(Boolean);
};