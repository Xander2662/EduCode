import { describe, it, expect } from 'vitest';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode.js';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram.js';
import { JSDOM } from 'jsdom';

// JSDOM setup for DOMParser in tests
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;

describe('While Group Roundtrip Tests (Pseudocode -> XML -> Pseudocode)', () => {

    it('Měl by správně zachovat sémantiku DO-WHILE cyklu a X pozice vnitřního bloku', () => {
        const diagramXml = `<mxGraphModel>
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start" value="main" style="mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="loop" value="x &gt; 0" style="LOOP_CONTAINER" type="LOOP_CONTAINER" doWhile="true" vertex="1" parent="1">
      <mxGeometry x="270" y="130" width="300" height="150" as="geometry" />
    </mxCell>
    <mxCell id="action" value="ACTION Operace 1" style="ioType=input;" vertex="1" parent="1">
      <mxGeometry x="450" y="160" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="end" value="ENDFUNCTION" style="mode=end;" vertex="1" parent="1">
      <mxGeometry x="360" y="310" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="e1" edge="1" parent="1" source="start" target="action" />
    <mxCell id="e2" edge="1" parent="1" source="action" target="end" />
  </root>
</mxGraphModel>`;

        const { code: pseudo } = parseDrawioToPseudocode(diagramXml);
        
        const { xml: secondXml } = parsePseudocodeToDrawio(pseudo, diagramXml, null, null, 'simple');
        
        const getXMap = (xmlStr) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlStr, "text/xml");
            const map = {};
            doc.querySelectorAll('mxCell[vertex="1"]').forEach(c => {
                const geo = c.querySelector('mxGeometry');
                const val = c.getAttribute('value') || '';
                if(geo && val) map[val.replace(/<[^>]*>?/gm, '').trim()] = parseFloat(geo.getAttribute('x'));
            });
            return map;
        };

        const firstLayout = getXMap(diagramXml);
        const secondLayout = getXMap(secondXml);

        expect(secondLayout['ACTION Operace 1']).toEqual(450);
        expect(secondLayout['x > 0']).toEqual(270);
    });

    it('Měl by detekovat redundantní bloky, oříznout je a nastavit doWhile=true', () => {
        // Zde doWhile=false, ale před cyklem je stejný blok jako uvnitř!
        const diagramXml = `<mxGraphModel>
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start" value="main" style="mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    
    <mxCell id="action_before" value="ACTION Operace 1" style="ioType=input;" vertex="1" parent="1">
      <mxGeometry x="360" y="100" width="120" height="50" as="geometry" />
    </mxCell>

    <mxCell id="loop" value="x &gt; 0" style="LOOP_CONTAINER" type="LOOP_CONTAINER" doWhile="false" vertex="1" parent="1">
      <mxGeometry x="270" y="200" width="300" height="150" as="geometry" />
    </mxCell>
    
    <mxCell id="action_inside" value="ACTION Operace 1" style="ioType=input;" vertex="1" parent="1">
      <mxGeometry x="360" y="250" width="120" height="50" as="geometry" />
    </mxCell>
    
    <mxCell id="end" value="ENDFUNCTION" style="mode=end;" vertex="1" parent="1">
      <mxGeometry x="360" y="400" width="100" height="40" as="geometry" />
    </mxCell>
    
    <mxCell id="e1" edge="1" parent="1" source="start" target="action_before" />
    <mxCell id="e2" edge="1" parent="1" source="action_before" target="action_inside" />
    <mxCell id="e3" edge="1" parent="1" source="action_inside" target="end" />
  </root>
</mxGraphModel>`;

        const { code: pseudo } = parseDrawioToPseudocode(diagramXml);
        
        // Z diagramu to pseudokódu by to mělo vygenerovat:
        // ACTION Operace 1
        // WHILE x > 0 DO
        //   ACTION Operace 1
        // ENDWHILE
        
        const { xml: secondXml } = parsePseudocodeToDrawio(pseudo, diagramXml, null, null, 'simple');
        
        // Zpět by to mělo poznat DO-WHILE:
        expect(secondXml).toContain('doWhile="true"');
        
        // A before blok by měl být oříznut, takže by měl existovat jen jeden blok ACTION Operace 1.
        const matches = secondXml.match(/value="ACTION Operace 1"/g);
        expect(matches.length).toBe(1);
    });

    it('Měl by správně zvládnout roundtrip pro WHILE skupinu s nepropojenými bloky uvnitř', () => {
        const diagramXml = `<mxGraphModel>
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start" value="main" style="mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    
    <mxCell id="loop" value="x &gt; 0" style="LOOP_CONTAINER" type="LOOP_CONTAINER" doWhile="false" vertex="1" parent="1">
      <mxGeometry x="270" y="130" width="300" height="220" as="geometry" />
    </mxCell>
    
    <mxCell id="action_connected" value="x = x + 1" style="ioType=input;" vertex="1" parent="1">
      <mxGeometry x="360" y="160" width="120" height="50" as="geometry" />
    </mxCell>
    
    <mxCell id="action_unconnected" value="y = 5" vertex="1" parent="1">
      <mxGeometry x="360" y="240" width="120" height="50" as="geometry" />
    </mxCell>
    
    <mxCell id="end" value="ENDFUNCTION" style="mode=end;" vertex="1" parent="1">
      <mxGeometry x="360" y="400" width="100" height="40" as="geometry" />
    </mxCell>
    
    <mxCell id="e1" edge="1" parent="1" source="start" target="action_connected" />
    <mxCell id="e2" edge="1" parent="1" source="action_connected" target="end" />
  </root>
</mxGraphModel>`;

        const { code: pseudo, errors } = parseDrawioToPseudocode(diagramXml);
        
        expect(errors.length).toBeLessThan(2);
        expect(pseudo).toContain('WHILE x > 0 DO');
        expect(pseudo).toContain('ENDWHILE');
        expect(pseudo).toContain('y = 5');
        expect(pseudo).toContain('x = x + 1');

        const { xml: secondXml } = parsePseudocodeToDrawio(pseudo, diagramXml, null, null, 'simple');
        
        expect(secondXml).toContain('value="y = 5"');
        expect(secondXml).toContain('value="x = x + 1"');
        expect(secondXml).toContain('type="LOOP_CONTAINER"');
    });
});
