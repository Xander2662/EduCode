import { describe, it, expect } from 'vitest';
import { parseDrawioToPython } from '../src/parsers/diagramToPython';

describe('diagramToPython parser', () => {
    
    it('should generate a simple sequence', () => {
        const xml = `<mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" style="ellipse" vertex="1" parent="1"/>
            <mxCell id="a1" value="x = 10" style="rounded=1" vertex="1" parent="1"/>
            <mxCell id="a2" value="&quot;Hello&quot;" style="rounded=1" vertex="1" parent="1"/>
            <mxCell id="end" value="ENDFUNCTION" style="ellipse;mode=end" vertex="1" parent="1"/>
            <mxCell id="e1" source="start" target="a1" edge="1" parent="1"/>
            <mxCell id="e2" source="a1" target="a2" edge="1" parent="1"/>
            <mxCell id="e3" source="a2" target="end" edge="1" parent="1"/>
        </root></mxGraphModel>`;
        
        const res = parseDrawioToPython(xml);
        expect(res.code).toContain('def main():');
        expect(res.code).toContain('    x = 10');
        expect(res.code).toContain('    print("Hello")');
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
});
