import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiagramRunner } from '../src/utils/runner';

describe('DiagramRunner - Execution Path', () => {
    beforeEach(() => {
        vi.stubGlobal('prompt', vi.fn().mockReturnValue('42'));
        process.env.NODE_ENV = 'test'; // Zajišťuje, že se zavolá synchronní window.prompt místo React dialogu
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Měl by projít čistou sekvencí a akumulovat hodnotu v paměti', () => {
        const nodes = [
            { id: '1', type: 'START_END', data: { mode: 'start', label: 'main' } },
            { id: '2', type: 'ACTION', data: { label: 'x = 10' } },
            { id: '3', type: 'ACTION', data: { label: 'x = x + 5' } },
            { id: '4', type: 'START_END', data: { mode: 'end', label: 'ENDFUNCTION' } }
        ];
        const edges = [
            { source: '1', target: '2' },
            { source: '2', target: '3' },
            { source: '3', target: '4' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        let res;
        
        res = runner.step(); // Start -> x = 10
        res = runner.step(); // x = 10 -> x = x + 5
        expect(res.variables['x']).toBe(10);
        
        res = runner.step(); // x = x + 5 -> End
        expect(res.variables['x']).toBe(15);
        
        res = runner.step(); // End -> finished
        expect(res.finished).toBe(true);
    });

    it('Měl by zpracovat VSTUP uzel přes window.prompt a uložit do paměti', () => {
        const nodes = [
            { id: '1', type: 'START_END', data: { mode: 'start', label: 'main' } },
            { id: '2', type: 'IO', data: { label: 'y', ioType: 'input' } },
            { id: '3', type: 'START_END', data: { mode: 'end', label: 'ENDFUNCTION' } }
        ];
        const edges = [
            { source: '1', target: '2' },
            { source: '2', target: '3' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        runner.step(); // Vyhodnotí start
        
        const res = runner.step(); // Vyhodnotí VSTUP
        
        expect(window.prompt).toHaveBeenCalledWith("Zadejte hodnotu pro proměnnou 'y':", "0");
        expect(res.variables['y']).toBe(42);
    });
});