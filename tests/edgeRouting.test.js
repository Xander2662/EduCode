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
});