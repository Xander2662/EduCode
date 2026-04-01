import { describe, it, expect } from 'vitest';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode';
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

    it('Měl by detekovat chybějící startovní blok', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>`;
        const result = parseDrawioToPseudocode(xml);
        
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('neobsahuje počáteční blok');
    });
});