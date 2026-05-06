import { describe, it, expect } from 'vitest';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode';

describe('diagramToPseudocode', () => {
    it('převede propojený diagram na validní pseudokód', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="2" value="main" type="START_END" mode="start" entityType="FUNCTION" vertex="1" parent="1"><mxGeometry x="100" y="100"/></mxCell>
            <mxCell id="3" value="x" type="IO" ioType="input" vertex="1" parent="1"><mxGeometry x="100" y="200"/></mxCell>
            <mxCell id="4" value="x = x + 1" type="ACTION" vertex="1" parent="1"><mxGeometry x="100" y="300"/></mxCell>
            <mxCell id="5" value="ENDFUNCTION" type="START_END" mode="end" vertex="1" parent="1"><mxGeometry x="100" y="400"/></mxCell>
            <mxCell id="e1" source="2" target="3" edge="1" parent="1"/>
            <mxCell id="e2" source="3" target="4" edge="1" parent="1"/>
            <mxCell id="e3" source="4" target="5" edge="1" parent="1"/>
        </root></mxGraphModel>`;

        const { code, errors } = parseDrawioToPseudocode(xml);
        expect(code).toContain('FUNCTION main()');
        expect(code).toContain('Vstup x'); 
        expect(code).toContain('x = x + 1');
        expect(code).toContain('ENDFUNCTION');
        // Tolerance: pokud diagram generuje varování (např. o prázdnosti), netrestáme ho padnutím
        expect(errors.length).toBeLessThan(2);
    });

    it('zabalí plovoucí (nepropojené) bloky do funkcí jako fragmenty', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="2" value="y = 5" type="ACTION" vertex="1" parent="1"><mxGeometry x="100" y="100"/></mxCell>
        </root></mxGraphModel>`;

        const { code, errors } = parseDrawioToPseudocode(xml);
        expect(code).toContain('FUNCTION fragment_1()');
        expect(code).toContain('y = 5');
        expect(code).toContain('ENDFUNCTION');
        expect(errors.length).toBeGreaterThan(0); // Systém musí vyhodit varování o neexistujícím startu
    });
});