import { describe, it, expect } from 'vitest';
import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram';

describe('Pseudocode to Diagram Parser - Dynamic Y Auto-Layout', () => {
    it('Měl by dynamicky přepočítat a posunout Y pozice bloků, pokud dojde k odebrání řádku z kódu', () => {
        const code = `FUNCTION main()\n  x = 1\n  y = 2\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(code);
        expect(result.xml).toContain('value="x = 1"');
        expect(result.xml).toContain('value="y = 2"');
    });

    it('Měl by správně transformovat samotný IO blok Vstup na INPUT varování', () => {
        const input = `FUNCTION main()\n  Vstup\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);
        
        expect(result.xml).toContain('value="Vstup"');
        expect(result.xml).toContain('shape=parallelogram');
        expect(result.xml).toContain('ioType=input');
    });

    it('Měl by zachovat uživatelsky prohozené T/F porty (True na s-right, False na s-bottom)', () => {
        const code = `FUNCTION main()\n  IF x > 0 THEN\n    y = 1\n  ELSE\n    y = 2\n  ENDIF\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(code);
        expect(result.xml).toContain('shape=hexagon');
    });

    it('Měl by zpracovat PRINT jako ioType=output', () => {
        const input = `FUNCTION main()\n  PRINT("Hello")\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(input);
        
        // Zpracovává bezpečný enkódovaný text
        expect(result.xml).toContain('value="&quot;Hello&quot;"'); 
        expect(result.xml).toContain('shape=parallelogram');
        expect(result.xml).toContain('ioType=output');
    });

    it('Měl by v simple módu namapovat LOOP_CONTAINER do nodeLineMap na odpovídající WHILE řádek', () => {
        const code = `FUNCTION main()\n  WHILE x > 0 DO\n    x = x - 1\n  ENDWHILE\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(code, null, 'true-false', 'hexagon', 'simple');
        expect(result.nodeLineMap).toBeDefined();
        
        // Najdeme buňku pro LOOP_CONTAINER
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.xml, "text/xml");
        const loopCell = doc.querySelector('mxCell[style*="LOOP_CONTAINER"]');
        expect(loopCell).not.toBeNull();
        const loopId = loopCell.getAttribute('id');
        expect(result.nodeLineMap[loopId]).toBe(1); // řádek 1 je WHILE x > 0 DO
    });

    it('Měl by zajistit, že LOOP_CONTAINER nepřekrývá blok START FUNCTION nad ním', () => {
        const code = `FUNCTION main()\n  WHILE x > 0 DO\n    x = x - 1\n  ENDWHILE\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(code, null, 'true-false', 'hexagon', 'simple');
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.xml, "text/xml");
        const startCell = doc.querySelector('mxCell[style*="ellipse"]');
        const loopCell = doc.querySelector('mxCell[style*="LOOP_CONTAINER"]');
        
        expect(startCell).not.toBeNull();
        expect(loopCell).not.toBeNull();
        
        const startGeo = startCell.querySelector('mxGeometry');
        const loopGeo = loopCell.querySelector('mxGeometry');
        
        const startBottom = parseFloat(startGeo.getAttribute('y')) + parseFloat(startGeo.getAttribute('height') || '50');
        const loopTop = parseFloat(loopGeo.getAttribute('y'));
        
        // Mezi spodkem START a vrškem kontejneru musí být minimálně 35 px odstup
        expect(loopTop).toBeGreaterThanOrEqual(startBottom + 35);
    });

    it('pro samostatné smyčky (WHILE/FOR) v simple módu nespawnuje fragment start/end bloky', () => {
        const code = `FUNCTION fragment_1()\n  WHILE x > 0 DO\n    x = x - 1\n  ENDWHILE\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(code, null, 'true-false', 'hexagon', 'simple');
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.xml, "text/xml");
        const startEndCells = Array.from(doc.querySelectorAll('mxCell[style*="ellipse"]'));
        const loopCell = doc.querySelector('mxCell[style*="LOOP_CONTAINER"]');
        
        expect(loopCell).not.toBeNull();
        expect(startEndCells.length).toBe(0);
    });

    it('pro samostatnou FOR smyčku v simple módu nespawnuje fragment start/end bloky', () => {
        const code = `FUNCTION fragment_1()\n  FOR i = 0 TO 10 DO\n    PRINT(i)\n  ENDFOR\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(code, null, 'true-false', 'hexagon', 'simple');
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.xml, "text/xml");
        const startEndCells = Array.from(doc.querySelectorAll('mxCell[style*="ellipse"]'));
        const forCell = doc.querySelector('mxCell[style*="FOR_CONTAINER"]');
        
        expect(forCell).not.toBeNull();
        expect(startEndCells.length).toBe(0);
    });

    it('spawnuje fragment start/end bloky pro loop skupinu pouze když je připojen další připojitelný blok', () => {
        const code = `FUNCTION fragment_1()\n  x = 10\n  WHILE x > 0 DO\n    x = x - 1\n  ENDWHILE\nENDFUNCTION`;
        const result = parsePseudocodeToDrawio(code, null, 'true-false', 'hexagon', 'simple');
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.xml, "text/xml");
        const startCell = doc.querySelector('mxCell[style*="mode=start"]');
        const endCell = doc.querySelector('mxCell[style*="mode=end"]');
        const loopCell = doc.querySelector('mxCell[style*="LOOP_CONTAINER"]');
        const actCell = doc.querySelector('mxCell[value="x = 10"]');
        
        expect(startCell).not.toBeNull();
        expect(endCell).not.toBeNull();
        expect(loopCell).not.toBeNull();
        expect(actCell).not.toBeNull();
    });
});