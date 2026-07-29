import { parsePseudocodeToDrawio } from '../src/parsers/pseudocodeToDiagram.js';
import { parseDrawioToPseudocode } from '../src/parsers/diagramToPseudocode.js';
import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;

const pseudo = `FUNCTION main()
    ACTION Operace 1
    WHILE x > 0 DO
        ACTION Operace 1
    ENDWHILE
ENDFUNCTION`;

const res = parsePseudocodeToDrawio(pseudo);
console.log("XML Output has doWhile=true?", res.xml.includes('doWhile="true"'));
console.log(res.xml);

const pseudoBack = parseDrawioToPseudocode(res.xml);
console.log("Pseudo Back:");
console.log(pseudoBack.code);
console.log("Errors:", pseudoBack.errors);
