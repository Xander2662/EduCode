import { describe, it, expect } from 'vitest';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram.js';

describe('Switch Block parsing and generation', () => {
    it('should generate pseudocode to diagram', () => {
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
    });
});
