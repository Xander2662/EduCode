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
            .sort((a, b) => a.x - b.x); // Seřazení podle X zajistí, že pořadí bloků nerozbije shodu polí

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
            const xmlResult = parsePseudocodeToDrawio(pseudoResult.code, xmlContent);
            
            // 4. Získání sémantiky ze zrekonstruovaného XML
            const newSemantics = extractGraphSemantics(xmlResult.xml);

            // 5. Ověření: Uzel po uzlu musí mít stejnou hodnotu a stejnou X souřadnici (layout se nerozpadl)
            expect(newSemantics.blocks).toEqual(originalSemantics.blocks);

            // 6. Ověření: Počet hran by měl zůstat víceméně stejný (tolerance +-3 kvůli dynamickým MERGE pointům a obchvatům cyklů)
            expect(Math.abs(originalSemantics.edgesCount - newSemantics.edgesCount)).toBeLessThanOrEqual(3);
        });
    });
});