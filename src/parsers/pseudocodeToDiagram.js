export const parsePseudocodeToDrawio = (code, existingXml = null, edgeStyle = 'true-false') => {
    const getNewId = () => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
    
    const edgeLabels = {
        '+-': { t: '+', f: '-' },
        'ano-ne': { t: 'Ano', f: 'Ne' },
        'yes-no': { t: 'Yes', f: 'No' },
        'true-false': { t: 'True', f: 'False' }
    };
    const EL = edgeLabels[edgeStyle] || edgeLabels['true-false'];
    
    let errors = [];
    let declaredFuncs = new Set();
    
    const lines = code.split('\n').map(l => l.trim());
    const blocks = [];
    let currentBlock = [];
    
    for (let line of lines) {
        if (!line && currentBlock.length === 0) continue;
        const upper = line.toUpperCase();
        if (upper.startsWith('FUNCTION ') || upper.startsWith('CLASS ')) {
            if (currentBlock.length > 0) {
                const lastLine = currentBlock[currentBlock.length - 1].toUpperCase();
                if (!lastLine.includes('ENDFUNCTION') && !lastLine.includes('ENDCLASS') && !lastLine.includes('KONEC')) {
                    errors.push(`Tip: Předchozí funkce/třída nebyla ukončena (chybí např. ENDFUNCTION).`);
                }
                blocks.push(currentBlock);
            }
            currentBlock = [line];
        } else if (upper === 'ENDFUNCTION' || upper === 'ENDCLASS' || upper === 'KONEC') {
            currentBlock.push(line);
            blocks.push(currentBlock);
            currentBlock = [];
        } else {
            if(line) currentBlock.push(line);
        }
    }
    if (currentBlock.length > 0) {
        const lastLine = currentBlock[currentBlock.length - 1].toUpperCase();
        if (!lastLine.includes('ENDFUNCTION') && !lastLine.includes('ENDCLASS') && !lastLine.includes('KONEC')) {
            errors.push(`Tip: Kód není na konci správně uzavřen (chybí ENDFUNCTION/ENDCLASS).`);
        }
        blocks.push(currentBlock);
    }

    if (blocks.length === 0) return { xml: '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>', errors: [] };

    let existingNodes = [];
    if (existingXml && existingXml.includes('<mxGraphModel')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(existingXml, "text/xml");
        doc.querySelectorAll('mxCell[vertex="1"]').forEach(cell => {
            let rawVal = cell.getAttribute('value') || '';
            let val = rawVal.replace(/<br\s*\/?>/gi, '\n')
                            .replace(/<\/div>/gi, '\n')
                            .replace(/<\/p>/gi, '\n')
                            .replace(/<\/?(?:b|i|u|span|font|div|p|strong|em|strike|s|sub|sup|h[1-6])(?:\s+[^>]*?)?>/gi, '')
                            .replace(/&nbsp;/gi, ' ')
                            .replace(/&gt;/gi, '>')
                            .replace(/&lt;/gi, '<')
                            .replace(/&amp;/gi, '&')
                            .trim();

            const style = cell.getAttribute('style') || '';
            const geo = cell.querySelector('mxGeometry');
            if (geo) {
                let type = 'ACTION';
                if (style.includes('ellipse') && style.includes('strokeColor=none') && style.includes('fillColor=none')) type = 'MERGE';
                else if (style.includes('ellipse')) type = 'START_END';
                else if (style.includes('rhombus') || style.includes('hexagon')) type = 'CONDITION';
                else if (style.includes('shape=parallelogram')) type = 'IO';
                else if (style.includes('shape=note')) type = 'COMMENT';
                existingNodes.push({ id: cell.getAttribute('id'), val, type, x: parseFloat(geo.getAttribute('x')), y: parseFloat(geo.getAttribute('y')), used: false });
            }
        });
    }

    const getPos = (text, type, defX, currentY) => {
        const normalize = (t) => t.replace(/\(\)$/g, '').replace(/\s+/g, ' ').trim();
        const normalizedTarget = normalize(text);

        const match = existingNodes.find(n => !n.used && n.type === type && normalize(n.val) === normalizedTarget);
        if (match) {
            match.used = true;
            // Dynamické Y (Auto-Layout osy Y)
            return { x: match.x, y: currentY, matched: true, oldId: match.id };
        }
        return { x: defX, y: currentY, matched: false, oldId: getNewId() };
    };

    const getConditionPorts = (isNot) => ({
        tText: isNot ? EL.f : EL.t,
        fText: isNot ? EL.t : EL.f,
        tHandle: isNot ? "s-right" : "s-bottom",
        fHandle: isNot ? "s-bottom" : "s-right"
    });

    const findEndWhile = (linesArr, startIndex) => {
        let depth = 0;
        for (let i = startIndex; i < linesArr.length; i++) {
            let upper = linesArr[i].toUpperCase();
            if (upper.startsWith('WHILE ') || upper.startsWith('FOR ')) depth++;
            else if (upper === 'ENDWHILE' || upper === 'ENDFOR') {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    };

    let outNodes = [];
    let outEdges = [];
    let globalGroupX = 360;
    
    const STYLES = {
        START_END: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
        ACTION: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
        IO: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#d5e8d4;strokeColor=#82b366;",
        CONDITION: "shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;size=0.15;fillColor=#ffe6cc;strokeColor=#d79b00;",
        COMMENT: "shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;darkOpacity=0.05;fillColor=#fff2cc;strokeColor=#d6b656;",
        MERGE: "ellipse;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none;resizable=0;movable=0;rotatable=0;",
        EDGE: "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
    };

    blocks.forEach(blockLines => {
        let funcName = "main";
        let entityType = "FUNCTION";
        let firstUpper = blockLines[0].toUpperCase();
        
        if (firstUpper.startsWith('FUNCTION ')) {
            funcName = blockLines[0].substring(9).replace('()', '').trim();
            blockLines.shift();
        } else if (firstUpper.startsWith('CLASS ')) {
            entityType = "CLASS";
            funcName = blockLines[0].substring(6).replace('()', '').trim();
            blockLines.shift();
        }
        
        if (declaredFuncs.has(funcName)) errors.push(`Chyba: Duplicitní název funkce '${funcName}'`);
        declaredFuncs.add(funcName);

        let hasEnd = false;
        let endLineText = "Konec";
        if (blockLines.length > 0) {
            const lastLine = blockLines[blockLines.length - 1].toUpperCase();
            if (lastLine === 'ENDFUNCTION' || lastLine === 'ENDCLASS' || lastLine === 'KONEC') {
                endLineText = blockLines.pop();
                hasEnd = true;
            }
        }

        let yOffset = 40;
        let startPos = getPos(funcName || "main", 'START_END', globalGroupX, yOffset);
        let startId = startPos.oldId;
        outNodes.push({ id: startId, text: funcName || "main", type: 'START_END', x: startPos.x, y: startPos.y, mode: 'start', entityType });

        let stack = [];
        let lineToNodeId = {};
        let skipSet = new Set();
        yOffset = Math.max(140, startPos.y + 120); 
        let pendingExits = [{ id: startId, text: "", handle: "s-bottom" }];

        const addNode = (text, type, defaultX, extraProps = {}) => {
            const pos = getPos(text, type, defaultX, yOffset);
            outNodes.push({ id: pos.oldId, text, type, x: pos.x, y: pos.y, ...extraProps });
            yOffset = Math.max(yOffset, pos.y) + (type === 'CONDITION' ? 140 : 100);
            return pos.oldId;
        };

        const addEdge = (source, target, value = "", sourceHandle = "s-bottom", targetHandle = "t-top") => {
            outEdges.push({ id: getNewId(), source, target, value, sourceHandle, targetHandle });
        };

        const getXPos = () => {
            let x = globalGroupX;
            for (let i = 0; i < stack.length; i++) {
                if (stack[i].type === 'LOOP') x += 240;
                if (stack[i].type === 'IF' && stack[i].trueExits !== null) x += 240;
            }
            return x;
        };

        for (let i = 0; i < blockLines.length; i++) {
            if (skipSet.has(i)) continue;
            let line = blockLines[i];
            if (!line || line.trim() === '') continue;
            
            let upper = line.toUpperCase();
            
            if (upper.startsWith('//') || upper.startsWith('#')) {
                const cId = addNode(line, 'COMMENT', getXPos() + 160);
                lineToNodeId[i] = cId;
                continue;
            }

            if (upper.startsWith('IF ')) {
                let condText = line.substring(3, upper.lastIndexOf(' THEN')).trim();
                let isNot = false;
                
                let notMatch = condText.match(/^NOT\s*\((.*)\)$/i);
                if (!notMatch) notMatch = condText.match(/^NOT\s+(.*)$/i);
                if (notMatch) {
                    condText = notMatch[1].trim();
                    isNot = true;
                    errors.push(`Tip: Obal 'NOT' u podmínky '${condText}' byl převeden jako prohození větví (+/-) v diagramu.`);
                }

                const condId = addNode(condText, 'CONDITION', getXPos());
                lineToNodeId[i] = condId;
                pendingExits.forEach(exit => addEdge(exit.id, condId, exit.text, exit.handle, "t-top"));
                
                const ports = getConditionPorts(isNot);
                stack.push({ type: 'IF', id: condId, trueExits: null, isNot });
                
                pendingExits = [{ id: condId, text: ports.tText, handle: ports.tHandle }];
            } 
            else if (upper === 'ELSE') {
                const currentIf = stack[stack.length - 1];
                currentIf.trueExits = [...pendingExits]; 
                const ports = getConditionPorts(currentIf.isNot);
                pendingExits = [{ id: currentIf.id, text: ports.fText, handle: ports.fHandle }];
            } 
            else if (upper === 'ENDIF') {
                const currentIf = stack.pop();
                if (currentIf.trueExits === null) {
                    currentIf.trueExits = [...pendingExits];
                    const ports = getConditionPorts(currentIf.isNot);
                    pendingExits = [{ id: currentIf.id, text: ports.fText, handle: ports.fHandle }];
                }
                pendingExits = [...currentIf.trueExits, ...pendingExits];
            }
            else if (upper.startsWith('WHILE ') || upper.startsWith('FOR ')) {
                const isFor = upper.startsWith('FOR ');
                let condText = isFor ? line.substring(0, upper.lastIndexOf(' DO')).trim() : line.substring(6, upper.lastIndexOf(' DO')).trim();
                
                let isNot = false;
                let notMatch = condText.match(/^NOT\s*\((.*)\)$/i);
                if (!notMatch) notMatch = condText.match(/^NOT\s+(.*)$/i);
                if (notMatch) {
                    condText = notMatch[1].trim();
                    isNot = true;
                    errors.push(`Tip: Obal 'NOT' u smyčky '${condText}' byl převeden jako prohození větví (+/-) v diagramu.`);
                }

                let isDoWhile = false;
                let doWhileTargetId = null;
                let endIdx = findEndWhile(blockLines, i);
                
                if (endIdx !== -1) {
                    let loopBody = [];
                    let loopBodyIndices = [];
                    for (let k = i + 1; k < endIdx; k++) {
                        let ln = blockLines[k].trim();
                        if (!ln.startsWith('//') && !ln.startsWith('#') && ln !== '') {
                            loopBody.push(ln);
                            loopBodyIndices.push(k);
                        }
                    }
                    
                    if (loopBody.length > 0) {
                        let preceding = [];
                        let precedingIndices = [];
                        let p = i - 1;
                        while (p >= 0 && preceding.length < loopBody.length) {
                            let ln = blockLines[p].trim();
                            if (!ln.startsWith('//') && !ln.startsWith('#') && ln !== '') {
                                preceding.unshift(ln);
                                precedingIndices.unshift(p);
                            }
                            p--;
                        }
                        
                        if (preceding.length === loopBody.length && preceding.join('\n') === loopBody.join('\n') && lineToNodeId[precedingIndices[0]]) {
                            isDoWhile = true;
                            doWhileTargetId = lineToNodeId[precedingIndices[0]];
                            for (let idx of loopBodyIndices) skipSet.add(idx);
                        }
                    }
                }

                const loopId = addNode(condText, 'CONDITION', getXPos());
                lineToNodeId[i] = loopId;
                
                if (isDoWhile) {
                    pendingExits.forEach(exit => addEdge(exit.id, loopId, exit.text, exit.handle, "t-top"));
                    const ports = getConditionPorts(isNot);
                    addEdge(loopId, doWhileTargetId, ports.tText, ports.tHandle, "t-left");
                    stack.push({ type: 'DO_WHILE', id: loopId, isNot });
                    pendingExits = [{ id: loopId, text: ports.fText, handle: ports.fHandle }];
                } else {
                    pendingExits.forEach(exit => addEdge(exit.id, loopId, exit.text, exit.handle, "t-top"));
                    const ports = getConditionPorts(isNot);
                    stack.push({ type: 'LOOP', id: loopId, mergeId: null, isNot });
                    pendingExits = [{ id: loopId, text: ports.tText, handle: ports.tHandle }];
                }
            }
            else if (upper === 'ENDWHILE' || upper === 'ENDFOR') {
                const currentLoop = stack.pop();
                
                if (currentLoop.type === 'DO_WHILE') {
                    // empty
                } else {
                    pendingExits.forEach(exit => {
                        let returnHandle = exit.id === currentLoop.id ? getConditionPorts(currentLoop.isNot).tHandle : exit.handle;
                        addEdge(exit.id, currentLoop.id, exit.text, returnHandle, "t-left"); 
                    });
                    const ports = getConditionPorts(currentLoop.isNot);
                    pendingExits = [{ id: currentLoop.id, text: ports.fText, handle: ports.fHandle }];
                }
            }
            else {
                let isIo = false;
                let text = line;
                
                if (upper.startsWith('PRINT(') && upper.endsWith(')')) { 
                    isIo = false; 
                    let inner = line.substring(6, line.length - 1).trim();
                    if (inner.startsWith('"') && inner.endsWith('"')) {
                        text = inner;
                    } else {
                        isIo = true; 
                        text = line;
                    }
                } 
                else if (upper.includes('= INPUT()') || upper.includes('=INPUT()')) {
                    isIo = true;
                    text = line.replace(/\s*=\s*INPUT\(\)/i, '').trim();
                }
                else if (upper.startsWith('VSTUP ') || upper === 'VSTUP' || upper.startsWith('RETURN')) {
                    isIo = true;
                }

                let xPos = getXPos();
                const nodeId = addNode(text, isIo ? 'IO' : 'ACTION', xPos);
                lineToNodeId[i] = nodeId;
                
                pendingExits.forEach(exit => addEdge(exit.id, nodeId, exit.text, exit.handle, "t-top"));
                pendingExits = [{ id: nodeId, text: "", handle: "s-bottom" }];
            }
        }

        if (hasEnd) {
            const endId = addNode(endLineText, 'START_END', globalGroupX, { mode: 'end' });
            pendingExits.forEach(exit => addEdge(exit.id, endId, exit.text, exit.handle, "t-top"));
            pendingExits = [];
        }

        globalGroupX += 600; 
    });

    let xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">\n  <root>\n    <mxCell id="0" />\n    <mxCell id="1" parent="0" />\n`;

    outNodes.forEach(n => {
        let w = 120, h = 60;
        if (n.type === 'CONDITION') { w = 140; h = 70; }
        if (n.type === 'START_END') { w = 100; h = 40; }
        if (n.type === 'COMMENT') { w = 180; h = 50; }
        if (n.type === 'MERGE') { w = 10; h = 10; }
        
        let style = STYLES[n.type] || n.type;
        if (n.mode) style += `mode=${n.mode};`;
        if (n.entityType) style += `entityType=${n.entityType};`;

        const safeText = (n.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        xml += `    <mxCell id="${n.id}" value="${safeText}" style="${style}" vertex="1" parent="1">\n`;
        xml += `      <mxGeometry x="${n.x}" y="${n.y}" width="${w}" height="${h}" as="geometry" />\n`;
        xml += `    </mxCell>\n`;
    });

    outEdges.forEach(e => {
        let style = STYLES.EDGE + `sourceHandle=${e.sourceHandle};targetHandle=${e.targetHandle};`;
        
        if (e.targetHandle === 't-right') style += "entryX=1;entryY=0.5;entryDx=0;entryDy=0;";
        else if (e.targetHandle === 't-left') style += "entryX=0;entryY=0.5;entryDx=0;entryDy=0;";
        else if (e.targetHandle === 't-top') style += "entryX=0.5;entryY=0;entryDx=0;entryDy=0;";

        if (e.sourceHandle === 's-right') style += "exitX=1;exitY=0.5;exitDx=0;exitDy=0;";
        else if (e.sourceHandle === 's-left') style += "exitX=0;exitY=0.5;exitDx=0;exitDy=0;";
        else if (e.sourceHandle === 's-bottom') style += "exitX=0.5;exitY=1;exitDx=0;exitDy=0;";

        const targetNode = outNodes.find(n => n.id === e.target);
        if (targetNode && targetNode.type === 'MERGE') style += "endArrow=none;";

        xml += `    <mxCell id="${e.id}" value="${e.value}" style="${style}" edge="1" parent="1" source="${e.source}" target="${e.target}">\n`;
        xml += `      <mxGeometry relative="1" as="geometry" />\n`;
        xml += `    </mxCell>\n`;
    });

    xml += `  </root>\n</mxGraphModel>`;
    return { xml, errors };
};