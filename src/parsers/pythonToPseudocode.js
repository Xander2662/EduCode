export const parsePythonToPseudocode = (pythonCode) => {
    let pseudocodeLines = [];
    const lines = pythonCode.split('\n');
    let scopeStack = []; 

    const formatCondition = (cond) => {
        return cond.replace(/\band\b/gi, 'AND')
                   .replace(/\bor\b/gi, 'OR')
                   .replace(/\bnot\b/gi, 'NOT')
                   .replace(/\bTrue\b/g, 'TRUE')
                   .replace(/\bFalse\b/g, 'FALSE');
    };

    const getIndentString = (spaces) => ' '.repeat(spaces);

    for (let i = 0; i < lines.length; i++) {
        let rawLine = lines[i];
        let trimmed = rawLine.trim();
        if (!trimmed) {
            pseudocodeLines.push(rawLine);
            continue;
        }

        if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
            if (trimmed.includes('----------------------')) {
                pseudocodeLines.push(rawLine);
                continue;
            }
            pseudocodeLines.push(rawLine);
            continue;
        }

        const indentSpaces = rawLine.length - rawLine.trimStart().length;

        let vIndent = indentSpaces;
        if (scopeStack.length > 0) {
            let top = scopeStack[scopeStack.length - 1];
            if (top.visualIndent > top.triggerIndent) {
                 vIndent = indentSpaces + (top.visualIndent - top.triggerIndent);
            }
        }

        while (scopeStack.length > 0) {
            const top = scopeStack[scopeStack.length - 1];
            
            if (top.triggerIndent === indentSpaces) {
                if (top.type === 'IF' && (trimmed.startsWith('else:') || trimmed.startsWith('elif '))) {
                    break;
                }
            }

            if (indentSpaces <= top.triggerIndent) {
                const popped = scopeStack.pop();
                let endKeyword = 'END' + popped.type.replace('ELSE', 'IF');
                pseudocodeLines.push(getIndentString(popped.visualIndent) + endKeyword);
            } else {
                break;
            }
        }

        if (trimmed === "if __name__ == '__main__':" || trimmed === "main()") {
             continue;
        }

        if (trimmed === 'pass') {
             continue;
        }

        if (trimmed.startsWith('def ')) {
            let funcName = trimmed.substring(4).replace(':', '').trim();
            pseudocodeLines.push(`${getIndentString(indentSpaces)}FUNCTION ${funcName}`);
            scopeStack.push({ type: 'FUNCTION', triggerIndent: indentSpaces, visualIndent: indentSpaces });
            continue;
        }

        if (trimmed.startsWith('class ')) {
            let className = trimmed.substring(6).replace(':', '').trim();
            pseudocodeLines.push(`${getIndentString(indentSpaces)}CLASS ${className}`);
            scopeStack.push({ type: 'CLASS', triggerIndent: indentSpaces, visualIndent: indentSpaces });
            continue;
        }

        if (trimmed.startsWith('if ')) {
            let cond = trimmed.substring(3).replace(/:$/, '').trim();
            cond = formatCondition(cond);
            pseudocodeLines.push(`${getIndentString(indentSpaces)}IF ${cond} THEN`);
            scopeStack.push({ type: 'IF', triggerIndent: indentSpaces, visualIndent: indentSpaces });
            continue;
        }

        if (trimmed.startsWith('elif ')) {
            if (scopeStack.length > 0 && scopeStack[scopeStack.length - 1].type === 'IF' && scopeStack[scopeStack.length - 1].triggerIndent === indentSpaces) {
                let top = scopeStack.pop();
                pseudocodeLines.push(`${getIndentString(top.visualIndent)}ELSE`);
                scopeStack.push({ type: 'ELSE', triggerIndent: indentSpaces, visualIndent: top.visualIndent });
                
                let cond = trimmed.substring(5).replace(/:$/, '').trim();
                cond = formatCondition(cond);
                let newVisualIndent = top.visualIndent + 4;
                pseudocodeLines.push(`${getIndentString(newVisualIndent)}IF ${cond} THEN`);
                scopeStack.push({ type: 'IF', triggerIndent: indentSpaces, visualIndent: newVisualIndent });
                continue;
            }
        }

        if (trimmed === 'else:') {
            if (scopeStack.length > 0 && scopeStack[scopeStack.length - 1].type === 'IF' && scopeStack[scopeStack.length - 1].triggerIndent === indentSpaces) {
                let top = scopeStack.pop(); 
                pseudocodeLines.push(`${getIndentString(top.visualIndent)}ELSE`);
                scopeStack.push({ type: 'ELSE', triggerIndent: indentSpaces, visualIndent: top.visualIndent });
                continue;
            }
        }

        if (trimmed.startsWith('while ')) {
            let cond = trimmed.substring(6).replace(/:$/, '').trim();
            cond = formatCondition(cond);
            pseudocodeLines.push(`${getIndentString(indentSpaces)}WHILE ${cond} DO`);
            scopeStack.push({ type: 'WHILE', triggerIndent: indentSpaces, visualIndent: indentSpaces });
            continue;
        }

        if (trimmed.startsWith('for ')) {
            let cond = trimmed.substring(4).replace(/:$/, '').trim();
            cond = formatCondition(cond);
            pseudocodeLines.push(`${getIndentString(indentSpaces)}FOR ${cond} DO`);
            scopeStack.push({ type: 'FOR', triggerIndent: indentSpaces, visualIndent: indentSpaces });
            continue;
        }

        if (trimmed.startsWith('return ')) {
            pseudocodeLines.push(`${getIndentString(vIndent)}RETURN ${trimmed.substring(7).trim()}`);
            continue;
        }

        if (trimmed.startsWith('print(') && trimmed.endsWith(')')) {
            let inner = trimmed.substring(6, trimmed.length - 1).trim();
            pseudocodeLines.push(`${getIndentString(vIndent)}PRINT(${inner})`);
            continue;
        }
        
        if (trimmed.includes('=') && trimmed.includes('input(')) {
            let left = trimmed.split('=')[0].trim();
            pseudocodeLines.push(`${getIndentString(vIndent)}VSTUP ${left}`);
            continue;
        }

        // Generic statement
        pseudocodeLines.push(`${getIndentString(vIndent)}${trimmed}`);
    }

    while (scopeStack.length > 0) {
        const popped = scopeStack.pop();
        let endKeyword = 'END' + popped.type.replace('ELSE', 'IF');
        pseudocodeLines.push(getIndentString(popped.visualIndent) + endKeyword);
    }

    return pseudocodeLines.join('\n').trim();
};
