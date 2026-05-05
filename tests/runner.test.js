import { describe, it, expect } from 'vitest';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';
import { drawioToReactFlow } from '../src/utils/diagramConverter';
import { DiagramRunner } from '../src/utils/runner';

describe('DiagramRunner - Execution Path', () => {
    it('Měl by správně projít sekvencí a vypočítat proměnné v paměti', () => {
        
        // Zadaný pseudokód uživatele
        const code = `FUNCTION main()
            x = 0
            x = 1
            x = x + x
        ENDFUNCTION`;
        
        // Krok 1: Převod na DrawIO XML
        const { xml } = parsePseudocodeToDrawio(code, '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>', 'true-false');
        
        // Krok 2: Převod na ReactFlow formát pro Debugger
        const { nodes, edges } = drawioToReactFlow(xml);
        
        // Krok 3: Spuštění a simulace Debuggeru
        const runner = new DiagramRunner(nodes, edges);
        let steps = 0;
        let lastVars = {};
        
        // Proběhne celý vývojový diagram, dokud neprojde ENDFUNCTION
        while (!runner.isFinished && steps < 10) {
            const res = runner.step();
            lastVars = res.variables;
            steps++;
        }
        
        // Očekáváme, že cesta proběhne
        expect(steps).toBeGreaterThan(0);
        
        // Krok 4: Na konci by hodnota 'x' měla být: x = 1 -> x = 1 + 1 -> 2
        expect(lastVars['x']).toBe(2);
    });
});