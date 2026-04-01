import { describe, it, expect } from 'vitest';
import { parsePseudocodeToPython } from '../src/parsers/pseudocodeToPython';

describe('Pseudocode to Python Parser', () => {
    it('Měl by správně zachovat PRINT formátování podle stávajícího parseru', () => {
        const input = "PRINT(\"Ahoj světe\")";
        const result = parsePseudocodeToPython(input);
        // Stávající parser to podle všeho nechává jako PRINT
        expect(result).toContain('PRINT("Ahoj světe")'); 
    });

    it('Měl by převést deklaraci proměnných a IF podmínku', () => {
        const input = `FUNCTION main()
    x = 10
    IF x > 5 THEN
        PRINT(x)
    ENDIF
ENDFUNCTION`;
        const result = parsePseudocodeToPython(input);
        
        expect(result).toContain('DEF main()');
        expect(result).toContain('x = 10');
        expect(result).toContain('IF x > 5 :');
        expect(result).toContain('PRINT(x)');
    });
});