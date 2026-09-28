import { describe, it, expect } from 'vitest';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram.js';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode.js';

describe('Switch Block parsing and generation', () => {
    it('should generate pseudocode to diagram and roundtrip cleanly', () => {
        const inputPseudo = `FUNCTION main()
SWITCH x
CASE 1:
y = 1
CASE 2:
y = 2
DEFAULT:
y = 3
ENDSWITCH
ENDFUNCTION`;
        
        const { xml } = parsePseudocodeToDrawio(inputPseudo);
        
        expect(xml).toContain('type="SWITCH_CONTAINER"');
        expect(xml).toContain('switchVar="x"');
        expect(xml).toContain('type="CASE_CONTAINER"');
        expect(xml).toContain('caseVal="1"');
        expect(xml).toContain('caseVal="2"');
        expect(xml).toContain('isDefault="true"');

        // Test roundback sync
        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('SWITCH x');
        expect(code).toContain('CASE 1:');
        expect(code).toContain('y = 1');
        expect(code).toContain('CASE 2:');
        expect(code).toContain('y = 2');
        expect(code).toContain('DEFAULT:');
        expect(code).toContain('y = 3');
        expect(code).toContain('ENDSWITCH');

        // Verify that cases are NOT printed under ENDSWITCH as ghost fragments
        const endswitchIdx = code.indexOf('ENDSWITCH');
        const afterEndswitch = code.substring(endswitchIdx);
        expect(afterEndswitch).not.toContain('CASE 1:');
        expect(afterEndswitch).not.toContain('CASE 2:');
        expect(afterEndswitch).not.toContain('DEFAULT:');
        expect(afterEndswitch).not.toContain('fragment_');
    });
});
