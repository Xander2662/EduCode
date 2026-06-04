import { describe, it, expect } from 'vitest';
import { parsePythonToPseudocode } from '../src/parsers/pythonToPseudocode';

describe('pythonToPseudocode parser', () => {
    
    it('should generate basic pseudocode blocks', () => {
        const python = `def main():
    x = 10
    print("Hello")`;
        
        const res = parsePythonToPseudocode(python);
        expect(res).toContain('FUNCTION main()');
        expect(res).toContain('    x = 10');
        expect(res).toContain('    PRINT("Hello")');
        expect(res).toContain('ENDFUNCTION');
    });

    it('should correctly track and close IF/ELSE scopes', () => {
        const python = `def check():
    if x > 5:
        print("high")
    else:
        print("low")`;

        const res = parsePythonToPseudocode(python);
        expect(res).toContain('FUNCTION check()');
        expect(res).toContain('    IF x > 5 THEN');
        expect(res).toContain('        PRINT("high")');
        expect(res).toContain('    ELSE');
        expect(res).toContain('        PRINT("low")');
        expect(res).toContain('    ENDIF');
        expect(res).toContain('ENDFUNCTION');
    });

    it('should expand elif into nested IF scopes', () => {
        const python = `def check():
    if x > 5:
        print("high")
    elif x < 0:
        print("negative")
    else:
        print("low")`;

        const res = parsePythonToPseudocode(python);
        expect(res).toContain('    IF x > 5 THEN');
        expect(res).toContain('    ELSE');
        expect(res).toContain('        IF x < 0 THEN');
        expect(res).toContain('        ELSE');
        expect(res).toContain('            PRINT("low")');
        
        // Should have two ENDIFs
        const endIfCount = (res.match(/ENDIF/g) || []).length;
        expect(endIfCount).toBe(2);
    });

    it('should format IO and ignore boilerplate', () => {
        const python = `def main():
    x = input()
    
if __name__ == '__main__':
    main()`;

        const res = parsePythonToPseudocode(python);
        expect(res).toContain('    VSTUP x');
        expect(res).not.toContain('__main__'); // Should be skipped
    });

});
