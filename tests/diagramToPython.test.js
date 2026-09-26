import { describe, it, expect } from 'vitest';
import { parseDrawioToPython } from '../src/parsers/diagramToPython';

describe('diagramToPython parser', () => {
    
    it('should generate a simple sequence', () => {
        const xml = `<mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" style="ellipse" vertex="1" parent="1"/>
            <mxCell id="a1" value="x = 10" style="rounded=1" vertex="1" parent="1"/>
            <mxCell id="a2" value="doWork()" style="rounded=1" vertex="1" parent="1"/>
            <mxCell id="end" value="ENDFUNCTION" style="ellipse;mode=end" vertex="1" parent="1"/>
            <mxCell id="e1" source="start" target="a1" edge="1" parent="1"/>
            <mxCell id="e2" source="a1" target="a2" edge="1" parent="1"/>
            <mxCell id="e3" source="a2" target="end" edge="1" parent="1"/>
        </root></mxGraphModel>`;
        
        const res = parseDrawioToPython(xml);
        expect(res.code).toContain('def main():');
        expect(res.code).toContain('    x = 10');
        expect(res.code).toContain('    doWork()');
        expect(res.code).toContain("if __name__ == '__main__':\n    main()");
    });

    it('should translate IF logic with empty blocks into pass', () => {
        const xml = `<mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" style="ellipse" vertex="1" parent="1"/>
            <mxCell id="cond" value="x &gt; 5" style="rhombus" vertex="1" parent="1"/>
            <mxCell id="end" value="ENDFUNCTION" style="ellipse;mode=end" vertex="1" parent="1"/>
            <mxCell id="e1" source="start" target="cond" edge="1" parent="1"/>
            <mxCell id="et" source="cond" target="end" value="Ano" edge="1" parent="1"/>
            <mxCell id="ef" source="cond" target="end" value="Ne" edge="1" parent="1"/>
        </root></mxGraphModel>`;

        const res = parseDrawioToPython(xml);
        expect(res.code).toContain('if x > 5:');
        expect(res.code).toContain('    pass');
    });

    it('should format IO nodes correctly', () => {
        const xml = `<mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" style="ellipse" vertex="1" parent="1"/>
            <mxCell id="io1" value="Vstup x, y" style="shape=parallelogram" vertex="1" parent="1"/>
            <mxCell id="io2" value="z" style="shape=parallelogram;ioType=output" vertex="1" parent="1"/>
            <mxCell id="e1" source="start" target="io1" edge="1" parent="1"/>
            <mxCell id="e2" source="io1" target="io2" edge="1" parent="1"/>
        </root></mxGraphModel>`;

        const res = parseDrawioToPython(xml);
        expect(res.code).toContain('    x = input()');
        expect(res.code).toContain('    y = input()');
        expect(res.code).toContain('    print(z)');
    });

    it('should generate automatic fragment for empty WHILE container in Python', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="loop" value="count &lt; 5" type="LOOP_CONTAINER" style="LOOP_CONTAINER;" vertex="1" parent="1">
                <mxGeometry x="100" y="100" width="300" height="200" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>`;

        const res = parseDrawioToPython(xml);
        expect(res.code).toContain('def fragment_1():');
        expect(res.code).toContain('while count < 5:');
        expect(res.code).toContain('    pass');
        expect(res.errors).toContain('Diagram neobsahuje počáteční blok. Byly vytvořeny automatické fragmenty.');
    });

    it('should generate automatic fragment for empty FOR container in Python', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="for1" value="" type="FOR_CONTAINER" style="FOR_CONTAINER;forInit=i%20%3D%200;forLimit=10;forStep=1;" vertex="1" parent="1">
                <mxGeometry x="100" y="100" width="300" height="200" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>`;

        const res = parseDrawioToPython(xml);
        expect(res.code).toContain('def fragment_1():');
        expect(res.code).toContain('for i in range(0, 11):');
        expect(res.code).toContain('    pass');
        expect(res.errors).toContain('Diagram neobsahuje počáteční blok. Byly vytvořeny automatické fragmenty.');
    });

    it('should generate automatic fragment for empty SWITCH container in Python', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="sw" value="opt" type="SWITCH_CONTAINER" style="SWITCH_CONTAINER;switchVar=opt;" vertex="1" parent="1">
                <mxGeometry x="100" y="100" width="400" height="250" as="geometry"/>
            </mxCell>
            <mxCell id="c1" value="Case 1" type="CASE_CONTAINER" style="CASE_CONTAINER;caseVal=1;" vertex="1" parent="sw">
                <mxGeometry x="20" y="50" width="150" height="150" as="geometry"/>
            </mxCell>
            <mxCell id="c2" value="Case default" type="CASE_CONTAINER" style="CASE_CONTAINER;isDefault=true;" vertex="1" parent="sw">
                <mxGeometry x="200" y="50" width="150" height="150" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>`;

        const res = parseDrawioToPython(xml);
        expect(res.code).toContain('def fragment_1():');
        expect(res.code).toContain('match opt:');
        expect(res.code).toContain('    case 1:');
        expect(res.code).toContain('    case _:');
        expect(res.code).toContain('        pass');
        expect(res.errors).toContain('Diagram neobsahuje počáteční blok. Byly vytvořeny automatické fragmenty.');
    });

    it('nevytvoří duplicitní fragmenty pro vnořenou skupinu v Pythonu', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="outer" value="x &gt; 0" type="LOOP_CONTAINER" style="LOOP_CONTAINER;" vertex="1" parent="1">
                <mxGeometry x="100" y="100" width="400" height="300" as="geometry"/>
            </mxCell>
            <mxCell id="inner" value="" type="FOR_CONTAINER" style="FOR_CONTAINER;forInit=i%20%3D%200;forLimit=5;forStep=1;" vertex="1" parent="1">
                <mxGeometry x="150" y="150" width="200" height="150" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>`;

        const res = parseDrawioToPython(xml);
        expect(res.code).toContain('def fragment_1():');
        expect(res.code).not.toContain('fragment_2');
        const whileMatches = res.code.match(/while x > 0:/g);
        expect(whileMatches?.length).toBe(1);
        const forMatches = res.code.match(/for i in range\(0, 6\):/g);
        expect(forMatches?.length).toBe(1);
    });
});

