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
        
        const entityMatch = style.match(/entityType=([^;]+)/);
        const entityType = entityMatch ? entityMatch[1] : 'FUNCTION';
        
        const ioMatch = style.match(/ioType=([^;]+)/);
        const ioType = ioMatch ? ioMatch[1] : 'input';

        nodes[id] = { id, value, type, x, y, next: [], prev: [], entityType, ioType };
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

    let roots = Object.values(nodes).filter(n => !assigned.has(n.id) && n.prev.length === 0 && n.type !== 'COMMENT' && n.type !== 'MERGE' && n.type !== 'END' && n.type !== 'GROUP_BG');
    
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
        if (!assigned.has(n.id) && n.type !== 'COMMENT' && n.type !== 'START' && n.type !== 'END' && n.type !== 'MERGE' && n.type !== 'GROUP_BG') {
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
    let nodeLineMap = {};
    let visited = new Set();
    let declaredFuncs = new Set();
    let pendingComments = Object.values(nodes).filter(n => n.type === 'COMMENT').sort((a, b) => a.y - b.y);

    const appendLine = (text, nodeId = null) => {
        const idx = codeLines.length;
        codeLines.push(text);
        if (nodeId) nodeLineMap[nodeId] = idx;
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
            else if (node.type === 'ACTION' || node.type === 'IO' || node.type === 'MERGE') {
                generateStatement(node, indent);
                if (node.next.length > 0 && !inPath.has(node.next[0].target)) {
                    traverse(node.next[0].target, indent, new Set(inPath), stopId);
                }
            }
            else if (node.type === 'CONDITION') {
                printCommentsBeforeY(node.y, indent);

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
                cleanCond = formatCondition(cleanCond);

                if (tLoops || fLoops) {
                    const isTrueLoop = tLoops;
                    let isFor = node.value.toUpperCase().startsWith('FOR ');
                    const condText = isTrueLoop ? cleanCond : `not (${cleanCond})`;
                    
                    const headerLineIndex = codeLines.length;
                    const loopCmd = isFor ? cleanCond : `while ${condText}:`;
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
                    let loopHeaderIndex = isFor && codeLines[codeLines.length - 1] === codeLines[headerLineIndex - (isFor ? 1 : 0)] ? codeLines.length - 1 : headerLineIndex;
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

        traverse(start.id);
        
        if (endNodeId) {
            printCommentsBeforeY(nodes[endNodeId].y, "");
        }
        
        printCommentsBeforeY(Infinity, "");

        if (index < startNodes.length - 1) {
            appendLine('');
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
