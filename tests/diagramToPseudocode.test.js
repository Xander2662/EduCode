import { describe, it, expect } from 'vitest';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode';

describe('Diagram to Pseudocode Parser - Core functionality', () => {
    it('Měl by převést základní diagram na pseudokód main funkce', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="n1" value="main" style="ellipse;" vertex="1" parent="1"><mxGeometry x="0" y="0" as="geometry"/></mxCell>
            <mxCell id="n2" value="ENDFUNCTION" style="ellipse;" vertex="1" parent="1"><mxGeometry x="0" y="100" as="geometry"/></mxCell>
            <mxCell id="e1" edge="1" parent="1" source="n1" target="n2" />
        </root></mxGraphModel>`;
        
        const result = parseDrawioToPseudocode(xml);
        expect(result.code).toContain('FUNCTION main()');
        expect(result.code).toContain('ENDFUNCTION');
    });
});

describe('Diagram to Pseudocode Parser - Semantic Scope Checker', () => {
    it('Měl by vyhodit chybu, pokud je proměnná použita v podmínce před deklarací', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="n1" value="main" style="ellipse;" vertex="1" parent="1"><mxGeometry x="0" y="0" as="geometry"/></mxCell>
            <mxCell id="n2" value="neznama &gt; 0" style="rhombus;" vertex="1" parent="1"><mxGeometry x="0" y="100" as="geometry"/></mxCell>
            <mxCell id="n3" value="ENDFUNCTION" style="ellipse;" vertex="1" parent="1"><mxGeometry x="0" y="200" as="geometry"/></mxCell>
            <mxCell id="e1" edge="1" parent="1" source="n1" target="n2" />
            <mxCell id="e2" value="True" edge="1" parent="1" source="n2" target="n3" />
        </root></mxGraphModel>`;
        
        const result = parseDrawioToPseudocode(xml);
        expect(result.errors.some(e => e.includes('Proměnná \'neznama\' byla použita před deklarací'))).toBe(true);
    });

    it('Měl by vyhodit chybu, pokud se použije proměnná mimo svůj IF scope', () => {
        // Zde deklarujeme 'lokalniProm' v IF bloku, ale použijeme ji po ENDIF. To by mělo hlásit chybu.
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="n1" value="main" style="ellipse;" vertex="1" parent="1"><mxGeometry x="0" y="0" as="geometry"/></mxCell>
            <mxCell id="n2" value="x &gt; 0" style="rhombus;" vertex="1" parent="1"><mxGeometry x="0" y="100" as="geometry"/></mxCell>
            <mxCell id="n3" value="lokalniProm = 5" style="whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="-100" y="200" as="geometry"/></mxCell>
            <mxCell id="n4" value="PRINT(lokalniProm)" style="whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="0" y="300" as="geometry"/></mxCell>
            
            <mxCell id="e1" edge="1" parent="1" source="n1" target="n2" />
            <mxCell id="e2" value="True" edge="1" parent="1" source="n2" target="n3" />
            <mxCell id="e3" value="False" edge="1" parent="1" source="n2" target="n4" />
            <mxCell id="e4" edge="1" parent="1" source="n3" target="n4" />
        </root></mxGraphModel>`;
        
        const result = parseDrawioToPseudocode(xml);
        expect(result.errors.some(e => e.includes('Proměnná \'lokalniProm\' byla použita před deklarací'))).toBe(true);
    });
});