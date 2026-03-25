export const parsePseudocodeToDrawio = (code, existingXml = null, edgeStyle = 'ano-ne') => {
    let idCounter = 2; 
    const getNewId = () => (idCounter++).toString();
    
    const edgeLabels = {
        '+-': { t: '+', f: '-' },
        'ano-ne': { t: 'Ano', f: 'Ne' },
        'yes-no': { t: 'Yes', f: 'No' },
        'check-cross': { t: '✔', f: '✖' },
        'true-false': { t: 'True', f: 'False' }
    };
    const EL = edgeLabels[edgeStyle] || edgeLabels['ano-ne'];
    
    let lines = code.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

    // --- LOGIKA PRO ZACHOVÁNÍ POZIC UZIVATELSKÝCH BLOKŮ ---
    let existingNodes = [];
    if (existingXml && existingXml.includes('<mxGraphModel')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(existingXml, "text/xml");
        doc.querySelectorAll('mxCell[vertex="1"]').forEach(cell => {
            const val = (cell.getAttribute('value') || '').replace(/<[^>]*>?/gm, '').trim();
            const style = cell.getAttribute('style') || '';
            const geo = cell.querySelector('mxGeometry');
            if (geo) {
                let type = 'ACTION';
                if (style.includes('ellipse')) type = 'START_END';
                else if (style.includes('rhombus')) type = 'CONDITION';
                else if (style.includes('shape=parallelogram')) type = 'IO';
                else if (style.includes('shape=note')) type = 'COMMENT';
                existingNodes.push({ val, type, x: parseFloat(geo.getAttribute('x')), y: parseFloat(geo.getAttribute('y')), used: false });
            }
        });
    }

    const getPos = (text, type, defX, defY) => {
        const match = existingNodes.find(n => !n.used && n.type === type && n.val === text);
        if (match) {
            match.used = true;
            return { x: match.x, y: match.y };
        }
        return { x: defX, y: defY };
    };
    // --------------------------------------------------------

    let nodes = [];
    let edges = [];
    
    const STYLES = {
        START_END: "ellipse;whiteSpace=wrap;html=1;",
        ACTION: "whiteSpace=wrap;html=1;",
        IO: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;",
        CONDITION: "rhombus;whiteSpace=wrap;html=1;",
        COMMENT: "shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;darkOpacity=0.05;fillColor=#fff2cc;strokeColor=#d6b656;",
        EDGE: "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
    };

    let funcName = "Start";
    if (lines[0].toUpperCase().startsWith('FUNCTION ')) {
        funcName = lines[0].substring(9).replace('()', '').trim();
        lines.shift();
    } else if (lines[0].toUpperCase().startsWith('CLASS ')) {
        funcName = lines[0].substring(6).replace('()', '').trim();
        lines.shift();
    }
    
    if (lines.length > 0 && (lines[lines.length - 1].toUpperCase() === 'ENDFUNCTION' || lines[lines.length - 1].toUpperCase() === 'ENDCLASS')) {
        lines.pop();
    }

    let startId = getNewId();
    let startPos = getPos(funcName || "main", 'START_END', 360, 40);
    nodes.push({ id: startId, text: funcName || "main", type: 'START_END', x: startPos.x, y: startPos.y });

    let stack = [];
    let lastNodeId = startId;
    let yOffset = 160; // ZVĚTŠENÝ ROZESTUP
    let pendingExitText = null;

    const addNode = (text, type, defaultX, defaultY) => {
        const id = getNewId();
        const pos = getPos(text, type, defaultX, defaultY);
        nodes.push({ id, text, type, x: pos.x, y: pos.y });
        return id;
    };

    const addEdge = (source, target, value = "", sourceHandle = "s-bottom", targetHandle = "t-top") => {
        edges.push({ id: getNewId(), source, target, value, sourceHandle, targetHandle });
    };

    const getXPos = () => {
        let x = 360;
        for (let i = 0; i < stack.length; i++) {
            const s = stack[i];
            if (s.type === 'LOOP') x += 240; // ZVĚTŠENÝ HORIZONTÁLNÍ ROZESTUP
            if (s.type === 'IF' && s.trueLast !== null) x += 240;
        }
        return x;
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let upper = line.toUpperCase();
        
        if (upper.startsWith('//') || upper.startsWith('#')) {
            addNode(line, 'COMMENT', getXPos() + 160, yOffset - 20);
            continue;
        }

        if (upper.startsWith('IF ')) {
            const condText = line.substring(3, upper.lastIndexOf(' THEN')).trim();
            const condId = addNode(condText, 'CONDITION', getXPos(), yOffset);
            
            let inText = pendingExitText || "";
            pendingExitText = null;
            addEdge(lastNodeId, condId, inText, "s-bottom", "t-top");
            
            stack.push({ type: 'IF', id: condId, endY: yOffset, trueLast: null });
            lastNodeId = condId;
            yOffset += 140; // ZVĚTŠENÝ ODSKOK
        } 
        else if (upper === 'ELSE') {
            const currentIf = stack[stack.length - 1];
            currentIf.trueLast = lastNodeId;
            lastNodeId = currentIf.id; 
            yOffset = currentIf.endY + 140; 
        } 
        else if (upper === 'ENDIF') {
            const currentIf = stack.pop();
            const endIfId = addNode("", "ellipse;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none;", getXPos(), yOffset); 
            
            if (currentIf.trueLast) {
                addEdge(currentIf.trueLast, endIfId, "", "s-bottom", "t-top");
                addEdge(lastNodeId, endIfId, "", "s-bottom", "t-top");
            } else {
                if (lastNodeId === currentIf.id) {
                    addEdge(currentIf.id, endIfId, EL.t, "s-bottom", "t-top"); 
                    addEdge(currentIf.id, endIfId, EL.f, "s-right", "t-top"); 
                } else {
                    addEdge(lastNodeId, endIfId, "", "s-bottom", "t-top"); 
                    addEdge(currentIf.id, endIfId, EL.f, "s-right", "t-top"); 
                }
            }
            
            lastNodeId = endIfId;
            yOffset += 100;
        }
        else if (upper.startsWith('WHILE ') || upper.startsWith('FOR ')) {
            const isFor = upper.startsWith('FOR ');
            const condText = isFor ? line.substring(0, upper.lastIndexOf(' DO')).trim() : line.substring(6, upper.lastIndexOf(' DO')).trim();
            
            const loopId = addNode(condText, 'CONDITION', getXPos(), yOffset);
            let inText = pendingExitText || "";
            pendingExitText = null;
            addEdge(lastNodeId, loopId, inText, "s-bottom", "t-top");
            
            stack.push({ type: 'LOOP', id: loopId });
            lastNodeId = loopId;
            yOffset += 140;
        }
        else if (upper === 'ENDWHILE' || upper === 'ENDFOR') {
            const currentLoop = stack.pop();
            addEdge(lastNodeId, currentLoop.id, "", "s-bottom", "t-left"); 
            
            lastNodeId = currentLoop.id; 
            pendingExitText = EL.f;
            yOffset += 100;
        }
        else {
            let isIo = false;
            let text = line;
            
            if (upper.startsWith('PRINT(') && upper.endsWith(')')) {
                isIo = true;
                text = line.substring(6, line.length - 1);
            } else if (upper.startsWith('VSTUP ')) {
                isIo = true;
            } else if (upper.startsWith('RETURN')) {
                isIo = true;
            }

            let xPos = getXPos();
            if (stack.length > 0 && stack[stack.length - 1].type === 'IF' && stack[stack.length - 1].trueLast) {
                xPos += 240; 
            }

            const nodeId = addNode(text, isIo ? 'IO' : 'ACTION', xPos, yOffset);
            
            let edgeText = "";
            let srcHandle = "s-bottom";

            if (pendingExitText) {
                edgeText = pendingExitText;
                pendingExitText = null;
                srcHandle = "s-right";
            } else if (stack.length > 0) {
                const parent = stack[stack.length - 1];
                if (lastNodeId === parent.id) {
                    edgeText = (parent.type === 'IF' && parent.trueLast) ? EL.f : EL.t;
                    srcHandle = edgeText === EL.f ? "s-right" : "s-bottom";
                }
            }
            
            addEdge(lastNodeId, nodeId, edgeText, srcHandle, "t-top");
            lastNodeId = nodeId;
            yOffset += 140;
        }
    }

    const endId = addNode("Konec", 'START_END', 360, yOffset);
    let finalEdgeText = pendingExitText || (stack.length > 0 ? EL.f : "");
    let finalSrcHandle = pendingExitText ? "s-right" : "s-bottom";
    addEdge(lastNodeId, endId, finalEdgeText, finalSrcHandle, "t-top");

    let xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">\n  <root>\n    <mxCell id="0" />\n    <mxCell id="1" parent="0" />\n`;

    nodes.forEach(n => {
        let w = 120, h = 60;
        if (n.type === 'CONDITION') { w = 80; h = 80; }
        if (n.type === 'START_END') { w = 100; h = 40; }
        if (n.type === 'COMMENT') { w = 140; h = 50; }
        const safeText = n.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        xml += `    <mxCell id="${n.id}" value="${safeText}" style="${STYLES[n.type] || n.type}" vertex="1" parent="1">\n`;
        xml += `      <mxGeometry x="${n.x}" y="${n.y}" width="${w}" height="${h}" as="geometry" />\n`;
        xml += `    </mxCell>\n`;
    });

    edges.forEach(e => {
        let style = STYLES.EDGE + `sourceHandle=${e.sourceHandle};targetHandle=${e.targetHandle};`;
        xml += `    <mxCell id="${e.id}" value="${e.value}" style="${style}" edge="1" parent="1" source="${e.source}" target="${e.target}">\n`;
        xml += `      <mxGeometry relative="1" as="geometry" />\n`;
        xml += `    </mxCell>\n`;
    });

    xml += `  </root>\n</mxGraphModel>`;
    return xml;
};