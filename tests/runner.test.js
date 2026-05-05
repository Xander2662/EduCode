import { describe, it, expect, vi } from 'vitest';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';
import { drawioToReactFlow } from '../src/utils/diagramConverter';
import { DiagramRunner } from '../src/utils/runner';

describe('DiagramRunner - Execution Path', () => {
    it('Měl by projít čistou sekvencí a akumulovat hodnotu v paměti', () => {
        const code = `FUNCTION main()
    x = 0
    x = 1
    x = x + x
ENDFUNCTION`;
        
        const { xml } = parsePseudocodeToDrawio(code);
        const { nodes, edges } = drawioToReactFlow(xml);
        const runner = new DiagramRunner(nodes, edges);
        
        let steps = 0;
        let lastVars = {};
        
        // Exekuce omezená pojistkou proti nekonečnému cyklu
        while (!runner.isFinished && steps < 15) {
            const res = runner.step();
            lastVars = res.variables;
            steps++;
        }
        
        expect(steps).toBeGreaterThan(0);
        expect(lastVars['x']).toBe(2);
    });

    it('Měl by zpracovat VSTUP uzel přes window.prompt a uložit do paměti', () => {
        const nodes = [
            { id: '1', type: 'START_END', data: { mode: 'start' } },
            { id: '2', type: 'IO', data: { label: 'y' } }, // Hodnota očištěna parserem
            { id: '3', type: 'START_END', data: { mode: 'end' } }
        ];
        const edges = [
            { source: '1', target: '2' },
            { source: '2', target: '3' }
        ];

        // Dočasné přesměrování (mock) systémového vstupu prohlížeče
        const originalPrompt = window.prompt;
        window.prompt = vi.fn(() => "42");

        const runner = new DiagramRunner(nodes, edges);
        runner.step(); // START
        runner.step(); // IO uzel -> vyžádání vstupu
        const res = runner.step(); // END

        expect(window.prompt).toHaveBeenCalled();
        expect(res.variables['y']).toBe(42);

        window.prompt = originalPrompt; // Úklid po testu
    });
});