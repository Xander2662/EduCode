import { describe, it, expect } from 'vitest';
import { Position } from '@xyflow/react';

// Čistá extrakce logiky CustomEdge.jsx pro izolované testování obchvatu
const calculateEdgePath = ({ sourceX, sourceY, targetX, targetY, sourcePosition, data, nodes, sourceHandleId }) => {
    const isBackEdge = sourceY > targetY + 35;
    
    if (isBackEdge) {
        let maxX = Math.max(sourceX, targetX);
        let minX = Math.min(sourceX, targetX);
        
        nodes.forEach(n => {
            if (n.position.y >= targetY - 30 && n.position.y <= sourceY + 30) {
                const nodeX = n.position.x;
                const nodeMaxX = nodeX + (n.width || 150);
                if (nodeMaxX > maxX) maxX = nodeMaxX;
                if (nodeX < minX) minX = nodeX;
            }
        });
        
        const srcIsLeft = (sourceHandleId === 's-left' || sourcePosition === Position.Left || sourcePosition === 'left');
        const srcIsRight = (sourceHandleId === 's-right' || sourcePosition === Position.Right || sourcePosition === 'right');
        
        let routeLeft;
        if (srcIsLeft) routeLeft = true;
        else if (srcIsRight) routeLeft = false;
        else routeLeft = sourceX <= targetX;
        
        let topY = targetY - 30;
        let isTopYClear = false;
        let loops = 0;
        while (!isTopYClear && loops < 5) {
            isTopYClear = true;
            nodes.forEach(n => {
                if (n.id !== 'targetNode') {
                    const ny = n.position.y;
                    const nh = n.height || 60;
                    if (topY > ny - 10 && topY < ny + nh + 10) {
                        isTopYClear = false;
                        topY = ny - 25; 
                    }
                }
            });
            loops++;
        }
        
        let bottomY = Math.max(sourceY + 30, targetY + 30);
        
        const r = 10;                 
        let path, finalLabelX;
        
        if (routeLeft) {
            const leftEdgeX = Math.min(minX - 80, sourceX - 80, targetX - 80);
            if (srcIsLeft) path = `M ${sourceX} ${sourceY} L ${leftEdgeX + r} ${sourceY} A ${r} ${r} 0 0 1 ${leftEdgeX} ${sourceY - r} L ${leftEdgeX} ${topY + r}`;
            else path = `M ${sourceX} ${sourceY} L ${sourceX} ${bottomY - r} A ${r} ${r} 0 0 1 ${sourceX - r} ${bottomY} L ${leftEdgeX + r} ${bottomY} A ${r} ${r} 0 0 1 ${leftEdgeX} ${bottomY - r} L ${leftEdgeX} ${topY + r}`;
            finalLabelX = leftEdgeX;
        } else {
            const rightEdgeX = Math.max(maxX + 80, sourceX + 80, targetX + 80);
            if (srcIsRight) path = `M ${sourceX} ${sourceY} L ${rightEdgeX - r} ${sourceY} A ${r} ${r} 0 0 0 ${rightEdgeX} ${sourceY - r} L ${rightEdgeX} ${topY + r}`;
            else path = `M ${sourceX} ${sourceY} L ${sourceX} ${bottomY - r} A ${r} ${r} 0 0 0 ${sourceX + r} ${bottomY} L ${rightEdgeX - r} ${bottomY} A ${r} ${r} 0 0 0 ${rightEdgeX} ${bottomY - r} L ${rightEdgeX} ${topY + r}`;
            finalLabelX = rightEdgeX;
        }
        
        return { path, labelX: finalLabelX, topY };
    }
    return { path: "FORWARD", labelX: 0, topY: 0 };
};

