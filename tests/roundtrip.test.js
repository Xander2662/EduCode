import { describe, it, expect } from 'vitest';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';
import fs from 'fs';
import path from 'path';

describe('Roundtrip Parser Tests (XML -> Pseudo -> XML)', () => {
    const examplesDir = path.resolve(__dirname, '../examples/diagram_examples');
    const files = fs.readdirSync(examplesDir).filter(f => f.endsWith('.xml'));

    const extractGraphSemantics = (xmlString) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, "text/xml");
        
        const blocks = Array.from(doc.querySelectorAll('mxCell[vertex="1"]'))
            .map(cell => {
                const geo = cell.querySelector('mxGeometry');
                const style = cell.getAttribute('style') || '';
                if (style.includes('strokeColor=none') && style.includes('fillColor=none')) return null;
                return {
                    value: cell.getAttribute('value'),
                    x: parseFloat(geo?.getAttribute('x') || 0)
                    // záměrně netestujeme 'y', protože ho pseudocodeToDiagram nyní dynamicky re-kalkuluje (auto-layout proti překrývání)
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.x - b.x);

        const edgesCount = doc.querySelectorAll('mxCell[edge="1"]').length;
        
        return { blocks, edgesCount };
    };

    files.forEach(file => {
        it(`Měl by zachovat uzly a X locky po převodu tam a zpět: ${file}`, () => {
            const xmlContent = fs.readFileSync(path.join(examplesDir, file), 'utf-8');
            
            const originalSemantics = extractGraphSemantics(xmlContent);

            const pseudoResult = parseDrawioToPseudocode(xmlContent);
            expect(pseudoResult.errors.length).toBeLessThan(2);
            expect(pseudoResult.code).toBeTruthy();

            const xmlResult = parsePseudocodeToDrawio(pseudoResult.code, xmlContent);
            
            const newSemantics = extractGraphSemantics(xmlResult.xml);

            expect(newSemantics.blocks).toEqual(originalSemantics.blocks);

            expect(Math.abs(originalSemantics.edgesCount - newSemantics.edgesCount)).toBeLessThanOrEqual(3);
        });
    });
});