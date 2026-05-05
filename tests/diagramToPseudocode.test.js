import { describe, it, expect } from 'vitest';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode';

describe('diagramToPseudocode', () => {
    it('převede propojený diagram na validní pseudokód', () => {
        const xml = `
        <mxGraphModel>
          <root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" type="START_END" mode="start" vertex="1" parent="1"><mxGeometry x="0" y="0"/></mxCell>
            <mxCell id="io1" value="x" type="IO" vertex="1" parent="1"><mxGeometry x="0" y="100"/></mxCell>
            <mxCell id="act1" value="x = x + 1" type="ACTION" vertex="1" parent="1"><mxGeometry x="0" y="200"/></mxCell>
            <mxCell id="end" value="ENDFUNCTION" type="START_END" mode="end" vertex="1" parent="1"><mxGeometry x="0" y="300"/></mxCell>
            <mxCell id="e1" source="start" target="io1" edge="1" parent="1"/>
            <mxCell id="e2" source="io1" target="act1" edge="1" parent="1"/>
            <mxCell id="e3" source="act1" target="end" edge="1" parent="1"/>
          </root>
        </mxGraphModel>
        `;
        
        const { code, errors } = parseDrawioToPseudocode(xml);
        expect(code).toContain('FUNCTION main()');
        expect(code).toContain('Vstup x'); // Parser musí automaticky doplnit 'Vstup', i když má blok hodnotu pouze 'x'
        expect(code).toContain('x = x + 1');
        expect(code).toContain('ENDFUNCTION');
        expect(errors.length).toBe(0);
    });

    it('zabalí plovoucí (nepropojené) bloky do funkcí jako fragmenty', () => {
        const xml = `
        <mxGraphModel>
          <root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="act1" value="y = 5" type="ACTION" vertex="1" parent="1"><mxGeometry x="100" y="100"/></mxCell>
          </root>
        </mxGraphModel>
        `;
        
        const { code, errors } = parseDrawioToPseudocode(xml);
        // Očekáváme, že izolovaný blok dostane vlastní 'fragment_1' funkci, aby nezamrzl synchronizační engine
        expect(code).toContain('FUNCTION fragment_1()');
        expect(code).toContain('y = 5');
        expect(code).toContain('ENDFUNCTION');
        expect(errors.length).toBeGreaterThan(0); // Systém musí vyhodit varování o neexistujícím startu
    });
});