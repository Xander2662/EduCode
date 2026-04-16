import { describe, it, expect } from 'vitest';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';

describe('Pseudocode to Diagram Parser - Loops & DO-WHILE', () => {
    it('Měl by detekovat DO-WHILE cyklus a zabránit duplikaci bloků (Loop Peeling)', () => {
        const input = `FUNCTION main()
    Operace()
    WHILE x > 0 DO
        Operace()
    ENDWHILE
ENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);

        expect(result.errors).toHaveLength(0);

        // 1. Zkontrolujeme, že se "Operace()" vygenerovala pouze JEDNOU!
        const operaceMatches = result.xml.match(/value="Operace\(\)"/g) || [];
        expect(operaceMatches).toHaveLength(1);

        // 2. Zkontrolujeme, že DO-WHILE nevytvořil žádný neviditelný MERGE uzel 
        const mergeMatches = result.xml.match(/style="ellipse;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none/g) || [];
        expect(mergeMatches).toHaveLength(0);
    });

    it('Měl by vygenerovat standardní WHILE cyklus s návratem přimo do podmínky (bez MERGE)', () => {
        const input = `FUNCTION main()
    Vstup x
    WHILE x > 0 DO
        Operace()
    ENDWHILE
ENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);

        expect(result.errors).toHaveLength(0);

        // 1. Zkontrolujeme, že se bloky vygenerovaly
        expect(result.xml).toContain('value="Vstup x"');
        expect(result.xml).toContain('value="Operace()"');

        // 2. MERGE uzly byly odstraněny úplně, mělo by jich tu být 0
        const mergeMatches = result.xml.match(/style="ellipse;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none/g) || [];
        expect(mergeMatches).toHaveLength(0);
    });
    
    it('Měl by správně zpracovat zanořené cykly bez duplikací a bez MERGE uzlů', () => {
        const input = `FUNCTION main()
    x = 0
    WHILE x < 10 DO
        x = x + 1
        y = 0
        WHILE y < 5 DO
            y = y + 1
        ENDWHILE
    ENDWHILE
ENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);
        
        expect(result.errors).toHaveLength(0);
        
        // Zkontrolujeme počet MERGE uzlů - měly by tu být 0
        const mergeMatches = result.xml.match(/style="ellipse;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none/g) || [];
        expect(mergeMatches).toHaveLength(0);
    });
});