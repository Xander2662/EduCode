import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';

const extractGraphSemantics = (xml) => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM("");
    const parser = new dom.window.DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    
    const cells = Array.from(doc.querySelectorAll('mxCell'));
    
    let blocks = [];
    let edgesCount = 0;

    cells.forEach(cell => {
        const vertex = cell.getAttribute('vertex');
        const edge = cell.getAttribute('edge');
        
        if (vertex === '1') {
            let value = cell.getAttribute('value') || '';
            const geo = cell.querySelector('mxGeometry');
            const x = geo ? parseFloat(geo.getAttribute('x') || 0) : 0;
            const y = geo ? parseFloat(geo.getAttribute('y') || 0) : 0;
            const width = geo ? parseFloat(geo.getAttribute('width') || 0) : 0;
            
            const style = cell.getAttribute('style') || '';
            if (style.includes('strokeColor=none') && style.includes('fillColor=none') && width === 10) return;
            
            value = value.replace(/<[^>]*>?/gm, '').trim();
            value = value.replace(/\(\)$/g, '').trim();

            blocks.push({ value, x, y });
        } else if (edge === '1') {
            edgesCount++;
        }
    });

    blocks.sort((a, b) => a.y - b.y || a.x - b.x);

    return { blocks, edgesCount };
};

describe('Roundtrip Parser Tests (XML -> Pseudo -> XML)', () => {
    const examplesDir = path.resolve(__dirname, '../examples/diagram_examples');
    
    let files = [];
    if (fs.existsSync(examplesDir)) {
        files = fs.readdirSync(examplesDir).filter(file => file.endsWith('.xml'));
    }

    if (files.length === 0) {
        it.skip('Nenalezeny žádné .xml soubory ve složce diagram_examples', () => {});
        return;
    }

    files.forEach(file => {
        it(`Měl by zachovat uzly a X/Y locky po převodu tam a zpět: ${file}`, () => {
            const xmlPath = path.join(examplesDir, file);
            const originalXml = fs.readFileSync(xmlPath, 'utf-8');

            const pseudoResult = parseDrawioToPseudocode(originalXml);
            
            const criticalErrors = pseudoResult.errors.filter(err => !err.startsWith('Tip:'));
            expect(criticalErrors).toHaveLength(0); 
            
            const xmlResult = parsePseudocodeToDrawio(pseudoResult.code, originalXml);
            
            const originalSemantics = extractGraphSemantics(originalXml);
            const newSemantics = extractGraphSemantics(xmlResult.xml);

            expect(newSemantics.blocks).toEqual(originalSemantics.blocks);
            
            expect(Math.abs(originalSemantics.edgesCount - newSemantics.edgesCount)).toBeLessThanOrEqual(3);
        });
    });
});