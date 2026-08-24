import { describe, it, expect } from 'vitest';
import { drawioToReactFlow, reactFlowToDrawio } from '../src/utils/diagramConverter.js';

describe('reactFlowToDrawio switch/case tests', () => {
    it('should correctly convert SWITCH_CONTAINER and CASE_CONTAINER', () => {
        const nodes = [
            { id: '1', type: 'SWITCH_CONTAINER', data: { switchVar: 'x' }, position: { x: 0, y: 0 } },
            { id: '2', type: 'CASE_CONTAINER', data: { caseVal: '1' }, position: { x: 10, y: 10 }, parentNode: '1' }
        ];
        const xml = reactFlowToDrawio(nodes, []);
        expect(xml).toContain('SWITCH_CONTAINER');
        expect(xml).toContain('switchVar=x');
        expect(xml).toContain('CASE_CONTAINER');
        expect(xml).toContain('caseVal=1');
        expect(xml).toContain('parent="1"'); // case's parent is switch's id
    });
});
