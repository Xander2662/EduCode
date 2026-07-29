import { parsePseudocodeToDrawio } from './pseudocodeToDiagram.js';
import { parseDrawioToPseudocode } from './diagramToPseudocode.js';
import fs from 'fs';
import { JSDOM } from 'jsdom';

global.DOMParser = new JSDOM().window.DOMParser;

// 1. Start with a DO WHILE pseudocode in simple mode
const initialPseudoDoWhile = `FUNCTION main()
    DO
        ACTION x = x + 1
    WHILE x < 10
ENDFUNCTION`;

console.log("=== TEST 1: Simple Mode DO-WHILE ===");
console.log("Initial Pseudo:\n" + initialPseudoDoWhile);

const res1 = parsePseudocodeToDrawio(initialPseudoDoWhile, null, "true-false", "hexagon", "simple");
console.log("Generated XML for Simple DO-WHILE (Should contain LOOP_CONTAINER with doWhile=true):");
console.log(res1.xml.includes('type="LOOP_CONTAINER"') && res1.xml.includes('doWhile="true"') ? "PASS: Has LOOP_CONTAINER with doWhile=true" : "FAIL: Missing attributes");

// 2. Parse back to pseudo
console.log("res1.xml length:", res1.xml.length);
const backToPseudo1 = parseDrawioToPseudocode(res1.xml);
console.log("Converted back to Pseudo:\n" + backToPseudo1.code);
console.log("Errors: ", backToPseudo1.errors);
if (backToPseudo1.code.includes("DO") && backToPseudo1.code.includes("WHILE x < 10")) {
    console.log("PASS: Converts back to DO...WHILE correctly");
} else {
    console.log("FAIL: Did not convert back properly");
}

// 3. Start with a WHILE loop pseudocode in simple mode
const initialPseudoWhile = `FUNCTION main()
    WHILE x > 0 DO
        ACTION x = x - 1
    ENDWHILE
ENDFUNCTION`;

console.log("\n=== TEST 2: Simple Mode WHILE ===");
console.log("Initial Pseudo:\n" + initialPseudoWhile);

const res2 = parsePseudocodeToDrawio(initialPseudoWhile, null, "true-false", "hexagon", "simple");
console.log("Generated XML for Simple WHILE (Should contain LOOP_CONTAINER with doWhile=false):");
console.log(res2.xml.includes('type="LOOP_CONTAINER"') && res2.xml.includes('doWhile="false"') ? "PASS: Has LOOP_CONTAINER with doWhile=false" : "FAIL: Missing attributes");

// 4. Parse back to pseudo
const backToPseudo2 = parseDrawioToPseudocode(res2.xml);
console.log("Converted back to Pseudo:\n" + backToPseudo2.code);
if (backToPseudo2.code.includes("WHILE x > 0 DO") && backToPseudo2.code.includes("ENDWHILE")) {
    console.log("PASS: Converts back to WHILE...ENDWHILE correctly");
} else {
    console.log("FAIL: Did not convert back properly");
}

