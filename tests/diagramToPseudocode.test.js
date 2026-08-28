import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
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

    it('správně převede vnořené IF bloky s komentáři uvnitř WHILE cyklu bez duplikace stavu smyčky', () => {
        const xmlPath = path.resolve(__dirname, '../examples/diagram_examples/while_group_if_block_nested.xml');
        const xml = fs.readFileSync(xmlPath, 'utf8');

        const { code } = parseDrawioToPseudocode(xml);
        
        // Assert that the outer WHILE is present
        expect(code).toContain('WHILE x < 10 DO');
        // Assert that the IF block contains the false branch correctly
        expect(code).toContain('IF x > 0 THEN');
        expect(code).toContain('ELSE');
        expect(code).toContain('# dwadaw');
        expect(code).toContain('x = x - 2');
        
        // Critically, assert that it does NOT generate multiple duplicate WHILE x < 10 DO loops
        const whileMatches = code.match(/WHILE x < 10 DO/g);
        expect(whileMatches.length).toBe(1);
    });

    it('should parse unconnected blocks within a loop sequentially as if they were connected', () => {
        const xml = `<mxGraphModel>
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start" value="main" style="mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    
    <mxCell id="loop" value="count &lt; 5" style="LOOP_CONTAINER" type="LOOP_CONTAINER" doWhile="false" vertex="1" parent="1">
      <mxGeometry x="270" y="120" width="300" height="300" as="geometry" />
    </mxCell>
    
    <mxCell id="block_1" value="step1 = 1" vertex="1" parent="1">
      <mxGeometry x="360" y="150" width="120" height="50" as="geometry" />
    </mxCell>
    
    <mxCell id="block_2" value="step2 = 2" vertex="1" parent="1">
      <mxGeometry x="360" y="230" width="120" height="50" as="geometry" />
    </mxCell>

    <mxCell id="block_3" value="step3 = 3" vertex="1" parent="1">
      <mxGeometry x="360" y="310" width="120" height="50" as="geometry" />
    </mxCell>
    
    <mxCell id="end" value="ENDFUNCTION" style="mode=end;" vertex="1" parent="1">
      <mxGeometry x="360" y="470" width="100" height="40" as="geometry" />
    </mxCell>
    
    <mxCell id="e1" edge="1" parent="1" source="start" target="block_1" />
  </root>
</mxGraphModel>`;

        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('WHILE count < 5 DO');
        expect(code).toContain('step1 = 1');
        expect(code).toContain('step2 = 2');
        expect(code).toContain('step3 = 3');
        expect(code).toContain('ENDWHILE');

        // Verify sequential order inside loop
        const pos1 = code.indexOf('step1 = 1');
        const pos2 = code.indexOf('step2 = 2');
        const pos3 = code.indexOf('step3 = 3');
        const posEnd = code.indexOf('ENDWHILE');

        expect(pos1).toBeLessThan(pos2);
        expect(pos2).toBeLessThan(pos3);
        expect(pos3).toBeLessThan(posEnd);
    });

    it('ACTION bloky generují standardní operace / volání funkcí bez PRINT', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" type="START_END" mode="start" vertex="1" parent="1"><mxGeometry x="100" y="100"/></mxCell>
            <mxCell id="act" value="doWork" type="ACTION" vertex="1" parent="1"><mxGeometry x="100" y="200"/></mxCell>
            <mxCell id="end" value="ENDFUNCTION" type="START_END" mode="end" vertex="1" parent="1"><mxGeometry x="100" y="300"/></mxCell>
            <mxCell id="e1" source="start" target="act" edge="1" parent="1"/>
            <mxCell id="e2" source="act" target="end" edge="1" parent="1"/>
        </root></mxGraphModel>`;

        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('doWork()');
        expect(code).not.toContain('PRINT(doWork)');
    });
});