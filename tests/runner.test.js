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

    it('Měl by zpracovat standardní WHILE cyklus (s vyhodnocením na začátku)', () => {
        const nodes = [
            { id: 'start', type: 'START_END', data: { mode: 'start' } },
            { id: 'init', type: 'ACTION', position: { x: 50, y: 0 }, data: { label: 'x = 2' } },
            { id: 'loop', type: 'LOOP_CONTAINER', position: { x: 0, y: 100 }, width: 200, height: 200, data: { label: 'x > 0', doWhile: false } },
            { id: 'inner', type: 'ACTION', position: { x: 50, y: 150 }, data: { label: 'x = x - 1' } },
            { id: 'end', type: 'START_END', position: { x: 50, y: 400 }, data: { mode: 'end' } }
        ];
        // Očekávaný tok: init -> inner -> end (s odbočkami kvůli vyhodnocení cyklu)
        const edges = [
            { source: 'start', target: 'init' },
            { source: 'init', target: 'inner' },
            { source: 'inner', target: 'end' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        
        runner.step(); // start -> init
        runner.step(); // init -> inner (před nastavením currentNodeId=inner zkontroluje x=2 > 0 -> TRUE)
        expect(runner.variables['x']).toBe(2);
        
        runner.step(); // spustí inner (x se změní na 1), přesměruje na inner (x=1 > 0 -> TRUE)
        expect(runner.variables['x']).toBe(1);
        expect(runner.currentNodeId).toBe('inner');
        
        runner.step(); // spustí inner (x se změní na 0), přesměruje na inner (x=0 > 0 -> FALSE) -> skočí na end
        expect(runner.variables['x']).toBe(0);
        expect(runner.currentNodeId).toBe('end');
        
        const res = runner.step(); // zpracuje end
        expect(res.finished).toBe(true);
    });

    it('Měl by zpracovat DO-WHILE cyklus (vyhodnocení až na konci)', () => {
        const nodes = [
            { id: 'start', type: 'START_END', data: { mode: 'start' } },
            { id: 'init', type: 'ACTION', position: { x: 50, y: 0 }, data: { label: 'x = 0' } },
            { id: 'loop', type: 'LOOP_CONTAINER', position: { x: 0, y: 100 }, width: 200, height: 200, data: { label: 'x > 0', doWhile: true } },
            { id: 'inner', type: 'ACTION', position: { x: 50, y: 150 }, data: { label: 'x = x - 1' } },
            { id: 'end', type: 'START_END', position: { x: 50, y: 400 }, data: { mode: 'end' } }
        ];
        const edges = [
            { source: 'start', target: 'init' },
            { source: 'init', target: 'inner' },
            { source: 'inner', target: 'end' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        
        runner.step(); // start -> init
        runner.step(); // init -> inner (první vstup: u DO-WHILE se neověřuje!)
        expect(runner.variables['x']).toBe(0);
        expect(runner.currentNodeId).toBe('inner');
        
        runner.step(); // spustí inner (x se změní na -1), přesměruje na inner, kontrola zpětného běhu: -1 > 0 -> FALSE -> skočí na end
        expect(runner.variables['x']).toBe(-1);
        expect(runner.currentNodeId).toBe('end');
        
        const res = runner.step(); // zpracuje end
        expect(res.finished).toBe(true);
    });
});

describe('DiagramRunner - Console Events and Insights', () => {
    it('Standard output is recorded in events', () => {
        const nodes = [
            { id: '1', type: 'START_END', data: { label: 'START' } },
            { id: '2', type: 'IO', data: { label: 'PRINT "Hello World"' } },
            { id: '3', type: 'START_END', data: { label: 'END' } }
        ];
        const edges = [
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3' }
        ];

        const runner = new DiagramRunner(nodes, edges, '1');
        let res = runner.step();
        res = runner.step(); // Execute IO node

        expect(res.output).toContain('Hello World');
        expect(res.events).toEqual([
            { type: 'output', msg: 'Hello World' }
        ]);
    });

    it('Loop skip generates an insight event', () => {
        const nodes = [
            { id: '1', type: 'START_END', data: { label: 'START' } },
            { id: '2', type: 'ACTION', data: { label: 'x = -1' } },
            { id: '3', type: 'LOOP_CONTAINER', data: { label: 'x > 0' } },
            { id: '4', type: 'START_END', data: { label: 'END' } }
        ];
        const edges = [
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3' },
            { id: 'e3-4', source: '3', target: '4' } // Loop exit
        ];

        const runner = new DiagramRunner(nodes, edges, '1');
        let res = runner.step(); // From 1 to 2
        res = runner.step(); // Execute x = -1, go to 3
        res = runner.step(); // Evaluate x > 0, false, skip to 4

        expect(res.events.length).toBe(1);
        expect(res.events[0].type).toBe('insight');
        expect(res.events[0].msg).toContain("Konec cyklu: 'x > 0' je nepravdivá");
        expect(res.events[0].msg).toContain("[x=-1]");
    });
});