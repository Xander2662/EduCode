export const parseDrawioToPython = (xml) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const cells = Array.from(doc.querySelectorAll('mxCell'));

    let nodes = {};
    let edges = [];
    let errors = [];

    const cleanTextWithLines = (html) => {
      if (!html) return '';
      let t = html.replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<\/div>/gi, '\n')
                  .replace(/<\/p>/gi, '\n');
                  
      t = t.replace(/<\/?(?:b|i|u|span|font|div|p|strong|em|strike|s|sub|sup|h[1-6])(?:\s+[^>]*?)?>/gi, '');
      
      t = t.replace(/&nbsp;/gi, ' ')
           .replace(/&gt;/gi, '>')
           .replace(/&lt;/gi, '<')
           .replace(/&amp;/gi, '&')
           .replace(/\u00A0/g, ' ');
           
      return t.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
    };

    cells.forEach(cell => {
      const id = cell.getAttribute('id');
      const vertex = cell.getAttribute('vertex');
      const edge = cell.getAttribute('edge');

      if (vertex === '1') {
        let value = cleanTextWithLines(cell.getAttribute('value'));
        const style = cell.getAttribute('style') || '';
        const cellTypeAttr = cell.getAttribute('type');
        const geo = cell.querySelector('mxGeometry');
        const x = geo ? parseFloat(geo.getAttribute('x') || 0) : 0;
        const y = geo ? parseFloat(geo.getAttribute('y') || 0) : 0;

        let doWhile = false;
        let forInit = '';
        let forLimit = '';
        let forStep = '';
        let switchVar = '';
        let caseVal = '';
        let isDefault = false;
        
        let type = 'ACTION';
        if (style.includes('shape=note') || style.includes('fillColor=#fff2cc') || value.startsWith('#') || value.startsWith('//')) type = 'COMMENT';
        else if (style.includes('ellipse') && style.includes('strokeColor=none') && style.includes('fillColor=none')) type = 'MERGE';
        else if (style.includes('ellipse') || style.includes('mode=start') || style.includes('mode=end') || value.toUpperCase() === 'START' || value.toUpperCase() === 'MAIN') {
            const modeMatch = style.match(/mode=([^;]+)/);
            const mode = modeMatch ? modeMatch[1] : null;
            if (mode === 'end' || value.toUpperCase() === 'ENDFUNCTION' || value.toUpperCase() === 'ENDCLASS' || value.toUpperCase() === 'KONEC') type = 'END';
            else type = 'START';
        }
        else if (style.includes('rhombus') || style.includes('hexagon')) type = 'CONDITION';
        else if (style.includes('shape=parallelogram') || cellTypeAttr === 'IO' || cellTypeAttr === 'io') {
            type = 'IO';
        }
        else if (style.includes('swimlane') || style.includes('LOOP_CONTAINER') || cellTypeAttr === 'LOOP_CONTAINER' || style.includes('FOR_CONTAINER') || cellTypeAttr === 'FOR_CONTAINER' || style.includes('forInit=') || cell.getAttribute('forInit') || style.includes('SWITCH_CONTAINER') || cellTypeAttr === 'SWITCH_CONTAINER' || style.includes('CASE_CONTAINER') || cellTypeAttr === 'CASE_CONTAINER') {
            if (style.includes('SWITCH_CONTAINER') || cellTypeAttr === 'SWITCH_CONTAINER') type = 'SWITCH_CONTAINER';
            else if (style.includes('CASE_CONTAINER') || cellTypeAttr === 'CASE_CONTAINER') type = 'CASE_CONTAINER';
            else if (style.includes('FOR_CONTAINER') || cellTypeAttr === 'FOR_CONTAINER' || style.includes('forInit=') || cell.getAttribute('forInit') || value.toUpperCase().startsWith('FOR ')) type = 'FOR_CONTAINER';
            else type = 'LOOP_CONTAINER';
            
            try {
                doWhile = cell.getAttribute('doWhile') === 'true';
                if (!doWhile && style.includes('doWhile=true')) {
                    doWhile = true;
                }
            } catch {
            }
            if (type === 'FOR_CONTAINER') {
                const initMatch = style.match(/forInit=([^;]+)/);
                forInit = initMatch ? decodeURIComponent(initMatch[1]) : (cell.getAttribute('forInit') ? decodeURIComponent(cell.getAttribute('forInit')) : '');
                
                const limitMatch = style.match(/forLimit=([^;]+)/);
                forLimit = limitMatch ? decodeURIComponent(limitMatch[1]) : (cell.getAttribute('forLimit') ? decodeURIComponent(cell.getAttribute('forLimit')) : '');
                
                const stepMatch = style.match(/forStep=([^;]+)/);
                forStep = stepMatch ? decodeURIComponent(stepMatch[1]) : (cell.getAttribute('forStep') ? decodeURIComponent(cell.getAttribute('forStep')) : '');

                if (!forInit && value.toUpperCase().startsWith('FOR ')) {
                    const forMatch = value.match(/^FOR\s+([a-zA-Z_]\w*)\s*(?:=|<-)\s*(.*?)\s+TO\s+(.*?)(?:\s+STEP\s+(.*?))?(?:\s+DO)?$/i);
                    if (forMatch) {
                        forInit = `${forMatch[1]} = ${forMatch[2].trim()}`;
                        forLimit = forMatch[3].trim();
                        forStep = forMatch[4] ? forMatch[4].trim() : '1';
                    }
                }
                if (!forInit) forInit = 'i = 0';
                if (!forLimit) forLimit = '10';
                if (!forStep) forStep = '1';
            }
            if (style.includes('switchVar=')) {
                const svMatch = style.match(/switchVar=([^;]+)/);
                if (svMatch) switchVar = decodeURIComponent(svMatch[1]);
            }
            if (style.includes('caseVal=')) {
                const cvMatch = style.match(/caseVal=([^;]+)/);
                if (cvMatch) caseVal = decodeURIComponent(cvMatch[1]);
            }
            if (style.includes('isDefault=')) {
                const defMatch = style.match(/isDefault=([^;]+)/);
                if (defMatch) isDefault = defMatch[1] === 'true';
            }
        }
        
        let isSwapped = false;
        if (style.includes('isSwapped=')) {
            const swMatch = style.match(/isSwapped=([^;]+)/);
            if (swMatch) isSwapped = swMatch[1] === 'true';
        }
        
        const entityMatch = style.match(/entityType=([^;]+)/);
        const entityType = entityMatch ? entityMatch[1] : 'FUNCTION';
        
        const ioMatch = style.match(/ioType=([^;]+)/);
        const ioType = ioMatch ? ioMatch[1] : 'input';

        const width = geo ? parseFloat(geo.getAttribute('width') || 0) : 0;
        const height = geo ? parseFloat(geo.getAttribute('height') || 0) : 0;
        const parentId = cell.getAttribute('parent');

        nodes[id] = { id, value, type, x, y, width, height, next: [], prev: [], entityType, ioType, doWhile, forInit, forLimit, forStep, switchVar, caseVal, isDefault, isSwapped, parentId };
      } 
      else if (edge === '1') {
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        const value = cleanTextWithLines(cell.getAttribute('value')).toLowerCase().replace('\n', ' ');
        const style = cell.getAttribute('style') || '';
        const shMatch = style.match(/sourceHandle=([^;]+)/);
        const sourceHandle = shMatch ? shMatch[1] : undefined;
        if (source && target) edges.push({ source, target, value, sourceHandle });
      }
    });

    edges.forEach(e => {
      if (nodes[e.source] && nodes[e.target]) {
        nodes[e.source].next.push(e);
        nodes[e.target].prev.push(e);
      }
    });

    Object.values(nodes).filter(n => n.type === 'SWITCH_CONTAINER').forEach(switchNode => {
        const cases = Object.values(nodes).filter(n => n.type === 'CASE_CONTAINER' && n.parentId === switchNode.id);
        cases.sort((a, b) => {
            if (a.isDefault) return 1;
            if (b.isDefault) return -1;
            return a.x - b.x;
        });
        const mergeEdges = [...switchNode.next];
        switchNode.next = [];
        
        cases.forEach(caseNode => {
            const edgeToCase = { source: switchNode.id, target: caseNode.id, value: caseNode.isDefault ? 'default' : caseNode.caseVal };
            switchNode.next.push(edgeToCase);
            caseNode.prev.push(edgeToCase);
            
            const blocksInside = Object.values(nodes).filter(n => n.id !== caseNode.id && n.parentId === caseNode.id);
            if (blocksInside.length > 0) {
                blocksInside.sort((a, b) => a.y - b.y);
                
                for (let i = 0; i < blocksInside.length - 1; i++) {
                    const curr = blocksInside[i];
                    const nxt = blocksInside[i+1];
                    if (curr.next.length === 0) {
                        const internalEdge = { source: curr.id, target: nxt.id, value: '' };
                        curr.next.push(internalEdge);
                        nxt.prev.push(internalEdge);
                    }
                }

                const firstBlock = blocksInside[0];
                const lastBlocks = blocksInside.filter(b => b.next.length === 0);
                
                const edgeToFirst = { source: caseNode.id, target: firstBlock.id, value: '' };
                caseNode.next.push(edgeToFirst);
                firstBlock.prev.push(edgeToFirst);
                
                lastBlocks.forEach(lb => {
                    mergeEdges.forEach(me => {
                        const edgeFromLast = { source: lb.id, target: me.target, value: '' };
                        lb.next.push(edgeFromLast);
                        if (nodes[me.target]) nodes[me.target].prev.push(edgeFromLast);
                    });
                });
            } else {
                mergeEdges.forEach(me => {
                    const edgeFromCase = { source: caseNode.id, target: me.target, value: '' };
                    caseNode.next.push(edgeFromCase);
                    if (nodes[me.target]) nodes[me.target].prev.push(edgeFromCase);
                });
            }
        });
        
        mergeEdges.forEach(me => {
            if (nodes[me.target]) {
                nodes[me.target].prev = nodes[me.target].prev.filter(p => p.source !== switchNode.id);
            }
        });
    });

    const isIgnoredRootType = (t) => ['COMMENT', 'MERGE', 'END', 'GROUP_BG', 'LOOP_CONTAINER', 'FOR_CONTAINER', 'SWITCH_CONTAINER', 'CASE_CONTAINER'].includes(t);

    const loopContainers = Object.values(nodes).filter(n => n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER');
    const isInsideLoop = (node, loop) => {
        if (!node || !loop) return false;
        if (node.type === 'START' || node.type === 'START_END' || node.type === 'END') return false;
        const nW = node.width || 100;
        const nH = node.height || 50;
        const coreW = nW * 0.5;
        const coreH = nH * 0.5;
        const coreX = node.x + (nW - coreW) / 2;
        const coreY = node.y + (nH - coreH) / 2;
        const loopW = loop.width || 300;
        const loopH = loop.height || 150;
        const isInside = (coreX < loop.x + loopW && coreX + coreW > loop.x && coreY < loop.y + loopH && coreY + coreH > loop.y);
        return isInside;
    };

    loopContainers.forEach(loopNode => {
        const blocksInside = Object.values(nodes).filter(n => !isIgnoredRootType(n.type) && isInsideLoop(n, loopNode));
        if (blocksInside.length > 0) {
            blocksInside.sort((a, b) => a.y - b.y || a.x - b.x);
            
            for (let i = 0; i < blocksInside.length - 1; i++) {
                const curr = blocksInside[i];
                const nxt = blocksInside[i+1];
                
                // If curr has an exit edge leaving the loop, move it to the last block
                const exitEdges = curr.next.filter(e => !isInsideLoop(nodes[e.target], loopNode));
                if (exitEdges.length > 0 && curr.next.every(e => !isInsideLoop(nodes[e.target], loopNode))) {
                    curr.next = curr.next.filter(e => isInsideLoop(nodes[e.target], loopNode));
                    const lastBlock = blocksInside[blocksInside.length - 1];
                    exitEdges.forEach(ee => {
                        const newExit = { source: lastBlock.id, target: ee.target, value: ee.value };
                        lastBlock.next.push(newExit);
                        if (nodes[ee.target]) {
                            nodes[ee.target].prev = nodes[ee.target].prev.map(p => p.source === curr.id ? newExit : p);
                        }
                    });
                }

                if (curr.next.length === 0) {
                    const internalEdge = { source: curr.id, target: nxt.id, value: '' };
                    curr.next.push(internalEdge);
                    nxt.prev.push(internalEdge);
                }
            }
        }
    });

    const startNodes = Object.values(nodes).filter(n => n.type === 'START');
    startNodes.sort((a, b) => a.x - b.x || a.y - b.y);

    if (startNodes.length === 1 && (!startNodes[0].value || startNodes[0].value === 'Start/End')) {
        startNodes[0].value = 'main';
    }

    const usedFuncNames = new Set();
    let maxFragNum = 0;
    startNodes.forEach(sn => {
        const val = (sn.value || '').trim();
        const m = val.match(/^fragment_(\d+)$/i);
        if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxFragNum) maxFragNum = num;
        }
        if (val && !usedFuncNames.has(val)) {
            usedFuncNames.add(val);
        } else if (val && usedFuncNames.has(val)) {
            maxFragNum++;
            while (usedFuncNames.has(`fragment_${maxFragNum}`)) {
                maxFragNum++;
            }
            sn.value = `fragment_${maxFragNum}`;
            usedFuncNames.add(sn.value);
        }
    });

    startNodes.forEach(sn => {
        let val = (sn.value || '').trim();
        if (!val || val === 'Start/End') {
            if (startNodes.length === 1 && !usedFuncNames.has('main')) {
                sn.value = 'main';
            } else {
                maxFragNum++;
                while (usedFuncNames.has(`fragment_${maxFragNum}`)) {
                    maxFragNum++;
                }
                sn.value = `fragment_${maxFragNum}`;
            }
            usedFuncNames.add(sn.value);
        }
    });

    let clusterId = maxFragNum + 1;
    let assigned = new Set();
    
    const markCluster = (startId) => {
        let q = [startId];
        assigned.add(startId);
        while(q.length > 0) {
            let curr = q.shift();
            const node = nodes[curr];
            if (node) {
                const insideLoops = loopContainers.filter(l => isInsideLoop(node, l));
                insideLoops.forEach(l => {
                    Object.values(nodes).forEach(inNode => {
                        if (!assigned.has(inNode.id) && !isIgnoredRootType(inNode.type) && inNode.prev.length === 0 && isInsideLoop(inNode, l)) {
                            assigned.add(inNode.id);
                            q.push(inNode.id);
                        }
                    });
                });

                if (node.next) {
                    node.next.forEach(e => {
                        if(!assigned.has(e.target)) {
                            assigned.add(e.target);
                            q.push(e.target);
                        }
                    });
                }
            }
        }
    };

    startNodes.forEach(sn => markCluster(sn.id));

    const realStartsCount = startNodes.length;

    let roots = Object.values(nodes).filter(n => !assigned.has(n.id) && n.prev.length === 0 && !isIgnoredRootType(n.type));
    
    roots.forEach(r => {
        while (usedFuncNames.has(`fragment_${clusterId}`)) {
            clusterId++;
        }
        const fragName = `fragment_${clusterId}`;
        usedFuncNames.add(fragName);
        const ghostId = `ghost_start_${clusterId}`;
        nodes[ghostId] = { id: ghostId, value: fragName, type: 'START', x: r.x, y: r.y - 100, next: [], prev: [], entityType: 'FUNCTION', ioType: 'input' };
        edges.push({ source: ghostId, target: r.id, value: '' });
        nodes[ghostId].next.push({ target: r.id, value: '' });
        r.prev.push({ source: ghostId, value: '' });
        startNodes.push(nodes[ghostId]);
        clusterId++;
        
        markCluster(r.id);
    });

    Object.values(nodes).forEach(n => {
        if (!assigned.has(n.id) && n.type !== 'START' && !isIgnoredRootType(n.type)) {
            while (usedFuncNames.has(`fragment_${clusterId}`)) {
                clusterId++;
            }
            const fragName = `fragment_${clusterId}`;
            usedFuncNames.add(fragName);
            const ghostId = `ghost_start_${clusterId}`;
            nodes[ghostId] = { id: ghostId, value: fragName, type: 'START', x: n.x, y: n.y - 100, next: [], prev: [], entityType: 'FUNCTION', ioType: 'input' };
            edges.push({ source: ghostId, target: n.id, value: '' });
            nodes[ghostId].next.push({ target: n.id, value: '' });
            n.prev.push({ source: ghostId, value: '' });
            startNodes.push(nodes[ghostId]);
            clusterId++;
            
            markCluster(n.id);
        }
    });

    if (realStartsCount === 0 && startNodes.length > 0) {
        errors.push("Diagram neobsahuje počáteční blok. Byly vytvořeny automatické fragmenty.");
    } else if (startNodes.length === 0) {
        errors.push("Diagram je prázdný nebo neobsahuje počáteční blok.");
        return { code: "", errors, nodeLineMap: {} };
    }

    let codeLines = [];
    let nodeLineMap = {};
    let visited = new Set();
    let declaredFuncs = new Set();
    let pendingComments = Object.values(nodes).filter(n => n.type === 'COMMENT').sort((a, b) => a.y - b.y);

    const appendLine = (text, nodeId = null) => {
        const idx = codeLines.length;
        codeLines.push(text);
        if (nodeId) {
            if (!nodeLineMap[nodeId]) nodeLineMap[nodeId] = [];
            nodeLineMap[nodeId].push(idx);
        }
    };

    const printCommentsBeforeY = (currentY, indent) => {
        while (pendingComments.length > 0 && pendingComments[0].y <= currentY + 30) {
            let c = pendingComments.shift();
            c.value.split('\n').forEach(line => {
                let cl = line.replace(/^[/#\s]+/, '').trim();
                if (cl) appendLine(`${indent}# ${cl}`, c.id);
            });
        }
    };

    const formatCondition = (cond) => {
        return cond.replace(/\bOR\b/gi, 'or')
                   .replace(/\bAND\b/gi, 'and')
                   .replace(/\bNOT\b/gi, 'not')
                   .replace(/\bTRUE\b/gi, 'True')
                   .replace(/\bFALSE\b/gi, 'False');
    };

    const generateStatement = (node, indent = "") => {
        printCommentsBeforeY(node.y, indent);
        if (node.type === 'MERGE' || !node.value) return;

        if (node.type === 'ACTION') {
            node.value.split('\n').forEach(line => {
                let val = line.trim();
                if (!val) return;
                
                if (val.includes('=')) {
                    appendLine(`${indent}${val}`, node.id);
                } else if (val.startsWith('"') && val.endsWith('"')) {
                    appendLine(`${indent}print(${val})`, node.id);
                } else if (val.toUpperCase().startsWith('RETURN')) {
                    appendLine(`${indent}${val.replace(/^RETURN/i, 'return')}`, node.id);
                } else {
                    let isFuncFormat = val.includes('(') || val.includes(')');
                    appendLine(`${indent}${isFuncFormat ? val : val + '()'}`, node.id);
                }
            });
        } else if (node.type === 'IO') {
            let lines = node.value.split(/[\n;]+/);
            lines.forEach(line => {
                let val = line.trim();
                if(!val) return;
                
                if (node.ioType === 'output' || val.toUpperCase().startsWith('PRINT') || val.includes('"')) {
                    let inner = val.toUpperCase().startsWith('PRINT') ? val.substring(5).trim() : val;
                    if (inner.startsWith('(') && inner.endsWith(')')) {
                        inner = inner.substring(1, inner.length - 1).trim();
                    }
                    appendLine(`${indent}print(${inner})`, node.id);
                } else {
                    let p = val.replace(/^VSTUP\s+/i, '').trim();
                    if (!p) p = "x";
                    
                    p.split(',').forEach(part => {
                        let cleanV = part.replace(/\[.*\]/, '').trim();
                        if (cleanV) appendLine(`${indent}${cleanV} = input()`, node.id);
                    });
                }
            });
        }
    };

    const doesPathLoopBack = (startId, targetId, localVisited = new Set()) => {
        if (startId === targetId) return true;
        if (localVisited.has(startId)) return false;
        localVisited.add(startId);
        let node = nodes[startId];
        if (!node || node.type === 'END') return false;
        for (let edge of node.next) if (doesPathLoopBack(edge.target, targetId, new Set(localVisited))) return true;
        return false;
    };

    const findConvergence = (tId, fId) => {
        if (!tId || !fId) return null;
        
        const pathT = [];
        let curr = tId;
        let safe = 100;
        while(curr && nodes[curr] && safe-- > 0) {
            pathT.push(curr);
            curr = nodes[curr].next.length > 0 ? nodes[curr].next[0].target : null;
        }
        
        curr = fId;
        safe = 100;
        while(curr && nodes[curr] && safe-- > 0) {
            if (pathT.includes(curr)) return curr;
            curr = nodes[curr].next.length > 0 ? nodes[curr].next[0].target : null;
        }
        return null;
    };

    startNodes.forEach((start, index) => {
        let endNodeId = null;

        const traverse = (nodeId, indent = "", inPath = new Set(), stopId = null) => {
            if (!nodeId || !nodes[nodeId] || visited.has(nodeId)) return;
            if (nodeId === stopId) return;

            const node = nodes[nodeId];
            visited.add(nodeId);
            inPath.add(nodeId);

            if (node.type === 'START') {
                const fName = node.value || 'main';
                if (declaredFuncs.has(fName) && !fName.startsWith('fragment_')) errors.push(`Duplicitní název funkce/třídy '${fName}'`);
                declaredFuncs.add(fName);

                const defLine = node.entityType === 'CLASS' ? `class ${fName}:` : `def ${fName}():`;
                appendLine(`${indent}${defLine}`, node.id);
                
                const beforeLen = codeLines.length;
                if (node.next.length > 0) traverse(node.next[0].target, indent + "    ", new Set(inPath), stopId);
                if (codeLines.length === beforeLen) appendLine(`${indent}    pass`);
                
                printCommentsBeforeY(Infinity, indent + "    ");
            }
            else if (node.type === 'ACTION' || node.type === 'IO' || node.type === 'MERGE' || node.type === 'CASE_CONTAINER') {
                if (node.type === 'CASE_CONTAINER') {
                    if (node.isDefault) appendLine(`${indent}case _:`, node.id);
                    else appendLine(`${indent}case ${node.caseVal || '1'}:`, node.id);
                    indent += "    ";
                } else {
                    generateStatement(node, indent);
                }
                
                if (node.next.length > 0 && !inPath.has(node.next[0].target)) {
                    traverse(node.next[0].target, indent, new Set(inPath), stopId);
                }
            }
            else if (node.type === 'SWITCH_CONTAINER') {
                printCommentsBeforeY(node.y, indent);
                appendLine(`${indent}match ${node.switchVar || 'x'}:`, node.id);
                
                let mergeNode = null;
                if (node.next.length > 1) {
                    mergeNode = node.next.map(e => e.target).reduce((acc, target) => findConvergence(acc, target));
                } else if (node.next.length === 1) {
                    mergeNode = node.next[0].target;
                }

                node.next.forEach(e => {
                    if (!inPath.has(e.target)) {
                        traverse(e.target, indent + "    ", new Set(inPath), mergeNode);
                    }
                });
                
                if (mergeNode && !inPath.has(mergeNode)) {
                    traverse(mergeNode, indent, new Set(inPath), stopId);
                }
            }
            else if (node.type === 'CONDITION') {
                printCommentsBeforeY(node.y, indent);

                let trueEdge = node.next.find(e => ['ano', 'yes', 'true', '1', 'y', '+'].includes((e.value || '').toLowerCase().trim()));
                let falseEdge = node.next.find(e => ['ne', 'no', 'false', '0', 'n', '-'].includes((e.value || '').toLowerCase().trim()));

                if (node.next.length === 2) {
                    if (!trueEdge && !falseEdge) {
                        const bottomEdge = node.next.find(e => e.sourceHandle === 's-bottom');
                        const rightEdge = node.next.find(e => e.sourceHandle === 's-right');
                        if (node.isSwapped) {
                            trueEdge = rightEdge || node.next[0];
                            falseEdge = bottomEdge || node.next[1];
                        } else {
                            trueEdge = bottomEdge || node.next[0];
                            falseEdge = rightEdge || node.next[1];
                        }
                        if (trueEdge === falseEdge) {
                            falseEdge = node.next.find(e => e !== trueEdge);
                        }
                        const err = `Podmínka '${node.value}' nemá označené větve (Ano/Ne). Výsledek může být nepřesný.`;
                        if (!errors.includes(err)) errors.push(err);
                    } else if (trueEdge && !falseEdge) {
                        falseEdge = node.next.find(e => e !== trueEdge);
                    } else if (!trueEdge && falseEdge) {
                        trueEdge = node.next.find(e => e !== falseEdge);
                    } else if (trueEdge === falseEdge) {
                        falseEdge = node.next.find(e => e !== trueEdge);
                    }
                } else if (node.next.length === 1) {
                    if (!trueEdge && !falseEdge) {
                        const h = node.next[0].sourceHandle;
                        const isRight = h === 's-right';
                        const isBottom = h === 's-bottom';
                        if (isRight) {
                            if (node.isSwapped) trueEdge = node.next[0];
                            else falseEdge = node.next[0];
                        } else if (isBottom) {
                            if (node.isSwapped) falseEdge = node.next[0];
                            else trueEdge = node.next[0];
                        } else {
                            trueEdge = node.next[0];
                        }
                    }
                }
                
                const tTarget = trueEdge?.target;
                const fTarget = falseEdge?.target;

                const tLoops = tTarget ? doesPathLoopBack(tTarget, node.id) : false;
                const fLoops = fTarget ? doesPathLoopBack(fTarget, node.id) : false;

                let cleanCond = node.value.replace(/^(?:WHILE|IF)\s+/i, '').trim();
                cleanCond = formatCondition(cleanCond);

                if (tLoops || fLoops) {
                    const isTrueLoop = tLoops;
                    let isFor = node.value.toUpperCase().startsWith('FOR ');
                    const condText = isTrueLoop ? cleanCond : `not (${cleanCond})`;
                    
                    const headerLineIndex = codeLines.length;
                    
                    let loopCmd = `while ${condText}:`;
                    if (isFor) {
                        const forMatch = cleanCond.match(/^FOR\s+([a-zA-Z_]\w*)\s*(?:=|<-)\s*(.*?)\s+TO\s+(.*)$/i);
                        if (forMatch) {
                            const loopVar = forMatch[1];
                            const initVal = forMatch[2];
                            let toVal = forMatch[3];
                            // To match pseudocode `TO X` behavior (inclusive), we do X + 1 in Python
                            if (!isNaN(toVal)) {
                                toVal = `${parseInt(toVal) + 1}`;
                            } else {
                                toVal = `${toVal} + 1`;
                            }
                            loopCmd = `for ${loopVar} in range(${initVal}, ${toVal}):`;
                        } else {
                            // Fallback if it doesn't match the regex perfectly
                            loopCmd = `# FOR loop parsing error: ${cleanCond}`;
                        }
                    }
                    
                    appendLine(`${indent}${loopCmd}`, node.id);
                    
                    const loopStartTarget = isTrueLoop ? tTarget : fTarget;
                    if (loopStartTarget) {
                        const temporarilyUnvisited = new Set();
                        const unvisitLoopBody = (currId) => {
                            if (!currId || currId === node.id) return;
                            if (visited.has(currId)) {
                                visited.delete(currId);
                                temporarilyUnvisited.add(currId);
                                nodes[currId]?.next.forEach(e => unvisitLoopBody(e.target));
                            }
                        };
                        unvisitLoopBody(loopStartTarget);
                        
                        const loopInPath = new Set();
                        loopInPath.add(node.id);
                        traverse(loopStartTarget, indent + "    ", loopInPath, node.id);
                        
                        temporarilyUnvisited.forEach(id => visited.add(id));
                    }

                    // Semantic FOR loop detection
                    if (!isFor && isTrueLoop) {
                        const condMatch = cleanCond.match(/^([a-zA-Z_]\w*)\s*(<=|>=|==|!=|<|>)\s*(.*)$/);
                        if (condMatch) {
                            const loopVar = condMatch[1];
                            const op = condMatch[2];
                            const loopLimit = condMatch[3];
                            
                            let initLineIdx = -1;
                            let initVal = null;
                            for (let i = headerLineIndex - 1; i >= 0; i--) {
                                const match = codeLines[i].match(new RegExp(`^\\s*${loopVar}\\s*(?:=|<-)\\s*(.*)$`, 'i'));
                                if (match) {
                                    initVal = match[1];
                                    initLineIdx = i;
                                    break;
                                }
                            }
                            
                            if (initLineIdx !== -1 && codeLines.length > headerLineIndex + 1) {
                                let lastLoopBodyIdx = codeLines.length - 1;
                                const lastLine = codeLines[lastLoopBodyIdx];
                                const incMatch = lastLine.match(new RegExp(`^\\s*${loopVar}\\s*(?:=|<-)\\s*${loopVar}\\s*[+\\-]\\s*.*$`, 'i')) || 
                                                 lastLine.match(new RegExp(`^\\s*${loopVar}\\s*[+\\-]=(.*)$`, 'i'));
                                if (incMatch) {
                                    codeLines.splice(lastLoopBodyIdx, 1); // Remove increment
                                    let rangeLimit = loopLimit;
                                    if (op === '<=') {
                                        if (!isNaN(loopLimit)) {
                                            rangeLimit = (parseInt(loopLimit, 10) + 1).toString();
                                        } else {
                                            rangeLimit = `${loopLimit} + 1`;
                                        }
                                    }
                                    codeLines[headerLineIndex] = `${indent}for ${loopVar} in range(${initVal}, ${rangeLimit}):`;
                                    codeLines.splice(initLineIdx, 1); // Remove init
                                    isFor = true;
                                }
                            }
                        }
                    }

                    // headerLineIndex is now either the while or for header. If the loop body is empty, we need pass.
                    // Wait, since we might have removed init, headerLineIndex could be off by 1 if init was removed.
                    // Let's just check the last element.
                    if (isFor && codeLines.length > 0 && codeLines[codeLines.length - 1].trim().startsWith('for ')) {
                        appendLine(`${indent}    pass`);
                    } else if (!isFor && codeLines.length > 0 && codeLines[codeLines.length - 1].trim().startsWith('while ')) {
                        appendLine(`${indent}    pass`);
                    }

                    const exitNode = isTrueLoop ? fTarget : tTarget;
                    if (exitNode && exitNode !== stopId && !inPath.has(exitNode)) traverse(exitNode, indent, new Set(inPath), stopId);
                } else {
                    let mergeNodeId = findConvergence(tTarget, fTarget);
                    
                    appendLine(`${indent}if ${cleanCond}:`, node.id);
                    const beforeTrue = codeLines.length;
                    if (tTarget && tTarget !== mergeNodeId) traverse(tTarget, indent + "    ", new Set(inPath), mergeNodeId || stopId);
                    if (codeLines.length === beforeTrue) appendLine(`${indent}    pass`);
                    
                    if (fTarget && fTarget !== mergeNodeId && nodes[fTarget] && nodes[fTarget].type !== 'END') {
                        appendLine(`${indent}else:`);
                        const beforeFalse = codeLines.length;
                        traverse(fTarget, indent + "    ", new Set(inPath), mergeNodeId || stopId);
                        if (codeLines.length === beforeFalse) appendLine(`${indent}    pass`);
                    }
                    
                    if (mergeNodeId && mergeNodeId !== stopId) {
                        traverse(mergeNodeId, indent, new Set(inPath), stopId);
                    }
                }
            }
            else if (node.type === 'END') {
                endNodeId = node.id;
            }
            inPath.delete(nodeId);
        };

        const startLineIdx = codeLines.length;
        traverse(start.id);
        
        if (endNodeId) {
            printCommentsBeforeY(nodes[endNodeId].y, "");
        }
        
        printCommentsBeforeY(Infinity, "");

        if (/^fragment_\d+$/i.test(start.value || '')) {
            const funcLines = codeLines.slice(startLineIdx);
            const bodyLines = funcLines.slice(1).filter(l => l && !l.trim().startsWith('#') && l.trim() !== 'pass');
            if (bodyLines.length === 0) {
                codeLines.splice(startLineIdx, funcLines.length);
                codeNodeIds.splice(startLineIdx, funcLines.length);
                return;
            }
        }

        if (index < startNodes.length - 1) {
            appendLine('');
        }
    });

    let fragIndex = 1;
    const fragMap = new Map();
    codeLines.forEach((line, i) => {
        const m = line.match(/^(\s*def\s+)fragment_(\d+)(\(\s*\):)/i);
        if (m) {
            const oldNum = m[2];
            if (!fragMap.has(oldNum)) {
                fragMap.set(oldNum, fragIndex++);
            }
            codeLines[i] = `${m[1]}fragment_${fragMap.get(oldNum)}${m[3]}`;
        }
    });

    let code = codeLines.join('\n').trim();
    if (code.length === 0) code = "pass";
    
    if (startNodes.length === 1 && code.includes("def main():")) {
        code += "\n\nif __name__ == '__main__':\n    main()";
    }

    return { code, errors, nodeLineMap };
  } catch (err) {
    return { code: "pass", errors: ["Kritická chyba parseru: " + err.message], nodeLineMap: {} };
  }
};
