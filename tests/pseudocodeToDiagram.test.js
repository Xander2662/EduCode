import { describe, it, expect } from 'vitest';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';

describe('Pseudocode to Diagram Parser - Regression Tests', () => {
    it('Měl by vygenerovat platné XML s prázdnou funkcí', () => {
        const input = `FUNCTION main()\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);
        
        expect(result.errors).toHaveLength(0);
        expect(result.xml).toContain('<mxGraphModel');
        expect(result.xml).toContain('value="main"');
        expect(result.xml).toContain('mode=start');
    });

    it('Měl by odstranit slovo NOT z WHILE podmínky a informovat uživatele v errors', () => {
        const input = `FUNCTION main()
    WHILE NOT (x > 10) DO
        Operace()
    ENDWHILE
ENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);
        
        expect(result.xml).not.toContain('NOT');
        expect(result.xml).toContain('value="x &gt; 10"'); // &gt; je escapovaný znak >
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("Obal 'NOT' u smyčky");
        expect(result.errors[0]).toContain("byl převeden jako prohození větví");
    });

    it('Měl by zachytit chybějící ukončení funkce', () => {
        const input = `FUNCTION main()\nPRINT(Ahoj)`;
        const result = parsePseudocodeToDrawio(input);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('není na konci správně uzavřen');
    });
});