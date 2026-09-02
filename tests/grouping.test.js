import { describe, it, expect } from 'vitest';
import { getGroupDefs, computeGroupBounds } from '../src/utils/grouping';

describe('grouping', () => {
    it('Vygeneruje ohraničující skupinu (LOOP) okolo zacyklených bloků', () => {
        const nodes = [
            { id: 'cond1', type: 'CONDITION', position: { x: 100, y: 100 }, measured: { width: 140, height: 70 } },
            { id: 'act1', type: 'ACTION', position: { x: 100, y: 200 }, measured: { width: 100, height: 50 } }
        ];
        const edges = [
            { source: 'cond1', target: 'act1' },
            { source: 'act1', target: 'cond1' } 
        ];

        const defs = getGroupDefs(nodes, edges);
        const groups = computeGroupBounds(nodes, defs);
        
        expect(groups).toBeDefined();
        const loopGroup = groups.find(g => g.type === 'GROUP_BG' && g.data.bgColor.includes('251, 191, 36'));
        expect(loopGroup).toBeDefined();
        expect(loopGroup.width).toBeGreaterThan(100);
    });

    it('Vygeneruje ohraničující skupinu pro sousedící akce', () => {
        const nodes = [
            { id: 'act1', type: 'ACTION', position: { x: 100, y: 100 } },
            { id: 'act2', type: 'ACTION', position: { x: 100, y: 200 } }
        ];
        const edges = [
            { source: 'act1', target: 'act2' }
        ];

        const defs = getGroupDefs(nodes, edges);
        const groups = computeGroupBounds(nodes, defs);
        const actionGroup = groups.find(g => g.type === 'GROUP_BG' && g.data.bgColor.includes('96, 165, 250'));
        expect(actionGroup).toBeDefined();
    });
});