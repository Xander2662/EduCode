import { describe, it, expect } from 'vitest';
import { calculateGroupNodes } from '../src/utils/grouping';

describe('Color Grouping Logic', () => {
    it('Měl by vytvořit GROUP_BG uzel pro dvě navazující akce', () => {
        const nodes = [
            { id: 'n1', type: 'ACTION', position: { x: 0, y: 0 } },
            { id: 'n2', type: 'ACTION', position: { x: 0, y: 100 } },
            { id: 'n3', type: 'IO', position: { x: 0, y: 200 } }
        ];
        const edges = [
            { source: 'n1', target: 'n2' }
        ];

        const result = calculateGroupNodes(nodes, edges, true);

        // Očekáváme 1 skupinu pro ACTION (n1 a n2)
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('GROUP_BG');
        // Testujeme novou bezpečnou 'bgColor' s rgba namísto staré Tailwind třídy
        expect(result[0].data.bgColor).toContain('rgba(96'); 
    });

    it('Měl by vytvořit GROUP_BG uzel pro cyklus', () => {
        const nodes = [
            { id: 'cond', type: 'CONDITION', position: { x: 0, y: 0 } },
            { id: 'body', type: 'ACTION', position: { x: 0, y: 100 } }
        ];
        const edges = [
            { source: 'cond', target: 'body' },
            { source: 'body', target: 'cond' } // Zpětná hrana tvořící cyklus
        ];

        const result = calculateGroupNodes(nodes, edges, true);

        // Očekáváme 1 skupinu pro LOOP (body uvnitř cond)
        expect(result).toHaveLength(1);
        expect(result[0].data.bgColor).toContain('rgba(251');
    });

    it('Neměl by vrátit žádný obal, pokud je volba groupColoring vypnuta', () => {
        const nodes = [{ id: 'n1', type: 'ACTION', position: { x: 0, y: 0 } }, { id: 'n2', type: 'ACTION', position: { x: 0, y: 100 } }];
        const edges = [{ source: 'n1', target: 'n2' }];
        const result = calculateGroupNodes(nodes, edges, false);
        
        expect(result).toHaveLength(0);
    });
});