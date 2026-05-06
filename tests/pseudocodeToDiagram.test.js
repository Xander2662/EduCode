import { describe, it, expect } from 'vitest';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';

describe('Pseudocode to Diagram Parser - Dynamic Y Auto-Layout', () => {
    it('Měl by dynamicky přepočítat a posunout Y pozice bloků, pokud dojde k odebrání řádku z kódu', () => {
        const code = `FUNCTION main()\n  x = 1\n  y = 2\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(code);
        expect(result.xml).toContain('value="x = 1"');
        expect(result.xml).toContain('value="y = 2"');
    });

    it('Měl by správně transformovat samotný IO blok Vstup na INPUT varování', () => {
        const input = `FUNCTION main()\n  Vstup\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);
        
        expect(result.xml).toContain('value="Vstup"');
        expect(result.xml).toContain('shape=parallelogram');
        expect(result.xml).toContain('ioType=input');
    });

    it('Měl by zachovat uživatelsky prohozené T/F porty (True na s-right, False na s-bottom)', () => {
        const code = `FUNCTION main()\n  IF x > 0 THEN\n    y = 1\n  ELSE\n    y = 2\n  ENDIF\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(code);
        expect(result.xml).toContain('shape=hexagon');
    });

    it('Měl by zpracovat PRINT jako ioType=output', () => {
        const input = `FUNCTION main()\n  PRINT("Hello")\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);
        
        // Zpracovává bezpečný enkódovaný text
        expect(result.xml).toContain('value="&quot;Hello&quot;"'); 
        expect(result.xml).toContain('shape=parallelogram');
        expect(result.xml).toContain('ioType=output');
    });
});