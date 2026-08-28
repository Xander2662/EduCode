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
    it('Měl by zpracovat okraje spojené přímo s LOOP_CONTAINER (např. přes úchyty obalu)', () => {
        const nodes = [
            { id: 'start', type: 'START_END', data: { mode: 'start' } },
            { id: 'init', type: 'ACTION', position: { x: 50, y: -50 }, data: { label: 'x = 0' } },
            { id: 'loop', type: 'LOOP_CONTAINER', position: { x: 0, y: 100 }, width: 200, height: 200, data: { label: 'x < 2', doWhile: false } },
            { id: 'inner', type: 'ACTION', position: { x: 50, y: 150 }, parentId: 'loop', data: { label: 'x = x + 1' } },
            { id: 'end', type: 'START_END', position: { x: 50, y: 400 }, data: { mode: 'end' } }
        ];
        // The edge connects 'init' directly to 'loop' container, and 'loop' directly to 'end'
        const edges = [
            { source: 'start', target: 'init' },
            { source: 'init', target: 'loop' },
            { source: 'inner', target: 'loop' }, // inner points out to loop
            { source: 'loop', target: 'end' } // loop points out to end
        ];

        const runner = new DiagramRunner(nodes, edges);
        
        runner.step(); // start -> init
        runner.step(); // init -> evaluates loop (x=0 < 2 is TRUE), goes to inner

        expect(runner.variables['x']).toBe(0);
        expect(runner.currentNodeId).toBe('inner');
        
        runner.step(); // runs inner (x=1), points to loop (hijacked to inner), evaluates loop (1 < 2 is TRUE), goes to inner
        expect(runner.variables['x']).toBe(1);
        expect(runner.currentNodeId).toBe('inner');
        
        runner.step(); // runs inner (x=2), points to loop (hijacked to inner), evaluates loop (2 < 2 is FALSE), exits to end
        expect(runner.variables['x']).toBe(2);
        expect(runner.currentNodeId).toBe('end');
        
        const res = runner.step(); // runs end
        expect(res.finished).toBe(true);
    });
    it('Měl by správně vyhodnotit hodnotu 0 v podmínkách (číslo 0 nesmí být ignorováno nebo chybné)', () => {
        const nodes = [
            { id: 'start', type: 'START_END', data: { mode: 'start' } },
            { id: 'init', type: 'ACTION', data: { label: 'x = 0' } },
            { id: 'cond', type: 'CONDITION', data: { label: 'x == 0' } },
            { id: 'actionTrue', type: 'ACTION', data: { label: 'y = 100' } },
            { id: 'actionFalse', type: 'ACTION', data: { label: 'y = -1' } },
            { id: 'end', type: 'START_END', data: { mode: 'end' } }
        ];
        const edges = [
            { source: 'start', target: 'init' },
            { source: 'init', target: 'cond' },
            { source: 'cond', target: 'actionTrue', data: { label: 'ano' } },
            { source: 'cond', target: 'actionFalse', data: { label: 'ne' } },
            { source: 'actionTrue', target: 'end' },
            { source: 'actionFalse', target: 'end' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        runner.step(); // start -> init
        runner.step(); // init -> cond (x becomes 0)
        expect(runner.variables['x']).toBe(0);
        
        runner.step(); // cond -> actionTrue (0 == 0 is TRUE)
        expect(runner.currentNodeId).toBe('actionTrue');
        
        runner.step(); // actionTrue -> end
        expect(runner.variables['y']).toBe(100);
        
        runner.step(); // end -> finish
        expect(runner.isFinished).toBe(true);
    });

    it('Měl by správně vyhodnotit samotnou proměnnou v podmínce jako truthy/falsy', () => {
        const nodes = [
            { id: 'start', type: 'START_END', data: { mode: 'start' } },
            { id: 'init', type: 'ACTION', data: { label: 'x = 0' } },
            { id: 'cond', type: 'CONDITION', data: { label: 'x' } },
            { id: 'actionTrue', type: 'ACTION', data: { label: 'y = 100' } },
            { id: 'actionFalse', type: 'ACTION', data: { label: 'y = -1' } },
            { id: 'end', type: 'START_END', data: { mode: 'end' } }
        ];
        const edges = [
            { source: 'start', target: 'init' },
            { source: 'init', target: 'cond' },
            { source: 'cond', target: 'actionTrue', data: { label: 'ano' } },
            { source: 'cond', target: 'actionFalse', data: { label: 'ne' } },
            { source: 'actionTrue', target: 'end' },
            { source: 'actionFalse', target: 'end' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        runner.step(); // start -> init
        runner.step(); // init -> cond
        runner.step(); // cond -> actionFalse (x is 0, falsy)
        
        expect(runner.currentNodeId).toBe('actionFalse');
        runner.step();
        expect(runner.variables['y']).toBe(-1);
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

describe('DiagramRunner - Uninitialized Variable Type Deduction', () => {
    it('Měl by odvodit typ Number (Int) při x = x + 1, když x ještě nemá hodnotu', () => {
        const nodes = [
            { id: '1', type: 'START_END', data: { mode: 'start', label: 'START' } },
            { id: '2', type: 'ACTION', data: { label: 'x = x + 1' } },
            { id: '3', type: 'START_END', data: { mode: 'end', label: 'END' } }
        ];
        const edges = [
            { source: '1', target: '2' },
            { source: '2', target: '3' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        runner.step(); // START -> ACTION
        const res = runner.step(); // Vyhodnotí x = x + 1
        
        expect(res.variables['x']).toBe(1);
        expect(typeof res.variables['x']).toBe('number');
    });

    it('Měl by odvodit typ String při x = x + \'1\', když x ještě nemá hodnotu', () => {
        const nodes = [
            { id: '1', type: 'START_END', data: { mode: 'start', label: 'START' } },
            { id: '2', type: 'ACTION', data: { label: "x = x + '1'" } },
            { id: '3', type: 'START_END', data: { mode: 'end', label: 'END' } }
        ];
        const edges = [
            { source: '1', target: '2' },
            { source: '2', target: '3' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        runner.step(); // START -> ACTION
        const res = runner.step(); // Vyhodnotí x = x + '1'
        
        expect(res.variables['x']).toBe('1');
        expect(typeof res.variables['x']).toBe('string');
    });

    it('Měl by odvodit typ String při x = x + "text", když x ještě nemá hodnotu', () => {
        const nodes = [
            { id: '1', type: 'START_END', data: { mode: 'start', label: 'START' } },
            { id: '2', type: 'ACTION', data: { label: 'x = x + "ahoj"' } },
            { id: '3', type: 'START_END', data: { mode: 'end', label: 'END' } }
        ];
        const edges = [
            { source: '1', target: '2' },
            { source: '2', target: '3' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        runner.step();
        const res = runner.step();
        
        expect(res.variables['x']).toBe('ahoj');
        expect(typeof res.variables['x']).toBe('string');
    });

    it('Měl by správně akumulovat v cyklu bez předchozí inicializace', () => {
        const nodes = [
            { id: '1', type: 'START_END', data: { mode: 'start', label: 'START' } },
            { id: '2', type: 'ACTION', data: { label: 'num = num + 5' } },
            { id: '3', type: 'ACTION', data: { label: 'num = num + 10' } },
            { id: '4', type: 'ACTION', data: { label: "str = str + 'A'" } },
            { id: '5', type: 'ACTION', data: { label: "str = str + 'B'" } },
            { id: '6', type: 'START_END', data: { mode: 'end', label: 'END' } }
        ];
        const edges = [
            { source: '1', target: '2' },
            { source: '2', target: '3' },
            { source: '3', target: '4' },
            { source: '4', target: '5' },
            { source: '5', target: '6' }
        ];

        const runner = new DiagramRunner(nodes, edges);
        runner.step(); // 1 -> 2
        runner.step(); // 2 -> 3 (num = 5)
        expect(runner.variables['num']).toBe(5);
        runner.step(); // 3 -> 4 (num = 15)
        expect(runner.variables['num']).toBe(15);
        runner.step(); // 4 -> 5 (str = 'A')
        expect(runner.variables['str']).toBe('A');
        runner.step(); // 5 -> 6 (str = 'AB')
        expect(runner.variables['str']).toBe('AB');
    });
});

describe('DiagramRunner - In-Depth Tests for All Data Types', () => {
    // 1. INT (Integer)
    describe('Type: Int (Integer)', () => {
        it('Zvládá přímé přiřazení kladných, záporných a nulových celých čísel', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'a = 10\nb = -25\nc = 0' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(res.variables['a']).toBe(10);
            expect(res.variables['b']).toBe(-25);
            expect(res.variables['c']).toBe(0);
            expect(Number.isInteger(res.variables['a'])).toBe(true);
            expect(Number.isInteger(res.variables['b'])).toBe(true);
            expect(Number.isInteger(res.variables['c'])).toBe(true);
        });

        it('Zvládá aritmetické operace s celými čísly (+, -, *, %, mocniny)', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'add = 5 + 3\nsub = 10 - 15\nmul = 4 * 6\nmod = 17 % 5' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(res.variables['add']).toBe(8);
            expect(res.variables['sub']).toBe(-5);
            expect(res.variables['mul']).toBe(24);
            expect(res.variables['mod']).toBe(2);
            expect(Number.isInteger(res.variables['add'])).toBe(true);
        });

        it('Zvládá nezinicializovaný akumulátor s celými čísly', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'count = count + 1' } },
                { id: '3', type: 'ACTION', data: { label: 'count = count + 9' } },
                { id: '4', type: 'ACTION', data: { label: 'count = count - 4' } },
                { id: '5', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [
                { source: '1', target: '2' },
                { source: '2', target: '3' },
                { source: '3', target: '4' },
                { source: '4', target: '5' }
            ];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            runner.step(); // count = 1
            expect(runner.variables['count']).toBe(1);
            expect(Number.isInteger(runner.variables['count'])).toBe(true);
            runner.step(); // count = 10
            expect(runner.variables['count']).toBe(10);
            runner.step(); // count = 6
            expect(runner.variables['count']).toBe(6);
            expect(Number.isInteger(runner.variables['count'])).toBe(true);
        });
    });

    // 2. FLOAT (Floating point)
    describe('Type: Float (Floating-point Number)', () => {
        it('Zvládá přímé přiřazení desetinných čísel', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'pi = 3.14159\nhalf = 0.5\nneg = -2.75' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(res.variables['pi']).toBeCloseTo(3.14159);
            expect(res.variables['half']).toBe(0.5);
            expect(res.variables['neg']).toBe(-2.75);
            expect(Number.isInteger(res.variables['pi'])).toBe(false);
            expect(typeof res.variables['pi']).toBe('number');
        });

        it('Dělení celých čísel správně vytvoří Float', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'div = 7 / 2\nfrac = 1 / 4' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(res.variables['div']).toBe(3.5);
            expect(res.variables['frac']).toBe(0.25);
            expect(Number.isInteger(res.variables['div'])).toBe(false);
        });

        it('Zvládá nezinicializovaný akumulátor s desetinnými čísly', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'total = total + 1.25' } },
                { id: '3', type: 'ACTION', data: { label: 'total = total + 0.75' } },
                { id: '4', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [
                { source: '1', target: '2' },
                { source: '2', target: '3' },
                { source: '3', target: '4' }
            ];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            runner.step(); // total = 1.25
            expect(runner.variables['total']).toBe(1.25);
            expect(Number.isInteger(runner.variables['total'])).toBe(false);
            runner.step(); // total = 2 (2.0)
            expect(runner.variables['total']).toBe(2);
        });
    });

    // 3. STRING (Text)
    describe('Type: String', () => {
        it('Zvládá přímé přiřazení textových řetězců (jednoduché i dvojité uvozovky)', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 's1 = "Ahoj světe"\ns2 = \'EduCode\'\nempty = ""' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(res.variables['s1']).toBe('Ahoj světe');
            expect(res.variables['s2']).toBe('EduCode');
            expect(res.variables['empty']).toBe('');
            expect(typeof res.variables['s1']).toBe('string');
            expect(typeof res.variables['empty']).toBe('string');
        });

        it('Zvládá nezinicializované řetězení textu s prefixem i sufixem', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: "msg = msg + 'Start: '" } },
                { id: '3', type: 'ACTION', data: { label: "msg = msg + 'OK'" } },
                { id: '4', type: 'ACTION', data: { label: "msg = 'Prefix - ' + msg" } },
                { id: '5', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [
                { source: '1', target: '2' },
                { source: '2', target: '3' },
                { source: '3', target: '4' },
                { source: '4', target: '5' }
            ];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            runner.step(); // msg = 'Start: '
            expect(runner.variables['msg']).toBe('Start: ');
            expect(typeof runner.variables['msg']).toBe('string');
            runner.step(); // msg = 'Start: OK'
            expect(runner.variables['msg']).toBe('Start: OK');
            runner.step(); // msg = 'Prefix - Start: OK'
            expect(runner.variables['msg']).toBe('Prefix - Start: OK');
        });

        it('Zvládá spojování řetězců s čísly a proměnnými', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'name = "Pavel"\nage = 20\ninfo = name + " má " + age + " let"' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(res.variables['info']).toBe('Pavel má 20 let');
            expect(typeof res.variables['info']).toBe('string');
        });
    });

    // 4. BOOL (Boolean)
    describe('Type: Bool (Boolean)', () => {
        it('Zvládá přímé přiřazení booleanů (true/false i Python True/False)', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 't1 = true\nf1 = false\nt2 = True\nf2 = False' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(res.variables['t1']).toBe(true);
            expect(res.variables['f1']).toBe(false);
            expect(res.variables['t2']).toBe(true);
            expect(res.variables['f2']).toBe(false);
            expect(typeof res.variables['t1']).toBe('boolean');
        });

        it('Zvládá porovnávací a logické operátory (AND, OR, NOT, ==, !=, >, <)', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'cmp1 = 5 > 3\ncmp2 = 10 <= 2\neq = "abc" == "abc"\nlogic1 = (5 > 2) AND (3 < 10)\nlogic2 = NOT false' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(res.variables['cmp1']).toBe(true);
            expect(res.variables['cmp2']).toBe(false);
            expect(res.variables['eq']).toBe(true);
            expect(res.variables['logic1']).toBe(true);
            expect(res.variables['logic2']).toBe(true);
        });

        it('Správně větví v podmínce na základě bool proměnné', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'isReady = true' } },
                { id: '3', type: 'CONDITION', data: { label: 'isReady' } },
                { id: '4', type: 'ACTION', data: { label: 'status = "READY"' } },
                { id: '5', type: 'ACTION', data: { label: 'status = "WAITING"' } },
                { id: '6', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [
                { source: '1', target: '2' },
                { source: '2', target: '3' },
                { source: '3', target: '4', data: { label: 'ano' } },
                { source: '3', target: '5', data: { label: 'ne' } },
                { source: '4', target: '6' },
                { source: '5', target: '6' }
            ];

            const runner = new DiagramRunner(nodes, edges);
            runner.step(); // 1 -> 2
            runner.step(); // 2 -> 3
            runner.step(); // 3 -> 4 (protože isReady === true)
            expect(runner.currentNodeId).toBe('4');
            runner.step(); // 4 -> 6
            expect(runner.variables['status']).toBe('READY');
        });
    });

    // 5. ARRAY (List)
    describe('Type: Array', () => {
        it('Zvládá přímé přiřazení a indexaci polí', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'arr = [10, 20, 30]\nfirst = arr[0]\nlast = arr[2]\nlen = arr.length' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(Array.isArray(res.variables['arr'])).toBe(true);
            expect(res.variables['arr']).toEqual([10, 20, 30]);
            expect(res.variables['first']).toBe(10);
            expect(res.variables['last']).toBe(30);
            expect(res.variables['len']).toBe(3);
        });

        it('Zvládá pole s různými typy prvků a operace spojení', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: 'items = ["A", 42, true]\nitems = items.concat(["B"])' } },
                { id: '3', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [{ source: '1', target: '2' }, { source: '2', target: '3' }];

            const runner = new DiagramRunner(nodes, edges);
            runner.step();
            const res = runner.step();

            expect(res.variables['items']).toEqual(['A', 42, true, 'B']);
            expect(Array.isArray(res.variables['items'])).toBe(true);
        });
    });

    // 6. MIXED PIPELINE
    describe('Type: Mixed Multi-Type Integration', () => {
        it('Správně spravuje a izoluje různé datové typy v jednom běhu diagramu', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                // Všechny proměnné začínají nezinicializované
                { id: '2', type: 'ACTION', data: { label: 'intVal = intVal + 10\nfloatVal = floatVal + 2.5\nstrVal = strVal + "x"' } },
                { id: '3', type: 'ACTION', data: { label: 'boolVal = intVal > 5\nlistVal = [intVal, floatVal, strVal, boolVal]' } },
                { id: '4', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [
                { source: '1', target: '2' },
                { source: '2', target: '3' },
                { source: '3', target: '4' }
            ];

            const runner = new DiagramRunner(nodes, edges);
            runner.step(); // 1 -> 2
            runner.step(); // 2 -> 3
            expect(runner.variables['intVal']).toBe(10);
            expect(typeof runner.variables['intVal']).toBe('number');
            expect(Number.isInteger(runner.variables['intVal'])).toBe(true);

            expect(runner.variables['floatVal']).toBe(2.5);
            expect(typeof runner.variables['floatVal']).toBe('number');
            expect(Number.isInteger(runner.variables['floatVal'])).toBe(false);

            expect(runner.variables['strVal']).toBe('x');
            expect(typeof runner.variables['strVal']).toBe('string');

            runner.step(); // 3 -> 4
            expect(runner.variables['boolVal']).toBe(true);
            expect(typeof runner.variables['boolVal']).toBe('boolean');

            expect(runner.variables['listVal']).toEqual([10, 2.5, 'x', true]);
            expect(Array.isArray(runner.variables['listVal'])).toBe(true);
        });

        it('Podporuje PRINT i uvozovkový řetězec v ACTION bloku', () => {
            const nodes = [
                { id: '1', type: 'START_END', data: { mode: 'start' } },
                { id: '2', type: 'ACTION', data: { label: '"Ahoj světe"' } },
                { id: '3', type: 'ACTION', data: { label: 'PRINT(123)' } },
                { id: '4', type: 'START_END', data: { mode: 'end' } }
            ];
            const edges = [
                { source: '1', target: '2' },
                { source: '2', target: '3' },
                { source: '3', target: '4' }
            ];

            const runner = new DiagramRunner(nodes, edges);
            runner.step(); // 1 -> 2
            runner.step(); // 2 -> 3 ("Ahoj světe")
            expect(runner.output).toContain('Ahoj světe');
            runner.step(); // 3 -> 4 (PRINT(123))
            expect(runner.output).toContain('123');
        });
    });
});