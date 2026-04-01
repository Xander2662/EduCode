export const parseDrawioToPseudocode = (xml) => {
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
                  
      const tagsToRemove = ['b', 'i', 'u', 'span', 'font', 'div', 'p', 'strong', 'em', 'strike', 's', 'sub', 'sup', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      tagsToRemove.forEach(tag => {
          const openReg = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi');
          const closeReg = new RegExp(`</${tag}>`, 'gi');
          t = t.replace(openReg, '').replace(closeReg, '');
      });
      
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
        else if (style.includes('ellipse')) {
            const modeMatch = style.match(/mode=([^;]+)/);
            const mode = modeMatch ? modeMatch[1] : null;
            if (mode === 'end' || value.toUpperCase() === 'ENDFUNCTION' || value.toUpperCase() === 'ENDCLASS' || value.toUpperCase() === 'KONEC') type = 'END';
            else type = 'START';
        }
        else if (style.includes('rhombus') || style.includes('hexagon')) type = 'CONDITION';
        else if (style.includes('shape=parallelogram')) {
          if (value.includes('=') && !value.toLowerCase().startsWith('vstup')) type = 'ACTION';
          else if (value.toUpperCase().startsWith('RETURN')) type = 'ACTION';
          else {
              type = 'IO';
              let tokens = value.split(/[,\s\n\t]+/).filter(Boolean);
              if (tokens.length > 0 && tokens[0].toLowerCase() === 'vstup') value = 'Vstup ' + tokens.slice(1).join(', ');
          }
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

    if (startNodes.length === 0) return { code: "", errors: ["Diagram neobsahuje počáteční blok."], nodeLineMap: {} };

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

    const generateStatement = (node, indent = "") => {
        printCommentsBeforeY(node.y, indent);
        if (node.type === 'MERGE' || !node.value) return;

        if (node.type === 'ACTION') {
            node.value.split('\n').forEach(line => {
                let val = line.trim();
                if (!val) return;
                if (val.toUpperCase().startsWith('RETURN') || val.includes('=')) {
                    appendLine(`${indent}${val}`, node.id);
                } else {
                    let isFuncFormat = val.includes('(') || val.includes(')');
                    appendLine(`${indent}${isFuncFormat ? val : val + '()'}`, node.id);
                }
            });
        } else if (node.type === 'IO') {
            if (/^(INT\s|STRING\s|REAL\s|BOOLEAN\s|DEKLARACE)/i.test(node.value) || node.value.toUpperCase().startsWith('VSTUP')) {
                appendLine(`${indent}${node.value}`, node.id);
            } else if (node.value.toUpperCase().startsWith('PRINT')) {
                let inner = node.value.substring(5).trim();
                if (inner.startsWith('(')) inner = inner.substring(1, inner.length - 1).trim();
                appendLine(`${indent}PRINT(${inner})`, node.id);
            } else appendLine(`${indent}PRINT(${node.value})`, node.id);
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

    startNodes.forEach((start, index) => {
        let endNodeId = null;
        let endNodeVal = `END${start.entityType || 'FUNCTION'}`;

        const traverse = (nodeId, indent = "", inPath = new Set(), stopId = null) => {
            if (!nodeId || !nodes[nodeId] || nodeId === stopId || visited.has(nodeId)) return;

            const node = nodes[nodeId];
            visited.add(nodeId);
            inPath.add(nodeId);

            if (node.type === 'START') {
                const fName = node.value || 'main';
                if (declaredFuncs.has(fName)) errors.push(`Duplicitní název funkce/třídy '${fName}'`);
                declaredFuncs.add(fName);

                appendLine(`${indent}${node.entityType} ${fName}()`, node.id);
                if (node.next.length > 0) traverse(node.next[0].target, indent + "    ", new Set(inPath), stopId);
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
                const trueEdge = node.next.find(e => ['ano', 'yes', 'true', '1', 'y', '+'].includes(e.value)) || node.next[0];
                const falseEdge = node.next.find(e => ['ne', 'no', 'false', '0', 'n', '-'].includes(e.value)) || node.next[1];
                
                const tTarget = trueEdge?.target;
                const fTarget = falseEdge?.target;

                const tLoops = tTarget ? doesPathLoopBack(tTarget, node.id) : false;
                const fLoops = fTarget ? doesPathLoopBack(fTarget, node.id) : false;

                if (tLoops || fLoops) {
                    const isTrueLoop = tLoops;
                    const isFor = node.value.toUpperCase().startsWith('FOR ');
                    const condText = isTrueLoop ? node.value : `NOT (${node.value})`;
                    
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
                        
                        traverse(loopStartTarget, indent + "    ", new Set(inPath), node.id);
                        
                        temporarilyUnvisited.forEach(id => visited.add(id));
                    }

                    appendLine(`${indent}${isFor ? 'ENDFOR' : 'ENDWHILE'}`);

                    const exitNode = isTrueLoop ? fTarget : tTarget;
                    if (exitNode && !inPath.has(exitNode)) traverse(exitNode, indent, new Set(inPath), stopId);
                } else {
                    appendLine(`${indent}IF ${node.value} THEN`, node.id);
                    if (tTarget) traverse(tTarget, indent + "    ", new Set(inPath), stopId);
                    
                    if (fTarget && nodes[fTarget] && nodes[fTarget].type !== 'END') {
                        appendLine(`${indent}ELSE`);
                        traverse(fTarget, indent + "    ", new Set(inPath), stopId);
                    }
                    appendLine(`${indent}ENDIF`);
                }
            }
            else if (node.type === 'END') {
                // Koncový blok už se nevypisuje přímo vnořený. Jen si ho zapamatujeme!
                endNodeId = node.id;
                let val = node.value.trim();
                if (val && val.toUpperCase() !== 'KONEC' && val.toUpperCase() !== 'END') {
                    endNodeVal = val;
                }
            }
            inPath.delete(nodeId);
        };

        traverse(start.id);

        // Až po skončení celé funkce (včetně všech IFů a WHILEů) se vypíše ENDFUNCTION a flushnou zbylé komentáře
        if (endNodeId) {
            printCommentsBeforeY(nodes[endNodeId].y, "");
            appendLine(endNodeVal, endNodeId);
        } else {
            errors.push(`Tip: Funkce '${start.value || 'main'}' není v diagramu napojena na koncový blok.`);
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