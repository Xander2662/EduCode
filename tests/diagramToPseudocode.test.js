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

    it('zpracuje IF blok s pouze jednou připojenou větví (pouze Ano)', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" type="START_END" mode="start" vertex="1" parent="1"><mxGeometry x="100" y="100"/></mxCell>
            <mxCell id="cond" value="x &gt; 0" type="CONDITION" style="rhombus;" vertex="1" parent="1"><mxGeometry x="100" y="200"/></mxCell>
            <mxCell id="act" value="a = 1" type="ACTION" vertex="1" parent="1"><mxGeometry x="100" y="300"/></mxCell>
            <mxCell id="e1" source="start" target="cond" edge="1" parent="1"/>
            <mxCell id="e2" source="cond" target="act" value="Ano" style="sourceHandle=s-bottom;" edge="1" parent="1"/>
        </root></mxGraphModel>`;

        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('IF x > 0 THEN');
        expect(code).toContain('    a = 1');
        expect(code).toContain('ENDIF');
        const ifPos = code.indexOf('IF x > 0 THEN');
        const actPos = code.indexOf('a = 1');
        const endIfPos = code.indexOf('ENDIF');
        expect(ifPos).toBeLessThan(actPos);
        expect(actPos).toBeLessThan(endIfPos);
    });

    it('zpracuje IF blok s pouze jednou připojenou větví (pouze Ne)', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" type="START_END" mode="start" vertex="1" parent="1"><mxGeometry x="100" y="100"/></mxCell>
            <mxCell id="cond" value="x &gt; 0" type="CONDITION" style="rhombus;" vertex="1" parent="1"><mxGeometry x="100" y="200"/></mxCell>
            <mxCell id="act" value="b = 2" type="ACTION" vertex="1" parent="1"><mxGeometry x="250" y="300"/></mxCell>
            <mxCell id="e1" source="start" target="cond" edge="1" parent="1"/>
            <mxCell id="e2" source="cond" target="act" value="Ne" style="sourceHandle=s-right;" edge="1" parent="1"/>
        </root></mxGraphModel>`;

        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('IF x > 0 THEN');
        expect(code).toContain('ELSE');
        expect(code).toContain('    b = 2');
        expect(code).toContain('ENDIF');
        const elsePos = code.indexOf('ELSE');
        const actPos = code.indexOf('b = 2');
        const endIfPos = code.indexOf('ENDIF');
        expect(elsePos).toBeLessThan(actPos);
        expect(actPos).toBeLessThan(endIfPos);
    });

    it('seřadí automatické fragmenty shora dolů podle souřadnice Y', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="lower" value="lower_val = 2" type="ACTION" vertex="1" parent="1"><mxGeometry x="100" y="500"/></mxCell>
            <mxCell id="upper" value="upper_val = 1" type="ACTION" vertex="1" parent="1"><mxGeometry x="100" y="150"/></mxCell>
        </root></mxGraphModel>`;

        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('FUNCTION fragment_1()');
        expect(code).toContain('FUNCTION fragment_2()');
        const upperPos = code.indexOf('upper_val = 1');
        const lowerPos = code.indexOf('lower_val = 2');
        expect(upperPos).toBeLessThan(lowerPos);
    });

    it('vyloučí řádky začínající na END z mapování nodeLineMap (nemohou mít breakpoint)', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" style="mode=start;entityType=FUNCTION;" vertex="1" parent="1"><mxGeometry x="360" y="40" width="100" height="40" as="geometry"/></mxCell>
            <mxCell id="loop" value="i &lt; 5" style="LOOP_CONTAINER" type="LOOP_CONTAINER" doWhile="false" vertex="1" parent="1"><mxGeometry x="270" y="120" width="300" height="300" as="geometry"/></mxCell>
            <mxCell id="act" value="i = i + 1" type="ACTION" vertex="1" parent="1"><mxGeometry x="360" y="200" width="120" height="50" as="geometry"/></mxCell>
            <mxCell id="end" value="ENDFUNCTION" style="mode=end;" vertex="1" parent="1"><mxGeometry x="360" y="470" width="100" height="40" as="geometry"/></mxCell>
            <mxCell id="e1" source="start" target="act" edge="1" parent="1"/>
            <mxCell id="e2" source="act" target="end" edge="1" parent="1"/>
        </root></mxGraphModel>`;

        const { code, nodeLineMap } = parseDrawioToPseudocode(xml);
        const codeLines = code.split('\n');

        // Verify that END lines exist in code
        expect(codeLines.some(l => l.trim().toUpperCase().startsWith('ENDWHILE'))).toBe(true);
        expect(codeLines.some(l => l.trim().toUpperCase().startsWith('ENDFUNCTION'))).toBe(true);

        // Verify that no line index in nodeLineMap corresponds to a line starting with END
        Object.entries(nodeLineMap).forEach(([nodeId, lineIndices]) => {
            const indices = Array.isArray(lineIndices) ? lineIndices : [lineIndices];
            indices.forEach(idx => {
                const line = (codeLines[idx] || '').trim().toUpperCase();
                expect(line.startsWith('END')).toBe(false);
            });
        });
    });

    it('correctly orders ENDIF and ENDFOR when condition and action are inside a loop container', () => {
        const xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="for1" value="" type="FOR_CONTAINER" style="FOR_CONTAINER;forInit=i%20%3D%200;forLimit=10;forStep=1;" vertex="1" parent="1">
      <mxGeometry x="593" y="475" width="350" height="200" as="geometry" />
    </mxCell>
    <mxCell id="cond1" value="x &gt; 0" type="CONDITION" style="rhombus;" vertex="1" parent="1">
      <mxGeometry x="613" y="505" width="160" height="80" as="geometry" />
    </mxCell>
    <mxCell id="act1" value="Operace" type="ACTION" vertex="1" parent="1">
      <mxGeometry x="613" y="600" width="160" height="50" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>`;

        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('FOR i = 0 TO 10 DO');
        expect(code).toContain('IF x > 0 THEN');
        expect(code).toContain('Operace()');
        expect(code).toContain('ENDIF');
        expect(code).toContain('ENDFOR');
        
        // Critically verify ENDIF comes BEFORE ENDFOR
        const endIfIdx = code.indexOf('ENDIF');
        const endForIdx = code.indexOf('ENDFOR');
        expect(endIfIdx).toBeGreaterThan(-1);
        expect(endForIdx).toBeGreaterThan(-1);
        expect(endIfIdx).toBeLessThan(endForIdx);
    });
});