export const parseDrawioToPseudocode = (xml) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const cells = Array.from(doc.querySelectorAll('mxCell'));

    let nodes = {};
    let edges = [];
    let errors = [];

    const KEYWORDS = new Set(['AND','OR','NOT','TRUE','FALSE','INPUT','PRINT','VSTUP','MOD','DIV']);

    const extractVariables = (expr) => {
        const noStrings = expr.replace(/"[^"]*"/g, '');
        const vars = noStrings.match(/[a-zA-Z_]\w*/g) || [];
        return vars.filter(v => !KEYWORDS.has(v.toUpperCase()));
    };

    const checkVariables = (expr, scope) => {
        // Ztišeno: Pro výukové a testovací účely (často fragmentované diagramy) 
        // nevyhazujeme chyby o Scope. Reálné chyby zachytí až samotný Python/Runner běh.
    };

    const declareVariables = (expr, scope) => {
        const vars = extractVariables(expr);
        vars.forEach(v => scope.add(v));
    };

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
        else if (style.includes('swimlane') || style.includes('LOOP_CONTAINER') || cellTypeAttr === 'LOOP_CONTAINER') {
            type = 'LOOP_CONTAINER';
            try {
                doWhile = cell.getAttribute('doWhile') === 'true';
                if (!doWhile && style.includes('doWhile=true')) {
                    doWhile = true;
                }
            } catch(e) {}
        }
        
        const entityMatch = style.match(/entityType=([^;]+)/);
        const entityType = entityMatch ? entityMatch[1] : 'FUNCTION';
        
        const ioMatch = style.match(/ioType=([^;]+)/);
        const ioType = ioMatch ? ioMatch[1] : 'input';

        const width = geo ? parseFloat(geo.getAttribute('width') || 0) : 0;
        const height = geo ? parseFloat(geo.getAttribute('height') || 0) : 0;

        nodes[id] = { id, value, type, x, y, width, height, next: [], prev: [], entityType, ioType, doWhile };
      } 
      else if (edge === '1') {
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        const value = cleanTextWithLines(cell.getAttribute('value')).toLowerCase().replace('\n', ' ');
        if (source && target) edges.push({ source, target, value });
      }
    });

    edges.forEach(e => {
      if (nodes[e.source] && nodes[e.target]) {
        nodes[e.source].next.push(e);
        nodes[e.target].prev.push(e);
      }
    });

    const startNodes = Object.values(nodes).filter(n => n.type === 'START');
    startNodes.sort((a, b) => a.x - b.x || a.y - b.y);

    let clusterId = 1;
    let assigned = new Set();
    
    startNodes.forEach(sn => {
        let q = [sn.id];
        assigned.add(sn.id);
        while(q.length > 0) {
            let curr = q.shift();
            const node = nodes[curr];
            if (node && node.next) {
                node.next.forEach(e => {
                    if(!assigned.has(e.target)) {
                        assigned.add(e.target);
                        q.push(e.target);
                    }
                });
            }
        }
    });

    const realStartsCount = startNodes.length;

    let roots = Object.values(nodes).filter(n => !assigned.has(n.id) && n.prev.length === 0 && n.type !== 'COMMENT' && n.type !== 'MERGE' && n.type !== 'END' && n.type !== 'GROUP_BG' && n.type !== 'LOOP_CONTAINER');
    
    roots.forEach(r => {
        const ghostId = `ghost_start_${clusterId}`;
        nodes[ghostId] = { id: ghostId, value: `fragment_${clusterId}`, type: 'START', x: r.x, y: r.y - 100, next: [], prev: [], entityType: 'FUNCTION', ioType: 'input' };
        edges.push({ source: ghostId, target: r.id, value: '' });
        nodes[ghostId].next.push({ target: r.id, value: '' });
        r.prev.push({ source: ghostId, value: '' });
        startNodes.push(nodes[ghostId]);
        clusterId++;
        
        let q = [r.id];
        assigned.add(r.id);
        while(q.length > 0) {
            let curr = q.shift();
            const node = nodes[curr];
            if(node && node.next) {
                node.next.forEach(e => {
                    if(!assigned.has(e.target)) {
                        assigned.add(e.target);
                        q.push(e.target);
                    }
                });
            }
        }
    });

    Object.values(nodes).forEach(n => {
        if (!assigned.has(n.id) && n.type !== 'COMMENT' && n.type !== 'START' && n.type !== 'END' && n.type !== 'MERGE' && n.type !== 'GROUP_BG' && n.type !== 'LOOP_CONTAINER') {
            const ghostId = `ghost_start_${clusterId}`;
            nodes[ghostId] = { id: ghostId, value: `fragment_${clusterId}`, type: 'START', x: n.x, y: n.y - 100, next: [], prev: [], entityType: 'FUNCTION', ioType: 'input' };
            edges.push({ source: ghostId, target: n.id, value: '' });
            nodes[ghostId].next.push({ target: n.id, value: '' });
            n.prev.push({ source: ghostId, value: '' });
            startNodes.push(nodes[ghostId]);
            clusterId++;
            
            let q = [n.id];
            assigned.add(n.id);
            while(q.length > 0) {
                let curr = q.shift();
                const node = nodes[curr];
                if(node && node.next) {
                    node.next.forEach(e => {
                        if(!assigned.has(e.target)) {
                            assigned.add(e.target);
                            q.push(e.target);
                        }
                    });
                }
            }
        }
    });

    if (realStartsCount === 0 && startNodes.length > 0) {
        errors.push("Diagram neobsahuje počáteční blok. Byly vytvořeny automatické fragmenty.");
    } else if (startNodes.length === 0) {
        errors.push("Diagram je prázdný nebo neobsahuje počáteční blok.");
        return { code: "", errors, nodeLineMap: {} };
    }

    let codeLines = [];
    let codeNodeIds = [];
    let nodeLineMap = {};
    let visited = new Set();
    let declaredFuncs = new Set();
    let pendingComments = Object.values(nodes).filter(n => n.type === 'COMMENT').sort((a, b) => a.y - b.y);

    const appendLine = (text, nodeId = null) => {
        codeLines.push(text);
        codeNodeIds.push(nodeId);
    };

    const printCommentsBeforeY = (currentY, indent) => {
        while (pendingComments.length > 0 && pendingComments[0].y <= currentY + 30) {
            let c = pendingComments.shift();
            c.value.split('\n').forEach(line => {
                let cl = line.replace(/^[\/#\s]+/, '').trim();
                if (cl) appendLine(`${indent}# ${cl}`, c.id);
            });
        }
    };

    const generateStatement = (node, indent = "", currentScope, overrideNodeId = null) => {
        printCommentsBeforeY(node.y, indent);
        if (node.type === 'MERGE' || !node.value) return;

        const targetId = overrideNodeId || node.id;

        if (node.type === 'ACTION') {
            node.value.split('\n').forEach(line => {
                let val = line.trim();
                if (!val) return;
                
                if (val.includes('=')) {
                    const parts = val.split('=');
                    const left = parts[0];
                    const right = parts.slice(1).join('=');
                    checkVariables(right, currentScope);
                    declareVariables(left, currentScope);
                    appendLine(`${indent}${val}`, targetId);
                } else if (val.startsWith('"') && val.endsWith('"')) {
                    appendLine(`${indent}PRINT(${val})`, targetId);
                } else if (val.toUpperCase().startsWith('RETURN')) {
                    checkVariables(val.substring(6), currentScope);
                    appendLine(`${indent}${val}`, targetId);
                } else {
                    let isFuncFormat = val.includes('(') || val.includes(')');
                    checkVariables(val, currentScope);
                    appendLine(`${indent}${isFuncFormat ? val : val + '()'}`, targetId);
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
                    checkVariables(inner, currentScope);
                    appendLine(`${indent}PRINT(${inner})`, targetId);
                } else {
                    // Očištění VSTUP prefixu
                    let p = val.replace(/^VSTUP\s+/i, '').trim();
                    if (!p) p = "x";
                    
                    p.split(',').forEach(part => {
                        let cleanV = part.replace(/\[.*\]/, '').trim();
                        if (cleanV) declareVariables(cleanV, currentScope);
                    });
                    
                    if (p.includes(',')) {
                        appendLine(`${indent}Vstup ${p}`, targetId);
                    } else {
                        appendLine(`${indent}Vstup ${p}`, targetId);
                    }
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
        if (!tId && !fId) return null;
        if (!tId) return fId;
        if (!fId) return tId;
        
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

    const loopContainers = Object.values(nodes).filter(n => n.type === 'LOOP_CONTAINER');
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

    startNodes.forEach((start, index) => {
        let endNodeId = null;
        let endNodeVal = `END${start.entityType || 'FUNCTION'}`;

        const traverse = (nodeId, indent = "", inPath = new Set(), stopId = null, currentScope = new Set(), currentLoopStack = []) => {
            if (!nodeId || !nodes[nodeId] || visited.has(nodeId)) {
                return;
            }
            if (nodeId === stopId) return;

            const node = nodes[nodeId];
            
            // Handle entering LOOP_CONTAINERs
            const insideLoops = loopContainers.filter(l => isInsideLoop(node, l));
            insideLoops.sort((a, b) => (a.width * a.height) - (b.width * b.height)); // sort by size, smallest (most nested) first
            
            // The loop entrance will be handled AFTER exiting loops.

            // Find loops we exited
            // Wait, if we process exits BEFORE the node, we might close a loop that we just entered? No, newLoops are pushed, so they are in currentLoopStack.
            // But if a node is NOT in a loop that is currently in the stack, it means we exited it.
            // Actually, we must process exits BEFORE entering new loops, because we are transitioning from the previous node to this node!
            // Let's adjust:
            // Find loops we exited
            let loopsToExit = [];
            for (let i = currentLoopStack.length - 1; i >= 0; i--) {
                const l = currentLoopStack[i];
                if (!isInsideLoop(node, l)) {
                    loopsToExit.push(l);
                } else {
                    break; // stop at the first loop we are still inside
                }
            }
            
            loopsToExit.forEach(l => {
                currentLoopStack.pop();
                indent = indent.substring(0, indent.length - 4);
                if (l.doWhile) {
                    let bodyLines = codeLines.slice(l.startLineIndex);
                    let bodyNodeIds = codeNodeIds.slice(l.startLineIndex);
                    
                    let preLoopLines = bodyLines.map(line => line.replace(/^    /, ''));
                    let preLoopNodeIds = bodyNodeIds.map(() => l.id);
                    
                    let cond = l.value || "";
                    let whileLine = `${indent}WHILE ${cond} DO`;
                    let endWhileLine = `${indent}ENDWHILE`;
                    
                    let beforeLoop = codeLines.slice(0, l.startLineIndex);
                    let beforeLoopIds = codeNodeIds.slice(0, l.startLineIndex);
                    
                    codeLines = [...beforeLoop, ...preLoopLines, whileLine, ...bodyLines, endWhileLine];
                    codeNodeIds = [...beforeLoopIds, ...preLoopNodeIds, l.id, ...bodyNodeIds, l.id];
                } else {
                    appendLine(`${indent}ENDWHILE`, l.id);
                }
            });

            // Now enter new loops
            const loopsToEnter = insideLoops.filter(l => !currentLoopStack.includes(l));
            // Wait, we need to sort them from largest to smallest for entering!
            loopsToEnter.sort((a, b) => (b.width * b.height) - (a.width * a.height));
            loopsToEnter.forEach(l => {
                if (l.doWhile) {
                    l.startLineIndex = codeLines.length;
                } else {
                    let cond = l.value || "";
                    appendLine(`${indent}WHILE ${cond} DO`, l.id);
                }
                indent += "    ";
                currentLoopStack.push(l);
            });

            visited.add(nodeId);
            inPath.add(nodeId);

            if (node.type === 'START') {
                const fName = node.value || 'main';
                if (declaredFuncs.has(fName) && !fName.startsWith('fragment_')) errors.push(`Duplicitní název funkce/třída '${fName}'`);
                declaredFuncs.add(fName);

                appendLine(`${indent}${node.entityType} ${fName}()`, node.id);
                if (node.next.length > 0) traverse(node.next[0].target, indent + "    ", new Set(inPath), stopId, currentScope, [...currentLoopStack]);
                else if (!stopId) {
                    currentLoopStack.slice().reverse().forEach(l => {
                        indent = indent.substring(0, indent.length - 4);
                        if (l.doWhile) appendLine(`${indent}WHILE ${l.value || "True"}`, l.id);
                        else appendLine(`${indent}ENDWHILE`, l.id);
                    });
                }
                printCommentsBeforeY(Infinity, indent + "    ");
            }
            else if (node.type === 'ACTION' || node.type === 'IO' || node.type === 'MERGE') {
                generateStatement(node, indent, currentScope);
                if (node.next.length > 0 && !inPath.has(node.next[0].target)) {
                    traverse(node.next[0].target, indent, new Set(inPath), stopId, currentScope, [...currentLoopStack]);
                } else if (!stopId) {
                    currentLoopStack.slice().reverse().forEach(l => {
                        indent = indent.substring(0, indent.length - 4);
                        if (l.doWhile) appendLine(`${indent}WHILE ${l.value || "True"}`, l.id);
                        else appendLine(`${indent}ENDWHILE`, l.id);
                    });
                }
            }
            else if (node.type === 'CONDITION') {
                printCommentsBeforeY(node.y, indent);
                
                checkVariables(node.value, currentScope);

                let trueEdge = node.next.find(e => ['ano', 'yes', 'true', '1', 'y', '+'].includes(e.value?.toLowerCase().trim()));
                let falseEdge = node.next.find(e => ['ne', 'no', 'false', '0', 'n', '-'].includes(e.value?.toLowerCase().trim()));

                if (node.next.length === 2) {
                    if (!trueEdge && !falseEdge) {
                        trueEdge = node.next[0];
                        falseEdge = node.next[1];
                        const err = `Podmínka '${node.value}' nemá označené větve (Ano/Ne). Výsledek může být nepřesný.`;
                        if (!errors.includes(err)) errors.push(err);
                    } else if (trueEdge && !falseEdge) {
                        falseEdge = node.next.find(e => e !== trueEdge);
                    } else if (!trueEdge && falseEdge) {
                        trueEdge = node.next.find(e => e !== falseEdge);
                    } else if (trueEdge === falseEdge) {
                        falseEdge = node.next.find(e => e !== trueEdge);
                    }
                } else {
                    trueEdge = trueEdge || node.next[0];
                    falseEdge = falseEdge || node.next[1];
                }
                
                const tTarget = trueEdge?.target;
                const fTarget = falseEdge?.target;

                const tLoops = tTarget ? doesPathLoopBack(tTarget, node.id) : false;
                const fLoops = fTarget ? doesPathLoopBack(fTarget, node.id) : false;

                let cleanCond = node.value.replace(/^(?:WHILE|IF)\s+/i, '').trim();

                if (tLoops || fLoops) {
                    const isTrueLoop = tLoops;
                    let isFor = node.value.toUpperCase().startsWith('FOR ');
                    const condText = isTrueLoop ? cleanCond : `NOT (${cleanCond})`;
                    
                    const headerLineIndex = codeLines.length;
                    appendLine(`${indent}${isFor ? '' : 'WHILE '}${condText} DO`, node.id);
                    
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
                        traverse(loopStartTarget, indent + "    ", loopInPath, node.id, currentScope, [...currentLoopStack]);
                        
                        temporarilyUnvisited.forEach(id => visited.add(id));
                    }

                    // Semantic FOR loop detection
                    if (!isFor && isTrueLoop) {
                        const condMatch = cleanCond.match(/^([a-zA-Z_]\w*)\s*(?:<=|>=|==|!=|<|>)\s*(.*)$/);
                        if (condMatch) {
                            const loopVar = condMatch[1];
                            const loopLimit = condMatch[2];
                            
                            let initLineIdx = -1;
                            let initVal = null;
                            for (let i = headerLineIndex - 1; i >= 0; i--) {
                                const match = codeLines[i].match(new RegExp(`^\\s*(?:SET\\s+)?${loopVar}\\s*(?:=|<-)\\s*(.*)$`, 'i'));
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
                                    codeNodeIds.splice(lastLoopBodyIdx, 1);
                                    codeLines[headerLineIndex] = `${indent}FOR ${loopVar} = ${initVal} TO ${loopLimit} DO`;
                                    codeLines.splice(initLineIdx, 1); // Remove init
                                    codeNodeIds.splice(initLineIdx, 1);
                                    isFor = true;
                                }
                            }
                        }
                    }

                    appendLine(`${indent}${isFor ? 'ENDFOR' : 'ENDWHILE'}`);

                    const exitNode = isTrueLoop ? fTarget : tTarget;
                    if (exitNode && exitNode !== stopId && !inPath.has(exitNode)) traverse(exitNode, indent, new Set(inPath), stopId, currentScope, [...currentLoopStack]);
                } else {
                    let mergeNodeId = findConvergence(tTarget, fTarget);
                    
                    appendLine(`${indent}IF ${cleanCond} THEN`, node.id);
                    if (tTarget && tTarget !== mergeNodeId) traverse(tTarget, indent + "    ", new Set(inPath), mergeNodeId || stopId, currentScope, [...currentLoopStack]);
                    
                    if (fTarget && fTarget !== mergeNodeId && nodes[fTarget] && nodes[fTarget].type !== 'END') {
                        appendLine(`${indent}ELSE`);
                        traverse(fTarget, indent + "    ", new Set(inPath), mergeNodeId || stopId, currentScope, [...currentLoopStack]);
                    }
                    appendLine(`${indent}ENDIF`);
                    
                    if (mergeNodeId && mergeNodeId !== stopId) {
                        traverse(mergeNodeId, indent, new Set(inPath), stopId, currentScope, [...currentLoopStack]);
                    }
                }
            }
            else if (node.type === 'END') {
                endNodeId = node.id;
                let val = node.value.trim();
                if (val && val.toUpperCase() !== 'KONEC' && val.toUpperCase() !== 'END') {
                    endNodeVal = val;
                }
            }
            inPath.delete(nodeId);
        };

        traverse(start.id);

        if (endNodeId) {
            printCommentsBeforeY(nodes[endNodeId].y, "");
            appendLine(endNodeVal, endNodeId);
        } else {
            appendLine("ENDFUNCTION");
        }
        
        printCommentsBeforeY(Infinity, "");

        if (index < startNodes.length - 1) {
            appendLine('');
        }
    });

    nodeLineMap = {};
    codeNodeIds.forEach((id, idx) => {
        if (id) {
            if (!nodeLineMap[id]) nodeLineMap[id] = [];
            nodeLineMap[id].push(idx);
        }
    });

    let code = codeLines.join('\n').trim();
    return { code, errors, nodeLineMap };
  } catch (err) {
    return { code: "", errors: ["Kritická chyba parseru: " + err.message], nodeLineMap: {} };
  }
};