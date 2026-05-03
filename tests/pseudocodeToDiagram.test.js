import { describe, it, expect } from 'vitest';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';

describe('Pseudocode to Diagram Parser - Dynamic Y Auto-Layout', () => {
    it('Měl by dynamicky přepočítat a posunout Y pozice bloků, pokud dojde k odebrání řádku z kódu', () => {
        const initialCode = `FUNCTION main()
    Akce1()
    Akce2()
    Akce3()
ENDFUNCTION`;
        const result1 = parsePseudocodeToDrawio(initialCode);
        
        const modifiedCode = `FUNCTION main()
    Akce1()
    Akce3()
ENDFUNCTION`;
        const result2 = parsePseudocodeToDrawio(modifiedCode, result1.xml);
        
        const match1 = result1.xml.match(/value="Akce3\(\)"[\s\S]*?y="(\d+)"/);
        const match2 = result2.xml.match(/value="Akce3\(\)"[\s\S]*?y="(\d+)"/);
        
        const y1 = parseInt(match1[1]);
        const y2 = parseInt(match2[1]);
        
        expect(y2).toBeLessThan(y1);
    });

    it('Měl by správně transformovat samotný IO blok Vstup na INPUT varování', () => {
        const input = `FUNCTION main()
    Vstup
ENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);

        expect(result.xml).toContain('value="Vstup"');
        expect(result.xml).toContain('shape=parallelogram');
    });
});

describe('T/F Port Persistence', () => {
    it('Měl by zachovat uživatelsky prohozené T/F porty (True na s-right, False na s-bottom)', () => {
        // Simulujeme existující XML, kde uživatel ručně prohodil cesty tak, že "True" je na s-right a "False" na s-bottom
        const existingXml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="n1" value="x &gt; 0" type="CONDITION" vertex="1" parent="1"><mxGeometry x="360" y="200" width="120" height="60" as="geometry"/></mxCell>
            <mxCell id="e1" value="True" style="sourceHandle=s-right;" edge="1" parent="1" source="n1" target="n2" />
            <mxCell id="e2" value="False" style="sourceHandle=s-bottom;" edge="1" parent="1" source="n1" target="n3" />
        </root></mxGraphModel>`;
        
        const code = `FUNCTION main()
    IF x > 0 THEN
        PRINT("Kladne")
    ELSE
        PRINT("Zaporne")
    ENDIF
ENDFUNCTION`;
        
        // Převedeme pseudo -> diagram s pomocí historie z XML
        const result = parsePseudocodeToDrawio(code, existingXml);
        
        // Zkontrolujeme, zda generátor zachoval 's-right' port pro "True" cestu
        const trueEdgeMatch = result.xml.match(/value="True" style="[^"]*sourceHandle=([^;]+);/);
        const falseEdgeMatch = result.xml.match(/value="False" style="[^"]*sourceHandle=([^;]+);/);
        
        expect(trueEdgeMatch[1]).toBe('s-right');
        expect(falseEdgeMatch[1]).toBe('s-bottom');
    });
});