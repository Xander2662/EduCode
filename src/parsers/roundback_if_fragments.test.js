import { describe, it, expect } from 'vitest';
import { parsePseudocodeToDrawio } from './pseudocodeToDiagram.js';
import { parseDrawioToPseudocode } from './diagramToPseudocode.js';
import { drawioToReactFlow } from '../utils/diagramConverter.js';

describe('Roundback IF branches and Empty Fragment Deletion', () => {

    it('should omit empty fragment_x functions in diagramToPseudocode, but keep user-named empty functions', () => {
        // Construct XML with an empty fragment start and an empty user-named function start
        const xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start_empty_frag" value="fragment_2" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="200" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="start_user_func" value="my_func" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="500" y="40" width="100" height="40" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>`;

        const result = parseDrawioToPseudocode(xml);
        // Empty fragment_2 should be removed
        expect(result.code).not.toContain('FUNCTION fragment_2()');
        // Empty user-named function should be preserved
        expect(result.code).toContain('FUNCTION my_func()');
        expect(result.code).toContain('ENDFUNCTION');
    });

    it('should skip empty fragment_x in pseudocodeToDiagram, but parse empty user-named function', () => {
        const pseudo = `FUNCTION fragment_2()
ENDFUNCTION

FUNCTION custom_empty()
ENDFUNCTION`;

        const result = parsePseudocodeToDrawio(pseudo);
        // fragment_2 should NOT have nodes created
        expect(result.xml).not.toContain('value="fragment_2"');
        // custom_empty should have start node created
        expect(result.xml).toContain('value="custom_empty"');
    });

    it('should keep non-empty fragment_x functions', () => {
        const pseudo = `FUNCTION fragment_1()
    x = 10
ENDFUNCTION`;

        const drawioResult = parsePseudocodeToDrawio(pseudo);
        expect(drawioResult.xml).toContain('value="fragment_1"');
        expect(drawioResult.xml).toContain('value="x = 10"');

        const pseudoResult = parseDrawioToPseudocode(drawioResult.xml);
        expect(pseudoResult.code).toContain('FUNCTION fragment_1()');
        expect(pseudoResult.code).toContain('x = 10');
    });

    it('should preserve branch labels and condition flags when IF is roundbacked', () => {
        const pseudo = `FUNCTION main()
    IF x > 0 THEN
        y = 1
    ELSE
        y = 2
    ENDIF
ENDFUNCTION`;

        const drawioResult = parsePseudocodeToDrawio(pseudo);
        const xml = drawioResult.xml;

        const { nodes, edges } = drawioToReactFlow(xml);
        const condNode = nodes.find(n => n.type === 'CONDITION');
        expect(condNode).toBeDefined();

        const condEdges = edges.filter(e => e.source === condNode.id);
        expect(condEdges.length).toBe(2);

        // Both edges should have isCondition: true
        condEdges.forEach(e => {
            expect(e.data.isCondition).toBe(true);
            expect(['True', 'False']).toContain(e.data.label);
        });

        // Roundback to pseudocode
        const pseudoResult = parseDrawioToPseudocode(xml);
        expect(pseudoResult.code).toContain('IF x > 0 THEN');
        expect(pseudoResult.code).toContain('y = 1');
        expect(pseudoResult.code).toContain('ELSE');
        expect(pseudoResult.code).toContain('y = 2');
    });

    it('should preserve single branch IF and its swap state across roundback', () => {
        const pseudo = `FUNCTION main()
    IF x > 0 THEN
        y = 1
    ENDIF
ENDFUNCTION`;

        const drawioResult = parsePseudocodeToDrawio(pseudo);
        const xml = drawioResult.xml;

        const { nodes, edges } = drawioToReactFlow(xml);
        const condNode = nodes.find(n => n.type === 'CONDITION');
        expect(condNode).toBeDefined();

        const condEdges = edges.filter(e => e.source === condNode.id);
        expect(condEdges.length).toBeGreaterThanOrEqual(1);

        const trueEdge = condEdges.find(e => e.data.label === 'True');
        expect(trueEdge).toBeDefined();
        expect(trueEdge.data.isCondition).toBe(true);
    });

    it('should offset overlapping fragments to the right when they collide', () => {
        // Construct existingXml where fragment_1 and fragment_2 both have nodes at x=360, y=140
        const existingXml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="f1_start" value="fragment_1" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="f1_action" value="a = 1" style="whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
      <mxGeometry x="360" y="140" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="f2_start" value="fragment_2" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="f2_action" value="b = 2" style="whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
      <mxGeometry x="360" y="140" width="120" height="50" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>`;

        const pseudo = `FUNCTION fragment_1()
    a = 1
ENDFUNCTION

FUNCTION fragment_2()
    b = 2
ENDFUNCTION`;

        const result = parsePseudocodeToDrawio(pseudo, existingXml);
        const { nodes } = drawioToReactFlow(result.xml);

        const f1Nodes = nodes.filter(n => n.id === 'f1_start' || n.data?.label === 'a = 1' || n.data?.label === 'fragment_1');
        const f2Nodes = nodes.filter(n => n.id === 'f2_start' || n.data?.label === 'b = 2' || n.data?.label === 'fragment_2');

        expect(f1Nodes.length).toBeGreaterThan(0);
        expect(f2Nodes.length).toBeGreaterThan(0);

        // f1 should remain around x=360
        f1Nodes.forEach(n => {
            expect(n.position.x).toBeLessThan(500);
        });

        // f2 should be shifted dynamically to maxPrevRight + 40 (480 + 40 = 520)
        f2Nodes.forEach(n => {
            expect(n.position.x).toBeGreaterThanOrEqual(520);
        });
    });

    it('should retain swapped port for single branch IF and include isCondition in edge style across roundback', () => {
        // Condition node with a single True edge coming from s-right
        const existingXml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start1" value="main" style="ellipse;whiteSpace=wrap;html=1;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="cond1" value="x &gt; 0" style="shape=hexagon;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;isSwapped=true;" vertex="1" parent="1">
      <mxGeometry x="360" y="160" width="160" height="80" as="geometry" />
    </mxCell>
    <mxCell id="act1" value="y = 1" style="whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
      <mxGeometry x="600" y="160" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="e_start" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;sourceHandle=s-bottom;targetHandle=t-top;" edge="1" parent="1" source="start1" target="cond1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e_true" value="True" style="edgeStyle=orthogonalEdgeStyle;rounded=0;isCondition=true;sourceHandle=s-right;targetHandle=t-top;" edge="1" parent="1" source="cond1" target="act1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>`;

        const pseudo = `FUNCTION main()
    IF x > 0 THEN
        y = 1
    ENDIF
ENDFUNCTION`;

        const result = parsePseudocodeToDrawio(pseudo, existingXml);
        expect(result.xml).toContain('isCondition=true;');
        
        const { edges } = drawioToReactFlow(result.xml);
        const condEdge = edges.find(e => e.source === 'cond1');
        expect(condEdge).toBeDefined();
        expect(condEdge.sourceHandle).toBe('s-right');
        expect(condEdge.data.isCondition).toBe(true);
        expect(condEdge.data.label).toBe('True');
    });

    it('should keep original coordinates when fragments are vertically separated without overlap', () => {
        // fragment_1 is at y=40..190, fragment_2 is at y=400..550
        const existingXml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="f1_start" value="fragment_1" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="f1_action" value="a = 1" style="whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
      <mxGeometry x="360" y="140" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="f2_start" value="fragment_2" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="400" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="f2_action" value="b = 2" style="whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
      <mxGeometry x="360" y="500" width="120" height="50" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>`;

        const pseudo = `FUNCTION fragment_1()
    a = 1
ENDFUNCTION

FUNCTION fragment_2()
    b = 2
ENDFUNCTION`;

        const result = parsePseudocodeToDrawio(pseudo, existingXml);
        const { nodes } = drawioToReactFlow(result.xml);

        const f2Action = nodes.find(n => n.data?.label === 'b = 2');
        expect(f2Action).toBeDefined();
        // Since there is no overlap in Y, X should remain 360 and Y should remain 500
        expect(f2Action.position.x).toBe(360);
        expect(f2Action.position.y).toBe(500);
    });

});