describe('SVG Edge Routing - Vyhýbání se překážkám s A-oblouky', () => {

    it('Zpětná hrana vygeneruje 80px velký obchvat mimo nejširší blok', () => {
        const mockNodes = [
            { id: 'targetNode', type: 'CONDITION', position: { x: 300, y: 100 }, width: 150 },
            { id: 'obstacle', type: 'ACTION', position: { x: 500, y: 300 }, width: 100 }, 
        ];

        const result = calculateEdgePath({
            sourceX: 350, sourceY: 550, 
            targetX: 350, targetY: 100, 
            sourceHandleId: 's-right', 
            nodes: mockNodes
        });

        // Nejširší překážka končí na x=600. Pravý obchvat s 80px rádiusem bude na 680.
        expect(result.labelX).toBe(680);
    });

    it('Inteligentní radar vyhne horní horizontální lince kolizi s cizím blokem', () => {
        const mockNodes = [
            { id: 'targetNode', type: 'CONDITION', position: { x: 300, y: 100 }, height: 60 },
            // Tento blok leží PŘESNĚ v cestě výchozí lince (targetY - 30 = 70).
            { id: 'obstacle', type: 'ACTION', position: { x: 200, y: 50 }, height: 60 }, 
        ];

        const result = calculateEdgePath({
            sourceX: 350, sourceY: 550, 
            targetX: 350, targetY: 100, 
            nodes: mockNodes
        });

        // Bez radaru by byla linka na 70, čímž by projela středem 'obstacle'. 
        // Radar ji musí vykopnout nad překážku (ny - 25 -> 50 - 25 = 25).
        expect(result.topY).toBe(25);
    });

    it('Správně nahradí existující spojení na výstupu i na vstupu cílového bloku', () => {
        // Simulace filtrovací logiky onConnect
        const filterEdges = (existingEdges, newParam, sourceNode) => {
            return existingEdges.filter(e => {
                // Odstranění starého výstupního spojení
                if (sourceNode && sourceNode.type !== 'CONDITION' && e.source === newParam.source) return false;
                if (sourceNode && sourceNode.type === 'CONDITION' && e.source === newParam.source && e.sourceHandle === newParam.sourceHandle) return false;
                // Odstranění starého vstupního spojení na cílový handle
                if (e.target === newParam.target && (e.targetHandle === newParam.targetHandle || (!newParam.targetHandle && !e.targetHandle))) return false;
                return true;
            });
        };

        const existing = [
            { id: 'e1', source: 'node1', sourceHandle: 's-bottom', target: 'node2', targetHandle: 't-top' },
            { id: 'e2', source: 'node3', sourceHandle: 's-bottom', target: 'node4', targetHandle: 't-top' }
        ];

        // Nové spojení z node1 do node4 (nahradí výstup z node1 a vstup do node4)
        const updated = filterEdges(existing, { source: 'node1', sourceHandle: 's-bottom', target: 'node4', targetHandle: 't-top' }, { id: 'node1', type: 'ACTION' });
        
        expect(updated).toEqual([]); // obě staré hrany byly nahrazeny
    });

    it('Zachová více vstupních hran pouze pro větvení IF, ENDFUNCTION a loopback cyklu, jinak smaže', () => {
        const nodes = [
            { id: 'start', type: 'START_END', position: { x: 400, y: 40 }, data: { mode: 'start' } },
            { id: 'if1', type: 'CONDITION', position: { x: 400, y: 140 } },
            { id: 'actTrue', type: 'ACTION', position: { x: 400, y: 250 } },
            { id: 'actFalse', type: 'ACTION', position: { x: 600, y: 250 } },
            { id: 'joinAct', type: 'ACTION', position: { x: 400, y: 380 } },
            { id: 'end1', type: 'START_END', position: { x: 400, y: 500 }, data: { mode: 'end' } },
            { id: 'other', type: 'ACTION', position: { x: 200, y: 250 } }
        ];

        const getNode = (id) => nodes.find(n => n.id === id);

        const filterOnConnect = (eds, params) => {
            const sourceNode = getNode(params.source);
            const targetNode = getNode(params.target);

            return eds.filter(e => {
                if (sourceNode && sourceNode.type !== 'CONDITION' && e.source === params.source) return false;
                if (sourceNode && sourceNode.type === 'CONDITION' && e.source === params.source && e.sourceHandle === params.sourceHandle) return false;

                const isSameTargetHandle = e.target === params.target && (e.targetHandle || null) === (params.targetHandle || null);
                if (isSameTargetHandle) {
                    if (targetNode?.type === 'START_END' && targetNode.data?.mode === 'end') return true;
                    if (targetNode?.type === 'MERGE') return true;

                    const existingSourceNode = getNode(e.source);

                    if (targetNode?.type === 'CONDITION') {
                        const isDownstream = (startId, targetId, visited = new Set()) => {
                            if (startId === targetId) return true;
                            if (visited.has(startId)) return false;
                            visited.add(startId);
                            return eds.filter(ed => ed.source === startId).some(ed => isDownstream(ed.target, targetId, visited));
                        };
                        const isNewLoopback = isDownstream(targetNode.id, params.source) || (sourceNode && sourceNode.position.y > targetNode.position.y);
                        const isExistingLoopback = isDownstream(targetNode.id, e.source) || (existingSourceNode && existingSourceNode.position.y > targetNode.position.y);
                        if (isNewLoopback || isExistingLoopback) return true;
                    }

                    const getConditionBranches = (startNodeId, startHandle = null) => {
                        const result = new Map();
                        const queue = [{ id: startNodeId, handle: startHandle }];
                        const visited = new Set();
                        while (queue.length > 0) {
                            const curr = queue.shift();
                            const key = `${curr.id}_${curr.handle || ''}`;
                            if (visited.has(key)) continue;
                            visited.add(key);

                            const n = getNode(curr.id);
                            if (n && n.type === 'CONDITION' && curr.handle) {
                                if (!result.has(n.id)) result.set(n.id, new Set());
                                result.get(n.id).add(curr.handle);
                            }

                            eds.filter(ed => ed.target === curr.id).forEach(ed => {
                                queue.push({ id: ed.source, handle: ed.sourceHandle });
                            });
                        }
                        return result;
                    };

                    const newBranches = getConditionBranches(params.source, sourceNode?.type === 'CONDITION' ? params.sourceHandle : null);
                    const existingBranches = getConditionBranches(e.source, existingSourceNode?.type === 'CONDITION' ? e.sourceHandle : null);

                    let isIfBranchConvergence = false;
                    for (const [condId, newSet] of newBranches.entries()) {
                        if (existingBranches.has(condId)) {
                            const existingSet = existingBranches.get(condId);
                            const hasDifferentBranch = Array.from(newSet).some(h => !existingSet.has(h)) ||
                                                       Array.from(existingSet).some(h => !newSet.has(h));
                            if (hasDifferentBranch) {
                                isIfBranchConvergence = true;
                                break;
                            }
                        }
                    }
                    if (isIfBranchConvergence) return true;

                    return false;
                }

                return true;
            });
        };

        // Test 1: Běžná sekvence nahradí staré spojení (other -> joinAct nahradí actTrue -> joinAct pokud to není větev IF)
        const edsLinear = [{ id: 'e1', source: 'other', target: 'joinAct', targetHandle: 't-top' }];
        const resLinear = filterOnConnect(edsLinear, { source: 'start', target: 'joinAct', targetHandle: 't-top' });
        expect(resLinear).toHaveLength(0); // e1 smazána, nahrazena novým spojením

        // Test 2: Konvergence větví IF do joinAct zachová obě větve
        const edsBranches = [
            { id: 'e_if_t', source: 'if1', sourceHandle: 's-bottom', target: 'actTrue' },
            { id: 'e_if_f', source: 'if1', sourceHandle: 's-right', target: 'actFalse' },
            { id: 'e_t_join', source: 'actTrue', sourceHandle: 's-bottom', target: 'joinAct', targetHandle: 't-top' }
        ];
        const resBranches = filterOnConnect(edsBranches, { source: 'actFalse', sourceHandle: 's-bottom', target: 'joinAct', targetHandle: 't-top' });
        expect(resBranches).toContainEqual(expect.objectContaining({ id: 'e_t_join' })); // e_t_join NENÍ smazána!

        // Test 3: Spojení obou větví do ENDFUNCTION zachová obě
        const edsEnd = [
            { id: 'e_t_end', source: 'actTrue', sourceHandle: 's-bottom', target: 'end1', targetHandle: 't-top' }
        ];
        const resEnd = filterOnConnect(edsEnd, { source: 'actFalse', sourceHandle: 's-bottom', target: 'end1', targetHandle: 't-top' });
        expect(resEnd).toContainEqual(expect.objectContaining({ id: 'e_t_end' })); // zachováno pro ENDFUNCTION

        // Test 4: Loopback do CONDITION zachová vstupní hranu
        const edsLoop = [
            { id: 'e_start_if', source: 'start', sourceHandle: 's-bottom', target: 'if1', targetHandle: 't-top' },
            { id: 'e_if_body', source: 'if1', sourceHandle: 's-bottom', target: 'actTrue', targetHandle: 't-top' }
        ];
        const resLoop = filterOnConnect(edsLoop, { source: 'actTrue', sourceHandle: 's-bottom', target: 'if1', targetHandle: 't-top' });
        expect(resLoop).toContainEqual(expect.objectContaining({ id: 'e_start_if' })); // vstupní hrana z start NENÍ smazána!
    });
});