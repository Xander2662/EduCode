export const parsePseudocodeToPython = (code) => {
    let pythonLines = [];
    let indentLevel = 0;
    
    const lines = code.split('\n');
    let expectedPass = false;

    const getIndent = (lvl) => '    '.repeat(Math.max(0, lvl));

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) {
            pythonLines.push('');
            continue;
        }

        // Handle Comments
        if (line.startsWith('#') || line.startsWith('//')) {
            let comment = line.replace(/^[\/#\s]+/, '');
            if (comment.includes('----------------------')) {
                pythonLines.push(`# ${comment}`);
                continue;
            }
            pythonLines.push(`${getIndent(indentLevel)}# ${comment}`);
            continue;
        }

        // Logic check for empty blocks
        const isEndMarker = /^(ENDIF|ENDWHILE|ENDFOR|ELSE|ENDFUNCTION|ENDCLASS|END)/i.test(line);
        if (expectedPass && isEndMarker) {
            pythonLines.push(`${getIndent(indentLevel)}pass`);
        }
        expectedPass = false;

        if (/^(ENDFUNCTION|ENDCLASS|END)/i.test(line)) {
            indentLevel = Math.max(0, indentLevel - 1);
            continue;
        }

        if (/^ENDIF/i.test(line) || /^ENDWHILE/i.test(line) || /^ENDFOR/i.test(line)) {
            indentLevel = Math.max(0, indentLevel - 1);
            continue;
        }

        if (/^ELSE/i.test(line)) {
            indentLevel = Math.max(0, indentLevel - 1);
            pythonLines.push(`${getIndent(indentLevel)}else:`);
            indentLevel++;
            expectedPass = true;
            continue;
        }

        const formatCondition = (cond) => {
            return cond.replace(/\bOR\b/gi, 'or')
                       .replace(/\bAND\b/gi, 'and')
                       .replace(/\bNOT\b/gi, 'not')
                       .replace(/\bTRUE\b/gi, 'True')
                       .replace(/\bFALSE\b/gi, 'False');
        };

        if (/^FUNCTION\s+/i.test(line)) {
            let funcDef = line.replace(/^FUNCTION\s+/i, 'def ').trim();
            if (!funcDef.includes('(')) funcDef += '()';
            if (!funcDef.endsWith(':')) funcDef += ':';
            pythonLines.push(`${getIndent(indentLevel)}${funcDef}`);
            indentLevel++;
            expectedPass = true;
            continue;
        }
        
        if (/^CLASS\s+/i.test(line)) {
            let classDef = line.replace(/^CLASS\s+/i, 'class ').trim();
            if (!classDef.endsWith(':')) classDef += ':';
            pythonLines.push(`${getIndent(indentLevel)}${classDef}`);
            indentLevel++;
            expectedPass = true;
            continue;
        }

        if (/^IF\s+/i.test(line)) {
            let cond = line.replace(/^IF\s+/i, '').replace(/\s+THEN$/i, '').trim();
            cond = formatCondition(cond);
            pythonLines.push(`${getIndent(indentLevel)}if ${cond}:`);
            indentLevel++;
            expectedPass = true;
            continue;
        }

        if (/^WHILE\s+/i.test(line)) {
            let cond = line.replace(/^WHILE\s+/i, '').replace(/\s+DO$/i, '').trim();
            cond = formatCondition(cond);
            pythonLines.push(`${getIndent(indentLevel)}while ${cond}:`);
            indentLevel++;
            expectedPass = true;
            continue;
        }

        if (/^FOR\s+/i.test(line)) {
            let cond = line.replace(/^FOR\s+/i, '').replace(/\s+DO$/i, '').trim();
            cond = formatCondition(cond);
            pythonLines.push(`${getIndent(indentLevel)}for ${cond}:`);
            indentLevel++;
            expectedPass = true;
            continue;
        }

        if (/^RETURN/i.test(line)) {
            let ret = line.replace(/^RETURN/i, 'return');
            pythonLines.push(`${getIndent(indentLevel)}${ret}`);
            continue;
        }

        if (/^VSTUP/i.test(line)) {
            let vars = line.replace(/^VSTUP\s+/i, '').split(',').map(v => v.trim()).filter(Boolean);
            if (vars.length === 0) vars = ['x'];
            vars.forEach(v => {
                let cleanV = v.replace(/\[.*\]/, '').trim();
                pythonLines.push(`${getIndent(indentLevel)}${cleanV} = input()`);
            });
            continue;
        }

        if (/^PRINT/i.test(line)) {
            let inner = line.replace(/^PRINT/i, '').trim();
            if (inner.startsWith('(') && inner.endsWith(')')) {
                inner = inner.substring(1, inner.length - 1).trim();
            }
            pythonLines.push(`${getIndent(indentLevel)}print(${inner})`);
            continue;
        }

        // Generic statement
        let val = line;
        if (val.startsWith('"') && val.endsWith('"')) {
            pythonLines.push(`${getIndent(indentLevel)}print(${val})`);
        } else if (!val.includes('=') && !val.includes('(') && !val.includes(')')) {
             pythonLines.push(`${getIndent(indentLevel)}${val}()`);
        } else {
             pythonLines.push(`${getIndent(indentLevel)}${val}`);
        }
    }

    let finalCode = pythonLines.join('\n').trim();
    if (finalCode.length === 0) finalCode = "pass";
    
    // Auto-call fragments if they look like standalone scripts
    if (finalCode.includes("def main():")) {
        finalCode += "\n\nif __name__ == '__main__':\n    main()";
    }

    return finalCode;
};