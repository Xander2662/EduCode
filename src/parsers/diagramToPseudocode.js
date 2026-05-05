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
        const vars = extractVariables(expr);
        vars.forEach(v => {
            if (!scope.has(v)) {
                const err = `Proměnná '${v}' byla použita před deklarací nebo je mimo svůj Scope.`;
                if (!errors.includes(err)) errors.push(err);
            }
        });
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
        else if (style.includes('shape=parallelogram')) {
            type = 'IO';
        }
        
        const entityMatch = style.match(/entityType=([^;]+)/);
        const entityType = entityMatch ? entityMatch[1] : 'FUNCTION';

        nodes[id] = { id, value, type, x, y, next: [], prev: [], entityType };
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

    if (startNodes.length === 0) {
        let roots = Object.values(nodes).filter(n => n.prev.length === 0 && n.type !== 'COMMENT' && n.type !== 'MERGE' && n.type !== 'END');
        let clusterId = 1;
        let assigned = new Set();
        
        if (roots.length > 0) {
            roots.forEach(r => {
                const ghostId = `ghost_start_${clusterId}`;
                nodes[ghostId] = { id: ghostId, value: `fragment_${clusterId}`, type: 'START', x: r.x, y: r.y - 100, next: [], prev: [], entityType: 'FUNCTION' };
                edges.push({ source: ghostId, target: r.id, value: '' });
                nodes[ghostId].next.push({ target: r.id, value: '' });
                r.prev.push({ source: ghostId, value: '' });
                startNodes.push(nodes[ghostId]);
                clusterId++;
                
                let q = [r.id];
                while(q.length > 0) {
                    let curr = q.shift();
                    if(!assigned.has(curr)) {
                        assigned.add(curr);
                        nodes[curr].next.forEach(e => q.push(e.target));
                    }
                }
            });
            errors.push(`Diagram neobsahuje počáteční blok. Bylo automaticky vygenerováno ${roots.length} funkcí (fragmentů) pro zachování vašich bloků.`);
        }

        Object.values(nodes).forEach(n => {
            if (!assigned.has(n.id) && n.type !== 'COMMENT' && n.type !== 'START' && n.type !== 'END' && n.type !== 'MERGE') {
                const ghostId = `ghost_start_${clusterId}`;
                nodes[ghostId] = { id: ghostId, value: `fragment_${clusterId}`, type: 'START', x: n.x, y: n.y - 100, next: [], prev: [], entityType: 'FUNCTION' };
                edges.push({ source: ghostId, target: n.id, value: '' });
                nodes[ghostId].next.push({ target: n.id, value: '' });
                n.prev.push({ source: ghostId, value: '' });
                startNodes.push(nodes[ghostId]);
                clusterId++;
                
                let q = [n.id];
                while(q.length > 0) {
                    let curr = q.shift();
                    if(!assigned.has(curr)) {
                        assigned.add(curr);
                        nodes[curr].next.forEach(e => q.push(e.target));
                    }
                }
            }
        });

        if (startNodes.length === 0) {
            errors.push("Diagram je prázdný nebo neobsahuje počáteční blok.");
            return { code: "", errors, nodeLineMap: {} };
        }
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

    const generateStatement = (node, indent = "", currentScope) => {
        printCommentsBeforeY(node.y, indent);
        if (node.type === 'MERGE' || !node.value) return;

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
                    appendLine(`${indent}${val}`, node.id);
                } else if (val.startsWith('"') && val.endsWith('"')) {
                    appendLine(`${indent}PRINT(${val})`, node.id);
                } else if (val.toUpperCase().startsWith('RETURN')) {
                    checkVariables(val.substring(6), currentScope);
                    appendLine(`${indent}${val}`, node.id);
                } else {
                    let isFuncFormat = val.includes('(') || val.includes(')');
                    checkVariables(val, currentScope);
                    appendLine(`${indent}${isFuncFormat ? val : val + '()'}`, node.id);
                }
            });
        } else if (node.type === 'IO') {
            let lines = node.value.split(/[\n;]+/);
            lines.forEach(line => {
                let val = line.trim();
                if(!val) return;
                
                if (val.toUpperCase().startsWith('PRINT') || val.includes('"')) {
                    let inner = val.toUpperCase().startsWith('PRINT') ? val.substring(5).trim() : val;
                    if (inner.startsWith('(')) inner = inner.substring(1, inner.length - 1).trim();
                    checkVariables(inner, currentScope);
                    appendLine(`${indent}PRINT(${inner})`, node.id);
                } else if (val.includes('=')) {
                    val.split(',').forEach(part => {
                        let p = part.trim();
                        if(!p) return;
                        if(p.includes('=')) {
                             let [left, right] = p.split('=');
                             declareVariables(left.trim(), currentScope);
                             checkVariables(right.trim(), currentScope);
                             appendLine(`${indent}${p}`, node.id);
                        } else {
                             let cleanV = p.replace(/^VSTUP\s+/i, '').trim();
                             cleanV = cleanV.replace(/[^\w]/g, ''); // Vyčištění pro zbloudilé tečky "y."
                             if (cleanV) {
                                 declareVariables(cleanV, currentScope);
                                 appendLine(`${indent}Vstup ${cleanV}`, node.id);
                             }
                        }
                    });
                } else {
                    val.split(',').forEach(part => {
                        let p = part.trim().replace(/^VSTUP\s+/i, '');
                        p = p.replace(/[^\w]/g, ''); // Vyčištění např. "y." -> "y"
                        if(p) {
                            declareVariables(p, currentScope);
                            appendLine(`${indent}Vstup ${p}`, node.id);
                        }
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
        let endNodeVal = `END${start.entityType || 'FUNCTION'}`;

        const traverse = (nodeId, indent = "", inPath = new Set(), stopId = null, currentScope = new Set()) => {
            if (!nodeId || !nodes[nodeId] || visited.has(nodeId)) return;
            if (nodeId === stopId) return;

            const node = nodes[nodeId];
            visited.add(nodeId);
            inPath.add(nodeId);

            if (node.type === 'START') {
                const fName = node.value || 'main';
                if (declaredFuncs.has(fName)) errors.push(`Duplicitní název funkce/třídy '${fName}'`);
                declaredFuncs.add(fName);

                appendLine(`${indent}${node.entityType} ${fName}()`, node.id);
                if (node.next.length > 0) traverse(node.next[0].target, indent + "    ", new Set(inPath), stopId, currentScope);
                printCommentsBeforeY(Infinity, indent + "    ");
            }
            else if (node.type === 'ACTION' || node.type === 'IO' || node.type === 'MERGE') {
                generateStatement(node, indent, currentScope);
                if (node.next.length > 0 && !inPath.has(node.next[0].target)) {
                    traverse(node.next[0].target, indent, new Set(inPath), stopId, currentScope);
                }
            }
            else if (node.type === 'CONDITION') {
                printCommentsBeforeY(node.y, indent);
                
                checkVariables(node.value, currentScope);

                const trueEdge = node.next.find(e => ['ano', 'yes', 'true', '1', 'y', '+'].includes(e.value)) || node.next[0];
                const falseEdge = node.next.find(e => ['ne', 'no', 'false', '0', 'n', '-'].includes(e.value)) || node.next[1];
                
                const tTarget = trueEdge?.target;
                const fTarget = falseEdge?.target;

                const tLoops = tTarget ? doesPathLoopBack(tTarget, node.id) : false;
                const fLoops = fTarget ? doesPathLoopBack(fTarget, node.id) : false;

                let cleanCond = node.value.replace(/^(?:WHILE|IF)\s+/i, '').trim();

                if (tLoops || fLoops) {
                    const isTrueLoop = tLoops;
                    const isFor = node.value.toUpperCase().startsWith('FOR ');
                    const condText = isTrueLoop ? cleanCond : `NOT (${cleanCond})`;
                    
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
                        
                        traverse(loopStartTarget, indent + "    ", new Set(inPath), node.id, new Set(currentScope));
                        
                        temporarilyUnvisited.forEach(id => visited.add(id));
                    }

                    appendLine(`${indent}${isFor ? 'ENDFOR' : 'ENDWHILE'}`);

                    const exitNode = isTrueLoop ? fTarget : tTarget;
                    if (exitNode && exitNode !== stopId && !inPath.has(exitNode)) traverse(exitNode, indent, new Set(inPath), stopId, currentScope);
                } else {
                    let mergeNodeId = findConvergence(tTarget, fTarget);
                    
                    appendLine(`${indent}IF ${cleanCond} THEN`, node.id);
                    if (tTarget && tTarget !== mergeNodeId) traverse(tTarget, indent + "    ", new Set(inPath), mergeNodeId || stopId, new Set(currentScope));
                    
                    if (fTarget && fTarget !== mergeNodeId && nodes[fTarget] && nodes[fTarget].type !== 'END') {
                        appendLine(`${indent}ELSE`);
                        traverse(fTarget, indent + "    ", new Set(inPath), mergeNodeId || stopId, new Set(currentScope));
                    }
                    appendLine(`${indent}ENDIF`);
                    
                    if (mergeNodeId && mergeNodeId !== stopId) {
                        traverse(mergeNodeId, indent, new Set(inPath), stopId, currentScope);
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
            errors.push(`Tip: Funkce '${start.value || 'main'}' neměla koncový blok. Byl automaticky vygenerován do kódu.`);
        }
        
        printCommentsBeforeY(Infinity, "");

        if (index < startNodes.length - 1) {
            appendLine('');
        }
    });

    let code = codeLines.join('\n').trim();
    return { code, errors, nodeLineMap };
  } catch (err) {
    return { code: "", errors: ["Kritická chyba parseru: " + err.message], nodeLineMap: {} };
  }
};  