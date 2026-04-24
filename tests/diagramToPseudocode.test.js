import { describe, it, expect } from 'vitest';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';
import fs from 'fs';
import path from 'path';

describe('Diagram to Pseudocode Parser - Regression Tests', () => {
    it('Měl by správně umístit ENDFUNCTION až na úplný konec, mimo IF větve', () => {
        const xmlPath = path.resolve(__dirname, '../examples/diagram_examples/test_if_end.xml');
        const xml = fs.readFileSync(xmlPath, 'utf-8');
        
        const result = parseDrawioToPseudocode(xml);
        expect(result.errors).toHaveLength(0);
        
        const ifIndex = result.code.indexOf('IF x > 0 THEN');
        const endIfIndex = result.code.indexOf('ENDIF');
        const endFuncIndex = result.code.indexOf('ENDFUNCTION');
        
        expect(endFuncIndex).toBeGreaterThan(endIfIndex); 
        
        const matches = result.code.match(/ENDFUNCTION/g) || [];
        expect(matches).toHaveLength(1);
    });

    it('Měl by detekovat chybějící startovní blok a nahradit ho', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>`;
        const result = parseDrawioToPseudocode(xml);
        
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('neobsahuje počáteční blok');
    });
});

describe('Pseudocode to Diagram Parser - Dynamic Y Auto-Layout', () => {
    it('Měl by dynamicky přepočítat a posunout Y pozice bloků, pokud dojde k odebrání řádku z kódu', () => {
        const initialCode = `FUNCTION main()
    Akce1()
    Akce2()
    Akce3()
ENDFUNCTION`;
        const result1 = parsePseudocodeToDrawio(initialCode);
        
        const modifiedCode = `FUNCTION main()
    Akce1()
    Akce3()
ENDFUNCTION`;
        const result2 = parsePseudocodeToDrawio(modifiedCode, result1.xml);
        
        // OPRAVA: Použití [\s\S]*? zajistí vyhledávání i přes zalomení řádků (newline)
        const match1 = result1.xml.match(/value="Akce3\(\)"[\s\S]*?y="(\d+)"/);
        const match2 = result2.xml.match(/value="Akce3\(\)"[\s\S]*?y="(\d+)"/);
        
        const y1 = parseInt(match1[1]);
        const y2 = parseInt(match2[1]);
        
        // Akce3() by měla mít menší Y (být výše), když jsme Akce2() smazali
        expect(y2).toBeLessThan(y1);
    });

    it('Měl by správně transformovat samotný IO blok Vstup na INPUT varování', () => {
        const input = `FUNCTION main()
    Vstup
ENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);

        expect(result.xml).toContain('value="Vstup"');
        expect(result.xml).toContain('shape=parallelogram');
    });
});