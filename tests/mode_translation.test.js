import { describe, it, expect } from 'vitest';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode.js';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram.js';
import { drawioToReactFlow } from '../src/utils/diagramConverter.js';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;

describe('Mode Translation (Simple <-> Advanced) and Y-Order Container Wiring', () => {

    it('should connect multiple identical blocks inside WHILE container strictly from top to bottom based on Y coord', () => {
        // XML with 2 identical "Operace" action blocks where the BOTTOM block (y=260) appears FIRST in DOM order
        // before the TOP block (y=160).
        const xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start1" value="fragment_1" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="while1" value="Podmínka" style="swimlane;LOOP_CONTAINER" type="LOOP_CONTAINER" vertex="1" parent="1">
      <mxGeometry x="270" y="110" width="300" height="240" as="geometry" />
    </mxCell>
    <!-- Notice bottomBlock (y=260) is listed FIRST in XML -->
    <mxCell id="bottomBlock" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="360" y="260" width="120" height="50" as="geometry" />
    </mxCell>
    <!-- topBlock (y=160) is listed SECOND in XML -->
    <mxCell id="topBlock" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="360" y="160" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="end1" value="ENDFUNCTION" style="ellipse;mode=end;" vertex="1" parent="1">
      <mxGeometry x="360" y="400" width="100" height="40" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>`;

        // Parse to pseudocode
        const { code: pseudo } = parseDrawioToPseudocode(xml);
        expect(pseudo).toContain('FUNCTION fragment_1()');
        expect(pseudo).toContain('WHILE Podmínka DO');
        expect(pseudo).toContain('Operace');
        expect(pseudo).toContain('ENDWHILE');

        // Sync back to Diagram XML with existingXml passed
        const { xml: roundXml } = parsePseudocodeToDrawio(pseudo, xml, 'true-false', 'hexagon', 'simple');
        const { edges } = drawioToReactFlow(roundXml);

        // Verify connections:
        // 1. start1 should connect to topBlock (y=160), NOT bottomBlock!
        const edgeFromStart = edges.find(e => e.source === 'start1');
        expect(edgeFromStart).toBeDefined();
        expect(edgeFromStart.target).toBe('topBlock');

        // 2. topBlock (y=160) should connect to bottomBlock (y=260)
        const edgeBetween = edges.find(e => e.source === 'topBlock');
        expect(edgeBetween).toBeDefined();
        expect(edgeBetween.target).toBe('bottomBlock');

        // 3. bottomBlock (y=260) should connect to end1
        const edgeToEnd = edges.find(e => e.source === 'bottomBlock');
        expect(edgeToEnd).toBeDefined();
        expect(edgeToEnd.target).toBe('end1');
    });

    it('should translate SWITCH from simple to advanced mode into chained CONDITION blocks', () => {
        const pseudo = `FUNCTION main()
SWITCH x
CASE 1:
    y = 10
CASE 2:
    y = 20
DEFAULT:
    y = 30
ENDSWITCH
ENDFUNCTION`;

        // Advanced mode: should NOT create SWITCH_CONTAINER or CASE_CONTAINER
        const { xml } = parsePseudocodeToDrawio(pseudo, null, 'true-false', 'hexagon', 'advanced');
        expect(xml).not.toContain('SWITCH_CONTAINER');
        expect(xml).not.toContain('CASE_CONTAINER');

        // Should create CONDITION nodes for cases
        expect(xml).toContain('value="x == 1"');
        expect(xml).toContain('value="x == 2"');

        const { nodes, edges } = drawioToReactFlow(xml);
        const cond1 = nodes.find(n => n.data?.label === 'x == 1');
        const cond2 = nodes.find(n => n.data?.label === 'x == 2');
        const act1 = nodes.find(n => n.data?.label === 'y = 10');
        const act2 = nodes.find(n => n.data?.label === 'y = 20');
        const act3 = nodes.find(n => n.data?.label === 'y = 30');

        expect(cond1).toBeDefined();
        expect(cond2).toBeDefined();
        expect(act1).toBeDefined();
        expect(act2).toBeDefined();
        expect(act3).toBeDefined();

        // cond1 True branch should lead to act1
        const edgeC1True = edges.find(e => e.source === cond1.id && (e.data?.label === 'True' || e.sourceHandle === 's-bottom'));
        expect(edgeC1True?.target).toBe(act1.id);

        // cond1 False branch should lead to cond2
        const edgeC1False = edges.find(e => e.source === cond1.id && (e.data?.label === 'False' || e.sourceHandle === 's-right'));
        expect(edgeC1False?.target).toBe(cond2.id);

        // cond2 True branch should lead to act2
        const edgeC2True = edges.find(e => e.source === cond2.id && (e.data?.label === 'True' || e.sourceHandle === 's-bottom'));
        expect(edgeC2True?.target).toBe(act2.id);

        // cond2 False branch should lead to act3 (DEFAULT)
        const edgeC2False = edges.find(e => e.source === cond2.id && (e.data?.label === 'False' || e.sourceHandle === 's-right'));
        expect(edgeC2False?.target).toBe(act3.id);
    });

    it('should detect advanced chained CONDITION blocks and convert back to SWITCH in pseudocode and simple mode', () => {
        const advancedXml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start1" value="main" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="c1" value="x == 1" style="rhombus;" vertex="1" parent="1">
      <mxGeometry x="360" y="120" width="160" height="80" as="geometry" />
    </mxCell>
    <mxCell id="a1" value="y = 10" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="360" y="240" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="c2" value="x == 2" style="rhombus;" vertex="1" parent="1">
      <mxGeometry x="600" y="120" width="160" height="80" as="geometry" />
    </mxCell>
    <mxCell id="a2" value="y = 20" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="600" y="240" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="a3" value="y = 30" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="840" y="240" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="end1" value="ENDFUNCTION" style="ellipse;mode=end;" vertex="1" parent="1">
      <mxGeometry x="480" y="360" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="e_start" edge="1" parent="1" source="start1" target="c1" />
    <mxCell id="e_c1_t" edge="1" parent="1" source="c1" target="a1" value="True" style="sourceHandle=s-bottom;" />
    <mxCell id="e_c1_f" edge="1" parent="1" source="c1" target="c2" value="False" style="sourceHandle=s-right;" />
    <mxCell id="e_c2_t" edge="1" parent="1" source="c2" target="a2" value="True" style="sourceHandle=s-bottom;" />
    <mxCell id="e_c2_f" edge="1" parent="1" source="c2" target="a3" value="False" style="sourceHandle=s-right;" />
    <mxCell id="e_a1_end" edge="1" parent="1" source="a1" target="end1" />
    <mxCell id="e_a2_end" edge="1" parent="1" source="a2" target="end1" />
    <mxCell id="e_a3_end" edge="1" parent="1" source="a3" target="end1" />
  </root>
</mxGraphModel>`;

        // Parse to pseudocode: should recognize SWITCH x
        const { code: pseudo } = parseDrawioToPseudocode(advancedXml);
        expect(pseudo).toContain('SWITCH x');
        expect(pseudo).toContain('CASE 1:');
        expect(pseudo).toContain('y = 10');
        expect(pseudo).toContain('CASE 2:');
        expect(pseudo).toContain('y = 20');
        expect(pseudo).toContain('DEFAULT:');
        expect(pseudo).toContain('y = 30');
        expect(pseudo).toContain('ENDSWITCH');

        // Now translate to simple mode: should produce SWITCH_CONTAINER and CASE_CONTAINER
        const { xml: simpleXml } = parsePseudocodeToDrawio(pseudo, null, 'true-false', 'hexagon', 'simple');
        expect(simpleXml).toContain('type="SWITCH_CONTAINER"');
        expect(simpleXml).toContain('type="CASE_CONTAINER"');

        const { nodes } = drawioToReactFlow(simpleXml);
        const cases = nodes.filter(n => n.type === 'CASE_CONTAINER');
        expect(cases.length).toBe(3);

        // Verify cases do not overlap (each case has distinct x position separated by >= 250px)
        const xCoords = cases.map(c => c.position.x).sort((a, b) => a - b);
        expect(xCoords[1] - xCoords[0]).toBeGreaterThanOrEqual(250);
        expect(xCoords[2] - xCoords[1]).toBeGreaterThanOrEqual(250);
    });

    it('should properly enclose body blocks within container bounds when converting to simple mode', () => {
        const pseudo = `FUNCTION main()
WHILE i < 10 DO
    a = 1
    b = 2
ENDWHILE
ENDFUNCTION`;

        const { xml } = parsePseudocodeToDrawio(pseudo, null, 'true-false', 'hexagon', 'simple');
        const { nodes } = drawioToReactFlow(xml);

        const container = nodes.find(n => n.type === 'LOOP_CONTAINER');
        const aNode = nodes.find(n => n.data?.label === 'a = 1');
        const bNode = nodes.find(n => n.data?.label === 'b = 2');

        expect(container).toBeDefined();
        expect(aNode).toBeDefined();
        expect(bNode).toBeDefined();

        const cX = container.position.x;
        const cY = container.position.y;
        const cW = container.style.width;
        const cH = container.style.height;

        // Verify body nodes are within container bounds
        expect(aNode.position.x).toBeGreaterThanOrEqual(cX);
        expect(aNode.position.x + 120).toBeLessThanOrEqual(cX + cW);
        expect(aNode.position.y).toBeGreaterThanOrEqual(cY);
        expect(aNode.position.y + 50).toBeLessThanOrEqual(cY + cH);

        expect(bNode.position.x).toBeGreaterThanOrEqual(cX);
        expect(bNode.position.x + 120).toBeLessThanOrEqual(cX + cW);
        expect(bNode.position.y).toBeGreaterThanOrEqual(cY);
        expect(bNode.position.y + 50).toBeLessThanOrEqual(cY + cH);
    });

    it('should translate WHILE loop from simple container to advanced condition with loopback and back', () => {
        const simplePseudo = `FUNCTION main()
WHILE x > 0 DO
    x = x - 1
ENDWHILE
ENDFUNCTION`;

        // Simple -> Advanced
        const { xml: advXml } = parsePseudocodeToDrawio(simplePseudo, null, 'true-false', 'hexagon', 'advanced');
        expect(advXml).not.toContain('LOOP_CONTAINER');
        expect(advXml).toContain('value="x &gt; 0"'); // CONDITION block
        expect(advXml).toContain('value="x = x - 1"');

        const { nodes: advNodes, edges: advEdges } = drawioToReactFlow(advXml);
        const condNode = advNodes.find(n => n.type === 'CONDITION');
        const actNode = advNodes.find(n => n.data?.label === 'x = x - 1');
        expect(condNode).toBeDefined();
        expect(actNode).toBeDefined();

        // Edge from condition (True) to actNode
        const trueEdge = advEdges.find(e => e.source === condNode.id && (e.data?.label === 'True' || e.sourceHandle === 's-bottom'));
        expect(trueEdge?.target).toBe(actNode.id);

        // Back edge from actNode to condNode
        const backEdge = advEdges.find(e => e.source === actNode.id && e.target === condNode.id);
        expect(backEdge).toBeDefined();

        // Advanced -> Pseudocode
        const { code: pseudoBack } = parseDrawioToPseudocode(advXml);
        expect(pseudoBack).toContain('WHILE x > 0 DO');
        expect(pseudoBack).toContain('x = x - 1');
        expect(pseudoBack).toContain('ENDWHILE');

        // Pseudocode -> Simple
        const { xml: backSimpleXml } = parsePseudocodeToDrawio(pseudoBack, null, 'true-false', 'hexagon', 'simple');
        expect(backSimpleXml).toContain('type="LOOP_CONTAINER"');
        expect(backSimpleXml).toContain('value="x = x - 1"');
    });

    it('should translate FOR loop from simple container to advanced init+cond+increment and back', () => {
        const simplePseudo = `FUNCTION main()
FOR i = 0 TO 5 DO
    PRINT(i)
ENDFOR
ENDFUNCTION`;

        // Simple -> Advanced
        const { xml: advXml } = parsePseudocodeToDrawio(simplePseudo, null, 'true-false', 'hexagon', 'advanced');
        expect(advXml).not.toContain('FOR_CONTAINER');
        expect(advXml).toContain('i = 0');
        expect(advXml).toContain('i &lt;= 5');
        expect(advXml).toContain('i = i + 1');

        // Advanced -> Pseudocode: semantic detector recovers FOR loop
        const { code: pseudoBack } = parseDrawioToPseudocode(advXml);
        expect(pseudoBack).toContain('FOR i = 0 TO 5 DO');
        expect(pseudoBack).not.toMatch(/^i = 0$/m);
        expect(pseudoBack).not.toMatch(/^i = i \+ 1$/m);

        // Pseudocode -> Simple container
        const { xml: backSimpleXml } = parsePseudocodeToDrawio(pseudoBack, null, 'true-false', 'hexagon', 'simple');
        expect(backSimpleXml).toContain('type="FOR_CONTAINER"');
        expect(backSimpleXml).toContain('forInit="i%20%3D%200"');
    });

    it('should horizontally center WHILE container over its child blocks when switching from advanced to simple mode', () => {
        // Advanced mode pseudocode translated to simple mode
        const pseudo = `FUNCTION main()
WHILE x > 0 DO
    Operace()
    Operace()
ENDWHILE
ENDFUNCTION`;

        // Switch to simple mode (null existingXml -> newly created container)
        const { xml } = parsePseudocodeToDrawio(pseudo, null, 'true-false', 'hexagon', 'simple');
        const { nodes } = drawioToReactFlow(xml);

        const container = nodes.find(n => n.type === 'LOOP_CONTAINER');
        const children = nodes.filter(n => n.data?.label === 'Operace');
        expect(container).toBeDefined();
        expect(children.length).toBe(2);

        const minX = Math.min(...children.map(c => c.position.x));
        const maxX = Math.max(...children.map(c => c.position.x + 160));
        const childrenCenterX = (minX + maxX) / 2;
        const containerCenterX = container.position.x + container.style.width / 2;

        // Container must be horizontally centered over children
        expect(Math.abs(containerCenterX - childrenCenterX)).toBeLessThan(2);
    });

    it('should sequentially iterate fragment names (fragment_1, fragment_2, fragment_3) when XML has duplicate names', () => {
        // XML with 3 clusters all having start node value="fragment_1"
        const xml = `<mxGraphModel dx="1000" dy="1000" grid="1">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <!-- Cluster 1 at x=350 -->
    <mxCell id="s1" value="fragment_1" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="350" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="a1" value="A = 1" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="350" y="120" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="e1" edge="1" parent="1" source="s1" target="a1"><mxGeometry relative="1" as="geometry" /></mxCell>

    <!-- Cluster 2 at x=900 with duplicate fragment_1 -->
    <mxCell id="s2" value="fragment_1" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="900" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="a2" value="B = 2" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="900" y="120" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="e2" edge="1" parent="1" source="s2" target="a2"><mxGeometry relative="1" as="geometry" /></mxCell>

    <!-- Cluster 3 at x=1500 with duplicate fragment_1 -->
    <mxCell id="s3" value="fragment_1" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="1500" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="a3" value="C = 3" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="1500" y="120" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="e3" edge="1" parent="1" source="s3" target="a3"><mxGeometry relative="1" as="geometry" /></mxCell>
  </root>
</mxGraphModel>`;

        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('FUNCTION fragment_1()');
        expect(code).toContain('FUNCTION fragment_2()');
        expect(code).toContain('FUNCTION fragment_3()');

        // Verify there are no duplicate function declarations
        const matches = code.match(/FUNCTION fragment_\d+\(\)/g);
        expect(matches).toEqual(['FUNCTION fragment_1()', 'FUNCTION fragment_2()', 'FUNCTION fragment_3()']);
    });

    it('should not melt distant fragments into each other when switching editorMode', () => {
        // Multi-fragment setup mimicking the user log:
        // Fragment 1 (simple mode while group) at x ~ 350-500
        // Fragment 2 (simple mode while group) at x ~ 1000
        // Fragment 3 (advanced mode condition + actions) at x ~ 2000
        const xml = `<mxGraphModel dx="1000" dy="1000" grid="1">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <!-- Fragment 1 at x=400 -->
    <mxCell id="f1_start" value="fragment_1" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="400" y="100" width="180" height="50" as="geometry" />
    </mxCell>
    <mxCell id="f1_while" value="x &gt; 0" style="swimlane;LOOP_CONTAINER;" type="LOOP_CONTAINER" vertex="1" parent="1">
      <mxGeometry x="350" y="180" width="350" height="200" as="geometry" />
    </mxCell>
    <mxCell id="f1_a1" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="400" y="240" width="160" height="50" as="geometry" />
    </mxCell>
    <mxCell id="e_f1" edge="1" parent="1" source="f1_start" target="f1_a1"><mxGeometry relative="1" as="geometry" /></mxCell>

    <!-- Fragment 2 at x=1000 -->
    <mxCell id="f2_start" value="fragment_2" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="1000" y="100" width="180" height="50" as="geometry" />
    </mxCell>
    <mxCell id="f2_while" value="" style="swimlane;LOOP_CONTAINER;" type="LOOP_CONTAINER" vertex="1" parent="1">
      <mxGeometry x="950" y="180" width="350" height="200" as="geometry" />
    </mxCell>
    <mxCell id="f2_a1" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="1000" y="240" width="160" height="50" as="geometry" />
    </mxCell>
    <mxCell id="e_f2" edge="1" parent="1" source="f2_start" target="f2_a1"><mxGeometry relative="1" as="geometry" /></mxCell>

    <!-- Fragment 3 at x=2000 (condition x > 0) -->
    <mxCell id="f3_start" value="fragment_3" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="2000" y="100" width="180" height="50" as="geometry" />
    </mxCell>
    <mxCell id="f3_cond" value="x &gt; 0" style="rhombus;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="2000" y="180" width="160" height="80" as="geometry" />
    </mxCell>
    <mxCell id="f3_a1" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="2000" y="300" width="160" height="50" as="geometry" />
    </mxCell>
    <mxCell id="e_f3_1" edge="1" parent="1" source="f3_start" target="f3_cond"><mxGeometry relative="1" as="geometry" /></mxCell>
    <mxCell id="e_f3_2" edge="1" parent="1" source="f3_cond" target="f3_a1"><mxGeometry relative="1" as="geometry" /></mxCell>
  </root>
</mxGraphModel>`;

        // Convert XML to pseudocode
        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('FUNCTION fragment_1()');
        expect(code).toContain('FUNCTION fragment_2()');
        expect(code).toContain('FUNCTION fragment_3()');

        // Switch mode to advanced with existingXml passed
        const { xml: advXml } = parsePseudocodeToDrawio(code, xml, 'true-false', 'hexagon', 'advanced');
        const { nodes } = drawioToReactFlow(advXml);

        // Find nodes for Fragment 1
        const f1Nodes = nodes.filter(n => n.id === 'f1_start' || (n.position.x < 700));
        // Find nodes for Fragment 2
        const f2Nodes = nodes.filter(n => n.id === 'f2_start' || (n.position.x >= 700 && n.position.x < 1600));
        // Find nodes for Fragment 3
        const f3Nodes = nodes.filter(n => n.id === 'f3_start' || (n.position.x >= 1600));

        // Nodes must NOT have melted into Fragment 3!
        expect(f1Nodes.length).toBeGreaterThanOrEqual(2);
        expect(f2Nodes.length).toBeGreaterThanOrEqual(2);
        expect(f3Nodes.length).toBeGreaterThanOrEqual(3);

        // Fragment 1 nodes must stay in their own horizontal area (< 700)
        f1Nodes.forEach(n => {
            expect(n.position.x).toBeLessThan(750);
        });

        // Fragment 3 nodes must stay in their own horizontal area (> 1600)
        f3Nodes.forEach(n => {
            expect(n.position.x).toBeGreaterThan(1600);
        });
    });

    it('should vertically center WHILE container over its child blocks with balanced top and bottom padding', () => {
        const pseudo = `FUNCTION main()
WHILE x > 0 DO
    Operace()
    Operace()
ENDWHILE
ENDFUNCTION`;

        const { xml } = parsePseudocodeToDrawio(pseudo, null, 'true-false', 'hexagon', 'simple');
        const { nodes } = drawioToReactFlow(xml);

        const container = nodes.find(n => n.type === 'LOOP_CONTAINER');
        const children = nodes.filter(n => n.data?.label === 'Operace');
        expect(container).toBeDefined();
        expect(children.length).toBe(2);

        const minY = Math.min(...children.map(c => c.position.y));
        const maxY = Math.max(...children.map(c => c.position.y + 50));

        const containerTop = container.position.y;
        const containerBottom = container.position.y + container.style.height;

        const topGap = minY - (containerTop + 45); // 45 is header height
        const bottomGap = containerBottom - maxY;

        // Top gap and bottom gap must be balanced (difference <= 2px)
        expect(Math.abs(topGap - bottomGap)).toBeLessThanOrEqual(2);
        expect(topGap).toBeGreaterThanOrEqual(30);
        expect(bottomGap).toBeGreaterThanOrEqual(30);
    });

    it('should correctly translate simple mode (while with 2 blocks + 1 block outside) to advanced mode without tangling or overlapping', () => {
        // Construct XML for Image 2:
        // Fragment 1 (start) -> while container with Operace 1 and Operace 2 -> Operace 3 outside -> ENDFUNCTION
        const xml = `<mxGraphModel dx="1000" dy="1000" grid="1">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start1" value="fragment_1" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="400" y="40" width="180" height="50" as="geometry" />
    </mxCell>
    <mxCell id="while1" value="x &gt; 0" style="swimlane;LOOP_CONTAINER;" type="LOOP_CONTAINER" vertex="1" parent="1">
      <mxGeometry x="350" y="140" width="350" height="250" as="geometry" />
    </mxCell>
    <mxCell id="a1" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="400" y="200" width="160" height="50" as="geometry" />
    </mxCell>
    <mxCell id="a2" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="400" y="290" width="160" height="50" as="geometry" />
    </mxCell>
    <mxCell id="a3" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="500" y="460" width="160" height="50" as="geometry" />
    </mxCell>
    <mxCell id="end1" value="ENDFUNCTION" style="ellipse;mode=end;" vertex="1" parent="1">
      <mxGeometry x="400" y="580" width="180" height="50" as="geometry" />
    </mxCell>
    <mxCell id="e1" edge="1" parent="1" source="start1" target="a1"><mxGeometry relative="1" as="geometry" /></mxCell>
    <mxCell id="e2" edge="1" parent="1" source="a1" target="a2"><mxGeometry relative="1" as="geometry" /></mxCell>
    <mxCell id="e3" edge="1" parent="1" source="a2" target="a3"><mxGeometry relative="1" as="geometry" /></mxCell>
    <mxCell id="e4" edge="1" parent="1" source="a3" target="end1"><mxGeometry relative="1" as="geometry" /></mxCell>
  </root>
</mxGraphModel>`;

        // Parse to pseudocode
        const { code } = parseDrawioToPseudocode(xml);
        expect(code).toContain('WHILE x > 0 DO');
        expect(code).toContain('ENDWHILE');

        // Convert to advanced mode
        const { xml: advXml } = parsePseudocodeToDrawio(code, xml, 'true-false', 'hexagon', 'advanced');
        const { nodes, edges } = drawioToReactFlow(advXml);

        const condNode = nodes.find(n => n.type === 'CONDITION');
        expect(condNode).toBeDefined();

        const actNodes = nodes.filter(n => n.data?.label === 'Operace');
        expect(actNodes.length).toBe(3);

        // Find which node is which based on their IDs (a1, a2, a3 matched by originalId)
        const nodeA1 = nodes.find(n => n.id === 'a1');
        const nodeA2 = nodes.find(n => n.id === 'a2');
        const nodeA3 = nodes.find(n => n.id === 'a3');

        expect(nodeA1).toBeDefined();
        expect(nodeA2).toBeDefined();
        expect(nodeA3).toBeDefined();

        // 1. Condition node must NOT overlap nodeA1!
        expect(condNode.position.y + 80).toBeLessThanOrEqual(nodeA1.position.y);

        // 2. Condition node True edge must connect to nodeA1 (entry of while body)
        const trueEdge = edges.find(e => e.source === condNode.id && (e.data?.label === 'True' || e.sourceHandle === 's-bottom'));
        expect(trueEdge?.target).toBe(nodeA1.id);

        // 3. nodeA1 must connect to nodeA2
        const edge1to2 = edges.find(e => e.source === nodeA1.id);
        expect(edge1to2?.target).toBe(nodeA2.id);

        // 4. nodeA2 (end of while body) must loop back to condNode
        const loopbackEdge = edges.find(e => e.source === nodeA2.id);
        expect(loopbackEdge?.target).toBe(condNode.id);

        // 5. Condition node False edge must connect to nodeA3 (outside the while loop)
        const falseEdge = edges.find(e => e.source === condNode.id && (e.data?.label === 'False' || e.sourceHandle === 's-right'));
        expect(falseEdge?.target).toBe(nodeA3.id);

        // 6. nodeA3 must connect to end1
        const edge3toEnd = edges.find(e => e.source === nodeA3.id);
        expect(edge3toEnd?.target).toBe('end1');

        // Now translate back from Advanced to Simple with advXml passed as existingXml
        const { code: backCode } = parseDrawioToPseudocode(advXml);
        const { xml: backSimpleXml } = parsePseudocodeToDrawio(backCode, advXml, 'true-false', 'hexagon', 'simple');
        const { nodes: backNodes, edges: backEdges } = drawioToReactFlow(backSimpleXml);

        const backContainer = backNodes.find(n => n.type === 'LOOP_CONTAINER');
        expect(backContainer).toBeDefined();

        const backA1 = backNodes.find(n => n.id === 'a1');
        const backA2 = backNodes.find(n => n.id === 'a2');
        const backA3 = backNodes.find(n => n.id === 'a3');

        expect(backA1).toBeDefined();
        expect(backA2).toBeDefined();
        expect(backA3).toBeDefined();

        // Check container bounds enclose backA1 and backA2
        const cX = backContainer.position.x;
        const cY = backContainer.position.y;
        const cW = backContainer.style.width;
        const cH = backContainer.style.height;

        expect(backA1.position.x).toBeGreaterThanOrEqual(cX);
        expect(backA1.position.x + 160).toBeLessThanOrEqual(cX + cW);
        expect(backA1.position.y).toBeGreaterThanOrEqual(cY);
        expect(backA1.position.y + 50).toBeLessThanOrEqual(cY + cH);

        expect(backA2.position.x).toBeGreaterThanOrEqual(cX);
        expect(backA2.position.x + 160).toBeLessThanOrEqual(cX + cW);
        expect(backA2.position.y).toBeGreaterThanOrEqual(cY);
        expect(backA2.position.y + 50).toBeLessThanOrEqual(cY + cH);

        // a3 must be OUTSIDE the container
        expect(backA3.position.y).toBeGreaterThanOrEqual(cY + cH);

        // Connections in simple mode:
        // start1 -> a1
        const backStartEdge = backEdges.find(e => e.source === 'start1');
        expect(backStartEdge?.target).toBe('a1');

        // a1 -> a2
        const backA1Edge = backEdges.find(e => e.source === 'a1');
        expect(backA1Edge?.target).toBe('a2');

        // a2 -> a3 (flow leaves container to a3)
        const backA2Edge = backEdges.find(e => e.source === 'a2');
        expect(backA2Edge?.target).toBe('a3');

        // a3 -> end1
        const backA3Edge = backEdges.find(e => e.source === 'a3');
        expect(backA3Edge?.target).toBe('end1');
    });

    it('should correctly translate DO-WHILE from Simple to Advanced mode without duplicating blocks and with clean Y positions', () => {
        const simpleXml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start1" value="fragment_1" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="while1" value="x &gt; 0" style="swimlane;LOOP_CONTAINER" type="LOOP_CONTAINER" doWhile="true" vertex="1" parent="1">
      <mxGeometry x="270" y="130" width="300" height="240" as="geometry" />
    </mxCell>
    <mxCell id="op1" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="360" y="210" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="op2" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="360" y="290" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="end1" value="ENDFUNCTION" style="ellipse;mode=end;" vertex="1" parent="1">
      <mxGeometry x="360" y="420" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="e1" edge="1" parent="1" source="start1" target="op1" />
    <mxCell id="e2" edge="1" parent="1" source="op1" target="op2" />
    <mxCell id="e3" edge="1" parent="1" source="op2" target="end1" />
  </root>
</mxGraphModel>`;

        // 1. Simple -> Pseudocode
        const { code: pseudo } = parseDrawioToPseudocode(simpleXml);
        expect(pseudo).toContain('FUNCTION fragment_1()');
        expect(pseudo).toContain('WHILE x > 0 DO');

        // 2. Pseudocode -> Advanced Diagram
        const { xml: advXml } = parsePseudocodeToDrawio(pseudo, simpleXml, 'true-false', 'hexagon', 'advanced');
        const { nodes: advNodes, edges: advEdges } = drawioToReactFlow(advXml);

        // In Advanced mode:
        // Must NOT duplicate Operace blocks - exactly 2 Operace blocks should exist!
        const operaceNodes = advNodes.filter(n => (n.data?.label || '').trim() === 'Operace');
        expect(operaceNodes.length).toBe(2);

        // One CONDITION node with x > 0
        const condNode = advNodes.find(n => n.type === 'condition' || (n.data?.label || '').includes('x > 0'));
        expect(condNode).toBeDefined();

        // Edges in Advanced mode:
        // start1 -> op1
        const startEdge = advEdges.find(e => e.source === 'start1');
        expect(startEdge).toBeDefined();
        expect(startEdge.target).toBe(operaceNodes[0].id);

        // op1 -> op2
        const op1Edge = advEdges.find(e => e.source === operaceNodes[0].id);
        expect(op1Edge).toBeDefined();
        expect(op1Edge.target).toBe(operaceNodes[1].id);

        // op2 -> condNode
        const op2Edge = advEdges.find(e => e.source === operaceNodes[1].id);
        expect(op2Edge).toBeDefined();
        expect(op2Edge.target).toBe(condNode.id);

        // condNode True branch loops back to op1
        const loopbackEdge = advEdges.find(e => e.source === condNode.id && ['ano', 'yes', 'true', '1', 'y', '+'].includes((e.data?.label || e.label || '').toLowerCase()));
        expect(loopbackEdge).toBeDefined();
        expect(loopbackEdge.target).toBe(operaceNodes[0].id);
        expect(loopbackEdge.sourceHandle).toBe('s-right');

        // condNode False branch goes to end1
        const exitEdge = advEdges.find(e => e.source === condNode.id && ['ne', 'no', 'false', '0', 'n', '-'].includes((e.data?.label || e.label || '').toLowerCase()));
        expect(exitEdge).toBeDefined();
        expect(exitEdge.target).toBe('end1');
        expect(exitEdge.sourceHandle).toBe('s-bottom');

        // condNode MUST have isSwapped = true so visual node handles (right='T', bottom='F') match edge labels
        expect(condNode.data?.isSwapped).toBe(true);

        // Check Y coordinates are compact and monotonic: op1.y < op2.y < condNode.y < end1.y
        const op1Y = operaceNodes[0].position.y;
        const op2Y = operaceNodes[1].position.y;
        const condY = condNode.position.y;
        const endNode = advNodes.find(n => n.id === 'end1');
        const endY = endNode.position.y;

        expect(op1Y).toBeLessThan(op2Y);
        expect(op2Y).toBeLessThan(condY);
        expect(condY).toBeLessThan(endY);
        // Ensure no giant gaps (total span from start to end should be well under 600px, not 800+px)
        expect(endY).toBeLessThanOrEqual(550);

        // 3. Advanced Diagram -> Pseudocode -> Simple Diagram roundtrip
        const { code: backPseudo } = parseDrawioToPseudocode(advXml);
        const { xml: backXml } = parsePseudocodeToDrawio(backPseudo, advXml, 'true-false', 'hexagon', 'simple');
        const { nodes: backNodes, edges: backEdges } = drawioToReactFlow(backXml);

        const backContainer = backNodes.find(n => n.type === 'LOOP_CONTAINER');
        expect(backContainer).toBeDefined();
        expect(backContainer.data?.doWhile).toBe(true);

        const backOperace = backNodes.filter(n => (n.data?.label || '').trim() === 'Operace');
        expect(backOperace.length).toBe(2);

        // Container MUST properly enclose both child blocks
        const cY = backContainer.position.y;
        const cH = backContainer.style.height;
        expect(backOperace[0].position.y).toBeGreaterThanOrEqual(cY);
        expect(backOperace[1].position.y + 50).toBeLessThanOrEqual(cY + cH);

        // 4. Verify ZERO Y-drift over multiple sync cycles (Simple -> Pseudocode -> Simple)
        let currXml = backXml;
        let prevCY = backContainer.position.y;
        let prevOp1Y = backOperace[0].position.y;
        let prevOp2Y = backOperace[1].position.y;

        for (let iter = 1; iter <= 5; iter++) {
            const { code: iterPseudo } = parseDrawioToPseudocode(currXml);
            const { xml: iterXml } = parsePseudocodeToDrawio(iterPseudo, currXml, 'true-false', 'hexagon', 'simple');
            const { nodes: iterNodes } = drawioToReactFlow(iterXml);

            const iterContainer = iterNodes.find(n => n.type === 'LOOP_CONTAINER');
            const iterOps = iterNodes.filter(n => (n.data?.label || '').trim() === 'Operace');

            expect(iterContainer.position.y).toBe(prevCY);
            expect(iterOps[0].position.y).toBe(prevOp1Y);
            expect(iterOps[1].position.y).toBe(prevOp2Y);

            currXml = iterXml;
        }
    });

    it('should translate FOR_CONTAINER to FOR ... DO in pseudocode and Python, not WHILE', () => {
        // Diagram XML representing a FOR container placed from toolbar
        const xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start1" value="fragment_1" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="for1" value="" type="FOR_CONTAINER" style="swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;strokeColor=#4f46e5;FOR_CONTAINER;" vertex="1" parent="1">
      <mxGeometry x="270" y="110" width="300" height="200" as="geometry" />
    </mxCell>
    <mxCell id="act1" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="360" y="180" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="end1" value="ENDFUNCTION" style="ellipse;mode=end;" vertex="1" parent="1">
      <mxGeometry x="360" y="340" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="e1" edge="1" parent="1" source="start1" target="act1" />
    <mxCell id="e2" edge="1" parent="1" source="act1" target="end1" />
  </root>
</mxGraphModel>`;

        const { code: pseudo } = parseDrawioToPseudocode(xml);
        expect(pseudo).toContain('FOR i = 0 TO 10 DO');
        expect(pseudo).toContain('ENDFOR');
        expect(pseudo).not.toContain('WHILE');
        expect(pseudo).not.toContain('ENDWHILE');

        // Roundtrip to Simple mode Diagram
        const { xml: roundXml } = parsePseudocodeToDrawio(pseudo, xml, 'true-false', 'hexagon', 'simple');
        const { nodes: roundNodes } = drawioToReactFlow(roundXml);
        const roundFor = roundNodes.find(n => n.type === 'FOR_CONTAINER');
        expect(roundFor).toBeDefined();
    });

    it('should translate FOR_CONTAINER with custom STEP into FOR ... STEP ... DO', () => {
        const xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="start1" value="fragment_1" style="ellipse;mode=start;entityType=FUNCTION;" vertex="1" parent="1">
      <mxGeometry x="360" y="40" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="for1" value="" type="FOR_CONTAINER" style="swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;strokeColor=#4f46e5;FOR_CONTAINER;forInit=k%20%3D%201;forLimit=20;forStep=2;" vertex="1" parent="1">
      <mxGeometry x="270" y="110" width="300" height="200" as="geometry" />
    </mxCell>
    <mxCell id="act1" value="Operace" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="360" y="180" width="120" height="50" as="geometry" />
    </mxCell>
    <mxCell id="end1" value="ENDFUNCTION" style="ellipse;mode=end;" vertex="1" parent="1">
      <mxGeometry x="360" y="340" width="100" height="40" as="geometry" />
    </mxCell>
    <mxCell id="e1" edge="1" parent="1" source="start1" target="act1" />
    <mxCell id="e2" edge="1" parent="1" source="act1" target="end1" />
  </root>
</mxGraphModel>`;

        const { code: pseudo } = parseDrawioToPseudocode(xml);
        expect(pseudo).toContain('FOR k = 1 TO 20 STEP 2 DO');
        expect(pseudo).toContain('ENDFOR');

        // Roundtrip
        const { xml: roundXml } = parsePseudocodeToDrawio(pseudo, xml, 'true-false', 'hexagon', 'simple');
        const { code: roundPseudo } = parseDrawioToPseudocode(roundXml);
        expect(roundPseudo).toContain('FOR k = 1 TO 20 STEP 2 DO');
        expect(roundPseudo).toContain('ENDFOR');
    });

    it('should correctly configure handles and edge labels for DO-WHILE with NOT condition in advanced mode', () => {
        const pseudo = `FUNCTION main()
Operace
WHILE NOT (x > 0) DO
    Operace
ENDWHILE
ENDFUNCTION`;

        const { xml: advXml } = parsePseudocodeToDrawio(pseudo, null, 'true-false', 'hexagon', 'advanced');
        const { nodes: advNodes, edges: advEdges } = drawioToReactFlow(advXml);

        const condNode = advNodes.find(n => n.type === 'condition' || (n.data?.label || '').includes('x > 0'));
        expect(condNode).toBeDefined();

        // For NOT (x > 0), isSwapped should be false so right handle is 'F' (red) and bottom handle is 'T' (green)
        expect(condNode.data?.isSwapped).toBe(false);

        const loopbackEdge = advEdges.find(e => e.source === condNode.id && ['ne', 'no', 'false', '0', 'n', '-'].includes((e.data?.label || e.label || '').toLowerCase()));
        expect(loopbackEdge).toBeDefined();
        expect(loopbackEdge.sourceHandle).toBe('s-right');

        const exitEdge = advEdges.find(e => e.source === condNode.id && ['ano', 'yes', 'true', '1', 'y', '+'].includes((e.data?.label || e.label || '').toLowerCase()));
        expect(exitEdge).toBeDefined();
        expect(exitEdge.sourceHandle).toBe('s-bottom');
    });
});

