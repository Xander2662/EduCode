import { parseDrawioToPseudocode } from './src/parsers/diagramToPseudocode.js';
import { parsePseudocodeToDrawio } from './src/parsers/pseudocodeToDiagram.js';
import fs from 'fs';
import { JSDOM } from 'jsdom';

global.DOMParser = new JSDOM().window.DOMParser;

console.log("=== WhileGroupDoOnceTrue ===");
const xml2 = fs.readFileSync('examples/diagram_examples/WhileGroupDoOnceTrue.xml', 'utf-8');
const res2 = parseDrawioToPseudocode(xml2);
console.log(res2.code);

console.log("--- XML GENERATION ---");
const xmlRes = parsePseudocodeToDrawio(res2.code);

