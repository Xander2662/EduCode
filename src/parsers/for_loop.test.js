import { describe, it, expect } from 'vitest';
import { parsePythonToPseudocode } from './pythonToPseudocode.js';
import { parsePseudocodeToDrawio } from './pseudocodeToDiagram.js';
import { parseDrawioToPseudocode } from './diagramToPseudocode.js';
import { parseDrawioToPython } from './diagramToPython.js';

describe('Bi-directional FOR loop sync logic', () => {

    it('should parse Python for loop to Pseudocode', () => {
        const pyCode = 'for i in range(0, 10):';
        const pseudo = parsePythonToPseudocode(pyCode);
        expect(pseudo).toContain('FOR i = 0 TO 9 DO');
    });

    it('should parse Pseudocode FOR loop to 3 Diagram Nodes', () => {
        const pseudo = 'FOR i = 0 TO 9 DO\n    PRINT i\nENDFOR';
        const result = parsePseudocodeToDrawio(pseudo);
        const xml = result.xml;
        
        // Should contain Init node
        expect(xml).toContain('i = 0');
        // Should contain Condition node
        expect(xml).toContain('i &lt;= 9'); // HTML encoded in XML
        // Should contain Increment node
        expect(xml).toContain('i = i + 1');
    });

    it('should parse Diagram loops back into FOR loop Pseudocode', () => {
        // We will pass the XML generated from the previous step back into diagramToPseudocode
        const pseudoInput = 'FOR i = 0 TO 9 DO\n    PRINT(i)\nENDFOR';
        const drawioResult = parsePseudocodeToDrawio(pseudoInput);
        const xml = drawioResult.xml;

        const generatedPseudo = parseDrawioToPseudocode(xml);
        
        // The generated pseudocode should correctly collapse the 3 nodes back into a FOR loop
        expect(generatedPseudo.code).toContain('FOR i = 0 TO 9 DO');
        // It should NOT contain the standalone init or increment
        expect(generatedPseudo.code).not.toMatch(/^i = 0$/m);
        expect(generatedPseudo.code).not.toMatch(/^i = i \+ 1$/m);
    });

    it('should parse Diagram loops back into Python for loops', () => {
        const pseudoInput = 'FOR i = 0 TO 9 DO\n    PRINT(i)\nENDFOR';
        const drawioResult = parsePseudocodeToDrawio(pseudoInput);
        const xml = drawioResult.xml;

        const generatedPython = parseDrawioToPython(xml);
        
        // The generated Python should correctly collapse the 3 nodes back into a range
        expect(generatedPython.code).toContain('for i in range(0, 10):');
        // It should NOT contain the standalone init or increment
        expect(generatedPython.code).not.toMatch(/^i = 0$/m);
        expect(generatedPython.code).not.toMatch(/^i \+= 1$/m);
    });
});
