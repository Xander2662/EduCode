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
                
                // Ignorujeme MERGE body (ty si auto-layout při rekonstrukci tvoří dynamicky znovu)
                if (style.includes('strokeColor=none') && style.includes('fillColor=none')) return null;
                
                // Normalizace hodnoty pro bezpečné porovnání (stejná logika jakou má parser)
                let rawVal = cell.getAttribute('value') || '';
                let val = rawVal.replace(/<[^>]*>?/gm, '') // Odstraní skryté HTML tagy z Draw.io
                                .replace(/&nbsp;/gi, ' ')
                                .replace(/&gt;/gi, '>')
                                .replace(/&lt;/gi, '<')
                                .replace(/&amp;/gi, '&')
                                .trim();
                                
                // Nový parser (a App.jsx) automaticky odstraňuje slovo "Vstup" z UI bloku, 
                // proto ho musíme odstranit i z originálu pro čisté porovnání
                if (val.toLowerCase().startsWith('vstup ')) {
                    val = val.substring(6).trim();
                }

                return {
                    value: val,
                    x: parseFloat(geo?.getAttribute('x') || 0)
                    // Záměrně netestujeme 'y', protože ho pseudocodeToDiagram nyní dynamicky re-kalkuluje (auto-layout proti překrývání)
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.x !== b.x) return a.x - b.x;
                return a.value.localeCompare(b.value);
            }); // Seřazení podle X (a pak value) zajistí, že pořadí bloků nerozbije shodu polí

        const edgesCount = doc.querySelectorAll('mxCell[edge="1"]').length;
        
        return { blocks, edgesCount };
    };

    files.forEach(file => {
        it(`Měl by zachovat uzly a X locky po převodu tam a zpět: ${file}`, () => {
            const xmlContent = fs.readFileSync(path.join(examplesDir, file), 'utf-8');
            
            // 1. Získání sémantiky z originálního XML
            const originalSemantics = extractGraphSemantics(xmlContent);

            // 2. Převod z XML do Pseudokódu
            const pseudoResult = parseDrawioToPseudocode(xmlContent);
            expect(pseudoResult.errors.length).toBeLessThan(2);
            expect(pseudoResult.code).toBeTruthy();

            // 3. Převod z Pseudokódu zpět do XML (s vložením původního XML jako "paměti" pro stávající ID a X pozice)
            const hasContainer = xmlContent.includes('LOOP_CONTAINER') || xmlContent.includes('GROUP_BG') || xmlContent.includes('swimlane');
            const editorMode = hasContainer ? 'simple' : 'advanced';
            const xmlResult = parsePseudocodeToDrawio(pseudoResult.code, xmlContent, 'true-false', 'hexagon', editorMode);
            
            // 4. Získání sémantiky ze zrekonstruovaného XML
            const newSemantics = extractGraphSemantics(xmlResult.xml);

            // 5. Ověření: Uzel po uzlu musí mít stejnou hodnotu a stejnou X souřadnici (layout se nerozpadl)
            expect(newSemantics.blocks).toEqual(originalSemantics.blocks);

            // 6. Ověření: Počet hran by měl zůstat víceméně stejný (tolerance +-3 kvůli dynamickým MERGE pointům a obchvatům cyklů)
            expect(Math.abs(originalSemantics.edgesCount - newSemantics.edgesCount)).toBeLessThanOrEqual(3);
        });
    });

    it('zachová vertikální odstup mezi více fragmenty při roundbacku', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="f1_a" value="f1_step = 1" type="ACTION" vertex="1" parent="1"><mxGeometry x="360" y="100" width="120" height="50"/></mxCell>
            <mxCell id="f2_a" value="f2_step = 2" type="ACTION" vertex="1" parent="1"><mxGeometry x="360" y="600" width="120" height="50"/></mxCell>
        </root></mxGraphModel>`;

        const pseudoResult = parseDrawioToPseudocode(xml);
        expect(pseudoResult.code).toContain('f1_step = 1');
        expect(pseudoResult.code).toContain('f2_step = 2');

        const xmlResult = parsePseudocodeToDrawio(pseudoResult.code, xml, 'true-false', 'hexagon', 'advanced');
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlResult.xml, "text/xml");

        const cellF1 = Array.from(doc.querySelectorAll('mxCell[vertex="1"]')).find(c => c.getAttribute('value') === 'f1_step = 1');
        const cellF2 = Array.from(doc.querySelectorAll('mxCell[vertex="1"]')).find(c => c.getAttribute('value') === 'f2_step = 2');

        expect(cellF1).toBeTruthy();
        expect(cellF2).toBeTruthy();

        const y1 = parseFloat(cellF1.querySelector('mxGeometry')?.getAttribute('y') || 0);
        const y2 = parseFloat(cellF2.querySelector('mxGeometry')?.getAttribute('y') || 0);

        // f2_step musí mít Y větší než f1_step (nemohou se překrývat na stejné Y)
        expect(y2 - y1).toBeGreaterThanOrEqual(200);
    });

    it('správně zachová jedinou připojenou větev (Ne) podmínky při roundbacku', () => {
        const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
            <mxCell id="start" value="main" type="START_END" mode="start" vertex="1" parent="1"><mxGeometry x="360" y="40" width="100" height="40"/></mxCell>
            <mxCell id="cond" value="x &gt; 0" type="CONDITION" style="rhombus;" vertex="1" parent="1"><mxGeometry x="360" y="140" width="160" height="80"/></mxCell>
            <mxCell id="act" value="b = 2" type="ACTION" vertex="1" parent="1"><mxGeometry x="360" y="300" width="120" height="50"/></mxCell>
            <mxCell id="e1" source="start" target="cond" edge="1" parent="1"/>
            <mxCell id="e2" source="cond" target="act" value="Ne" style="sourceHandle=s-right;" edge="1" parent="1"/>
        </root></mxGraphModel>`;

        const pseudoResult = parseDrawioToPseudocode(xml);
        expect(pseudoResult.code).toContain('IF x > 0 THEN');
        expect(pseudoResult.code).toContain('ELSE');
        expect(pseudoResult.code).toContain('b = 2');
        expect(pseudoResult.code).toContain('ENDIF');

        const xmlResult = parsePseudocodeToDrawio(pseudoResult.code, xml, 'ano-ne', 'diamond', 'advanced');
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlResult.xml, "text/xml");

        const condCell = Array.from(doc.querySelectorAll('mxCell[vertex="1"]')).find(c => c.getAttribute('value') === 'x > 0');
        const actCell = Array.from(doc.querySelectorAll('mxCell[vertex="1"]')).find(c => c.getAttribute('value') === 'b = 2');
        const edgeCell = Array.from(doc.querySelectorAll('mxCell[edge="1"]')).find(c => c.getAttribute('source') === condCell.getAttribute('id') && c.getAttribute('target') === actCell.getAttribute('id'));

        expect(edgeCell).toBeTruthy();
        expect(edgeCell.getAttribute('value')).toBe('Ne');
        expect(edgeCell.getAttribute('style')).toContain('sourceHandle=s-right');
    });
});