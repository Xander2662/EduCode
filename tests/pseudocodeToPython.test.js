import { describe, it, expect } from 'vitest';
import { parsePseudocodeToPython } from '../src/parsers/pseudocodeToPython';

describe('pseudocodeToPython parser', () => {
    
    it('should generate a simple sequence from pseudocode', () => {
        const pseudocode = `FUNCTION main()
    x = 10
    PRINT("Hello")
ENDFUNCTION`;
        
        const res = parsePseudocodeToPython(pseudocode);
        expect(res).toContain('def main():');
        expect(res).toContain('    x = 10');
        expect(res).toContain('    print("Hello")');
        expect(res).toContain("if __name__ == '__main__':\n    main()");
    });

    it('should translate IF logic with empty blocks into pass', () => {
        const pseudocode = `FUNCTION main()
    IF x > 5 THEN
    ELSE
    ENDIF
ENDFUNCTION`;

        const res = parsePseudocodeToPython(pseudocode);
        expect(res).toContain('if x > 5:');
        expect(res).toContain('    pass');
        expect(res).toContain('else:');
    });

    it('should format IO nodes correctly', () => {
        const pseudocode = `FUNCTION main()
    VSTUP x, y
    PRINT(z)
ENDFUNCTION`;

        const res = parsePseudocodeToPython(pseudocode);
        expect(res).toContain('    x = input()');
        expect(res).toContain('    y = input()');
        expect(res).toContain('    print(z)');
    });

    it('should correctly decrease indent levels on END markers', () => {
        const pseudocode = `FUNCTION main()
    WHILE True DO
        x = 5
    ENDWHILE
    PRINT(x)
ENDFUNCTION`;

        const res = parsePseudocodeToPython(pseudocode);
        expect(res).toContain('    while True:');
        expect(res).toContain('        x = 5');
        expect(res).toContain('    print(x)');
    });
});