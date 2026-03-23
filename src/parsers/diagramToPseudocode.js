export const parseDrawioToPseudocode = (xml) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const cells = Array.from(doc.querySelectorAll('mxCell'));

    let nodes = {};
    let edges = [];
    let variables = new Set();
    let errors = [];

    const cleanTextWithLines = (html) => {
      if (!html) return '';
      let t = html.replace(/<br\s*\/?>/gi, '\n');
      t = t.replace(/<\/div>/gi, '\n');
      t = t.replace(/<\/p>/gi, '\n');
      t = t.replace(/<[^>]*>?/gm, ''); 
      t = t.replace(/&nbsp;/gi, ' ').replace(/\u00A0/g, ' ');
      t = t.replace(/&gt;/gi, '>').replace(/&lt;/gi, '<').replace(/&amp;/gi, '&');
      return t.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
    };

    cells.forEach(cell => {
      const id = cell.getAttribute('id');
      const vertex = cell.getAttribute('vertex');
      const edge = cell.getAttribute('edge');
      const parentId = cell.getAttribute('parent');

      if (vertex === '1') {
        let value = cleanTextWithLines(cell.getAttribute('value'));
        const style = cell.getAttribute('style') || '';
        const geo = cell.querySelector('mxGeometry');
        const y = geo ? parseFloat(geo.getAttribute('y') || 0) : 0;

        let type = 'ACTION';
        let entityType = 'FUNCTION';
        
        if (style.includes('shape=note') || style.includes('fillColor=#fff2cc') || value.startsWith('#') || value.startsWith('//')) {
            type = 'COMMENT';
        }
        else if (style.includes('swimlane') || style.includes('dashed=1')) type = 'BUBBLE';
        else if (style.includes('ellipse')) {
            if (!value) type = 'MERGE'; 
            else type = 'START_END';
        }
        else if (style.includes('rhombus') || style.includes('hexagon')) type = 'CONDITION';
        else if (style.includes('shape=parallelogram')) {
          if (value.includes('=') && !value.toLowerCase().startsWith('vstup')) type = 'ACTION';
          else if (value.toUpperCase().startsWith('RETURN')) type = 'ACTION';
          else {
              type = 'IO';
              let oldFormatTokens = value.split(/[,\s\n\t]+/).filter(Boolean);
              if (oldFormatTokens.length > 0 && oldFormatTokens[0].toLowerCase() === 'vstup') {
                  const vars = oldFormatTokens.slice(1);
                  value = 'Vstup ' + vars.join(', ');
                  vars.forEach(v => variables.add(v.trim()));
              } else if (/^(INT\s|STRING\s|REAL\s|BOOLEAN\s|DEKLARACE)/i.test(value)) {
                  value = value.split(/[\n]+/).join(', ');
              } else {
                  value = value.split(/[\n]+/).join(', ');
              }
          }
        }

        nodes[id] = { id, value, type, y, parentId, entityType, next: [], prev: [] };
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

    let bundles = [];
    let processed = new Set();
    let pendingComments = Object.values(nodes).filter(n => n.type === 'COMMENT').sort((a, b) => a.y - b.y);

    const startNodes = Object.values(nodes).filter(n => n.type === 'START_END' && n.prev.length === 0 && !n.value.toLowerCase().includes('konec'));

    const printCommentsBeforeY = (currentY, indent) => {
        let res = "";
        while (pendingComments.length > 0 && pendingComments[0].y <= currentY + 40) {
            let c = pendingComments.shift();
            let lines = c.value.split('\n');
            lines.forEach(line => {
                let cleanLine = line.replace(/^[\/#\s]+/, '').trim();
                if (cleanLine) res += `${indent}# ${cleanLine}\n`;
            });
        }
        return res;
    };

    const generateStatement = (node, indent = "") => {
        let blockCode = printCommentsBeforeY(node.y, indent);
        let upperVal = node.value.toUpperCase();
        let hasReturn = upperVal.includes('RETURN');

        if (hasReturn && node.next.length > 0) {
            errors.push(`Z bloku obsahujícího RETURN ('${node.value}') nesmí vést žádné další šipky.`);
            blockCode += `${indent}# [CHYBA] Z RETURN nesmí vést šipky!\n`;
        }

        if (node.type === 'ACTION') {
            if (!node.value) return blockCode;
            let lines = node.value.split('\n');
            if (lines.length > 1) blockCode += `${indent}# Pozn.: Každá operace by měla být zapsána ve vlastním bloku.\n`;

            lines.forEach(line => {
                let val = line.trim();
                if (!val) return;
                
                if (val.toUpperCase().startsWith('RETURN')) {
                    blockCode += `${indent}${val}\n`;
                } else if (val.includes('=')) {
                    let parts = val.split('=');
                    let left = parts[0].trim();
                    if (left.includes('(') || left.includes(')')) {
                        errors.push(`Neplatná syntaxe přiřazení: '${val}'. Nelze přiřadit hodnotu do funkce.`);
                        blockCode += `${indent}# [CHYBA] Nelze přiřazovat do funkce!\n${indent}${val}\n`;
                    } else {
                        variables.add(left.replace(/^(INT|STRING|REAL|BOOLEAN)\s+/i, '').trim());
                        blockCode += `${indent}${val}\n`;
                    }
                } else {
                    let isFuncFormat = val.includes('(') || val.includes(')');
                    let rawName = val.replace(/[()]/g, '');
                    if (!isFuncFormat && variables.has(rawName)) blockCode += `${indent}${val}\n`;
                    else {
                        if (!isFuncFormat && !hasReturn && val.toUpperCase() !== 'RETURN') blockCode += `${indent}# Pozn.: '${rawName}' nebylo definováno jako proměnná, volá se jako funkce.\n`;
                        blockCode += `${indent}${isFuncFormat ? val : val + '()'}\n`;
                    }
                }
            });
            return blockCode;
        }
        
        if (node.type === 'IO') {
            if (/^(INT\s|STRING\s|REAL\s|BOOLEAN\s|DEKLARACE)/i.test(node.value) || upperVal.startsWith('VSTUP')) {
                return blockCode + `${indent}# Deklarace / Vstup\n${indent}${node.value}\n`;
            }
            if (upperVal.startsWith('PRINT')) {
                let innerText = node.value.substring(5).trim();
                if (innerText.startsWith('(')) innerText = innerText.substring(1).trim();
                if (innerText.endsWith(')')) innerText = innerText.substring(0, innerText.length - 1).trim();
                return blockCode + `${indent}PRINT(${innerText})\n`;
            }
            return blockCode + `${indent}PRINT(${node.value})\n`;
        }
        return blockCode;
    };

    const doesPathLoopBack = (startNodeId, targetNodeId) => {
        if (startNodeId === targetNodeId) return true;
        let visited = new Set();
        let queue = [startNodeId];
        while(queue.length > 0) {
            let curr = queue.shift();
            if (!curr) continue;
            if (!visited.has(curr)) {
                visited.add(curr);
                if (nodes[curr] && nodes[curr].next) {
                    for (let edge of nodes[curr].next) {
                        if (edge.target === targetNodeId) return true;
                        queue.push(edge.target);
                    }
                }
            }
        }
        return false;
    };

    const getReachable = (startId) => {
        let reach = new Set();
        let queue = [startId];
        while(queue.length > 0) {
            let curr = queue.shift();
            if (curr && !reach.has(curr)) {
                reach.add(curr);
                if (nodes[curr]) nodes[curr].next.forEach(e => queue.push(e.target));
            }
        }
        return reach;
    };

    const getLinearPath = (startId, stopId) => {
        let path = [];
        let curr = startId;
        let safe = 0;
        while(curr && curr !== stopId && safe < 100) {
            safe++;
            if (nodes[curr]) {
                path.push(nodes[curr]);
                if (nodes[curr].next.length > 0) curr = nodes[curr].next[0].target;
                else break;
            } else break;
        }
        return path;
    };

    startNodes.forEach(start => {
      let entity = start.entityType || 'FUNCTION';
      let bundleCode = `${entity} ${start.value}()\n`;
      let inPath = new Set();
      
      const traverse = (nodeId, indent = "    ", stopId = null) => {
        if (!nodeId || processed.has(nodeId) || nodeId === stopId) return;

        const node = nodes[nodeId];
        processed.add(nodeId);
        inPath.add(nodeId);

        if (node.type === 'MERGE' || (node.type === 'ACTION' && !node.value)) {
            if (node.next.length > 0) traverse(node.next[0].target, indent, stopId);
        } else if (node.type === 'ACTION' || node.type === 'IO') {
            bundleCode += generateStatement(node, indent);
            if (node.next.length > 0) traverse(node.next[0].target, indent, stopId);
        } else if (node.type === 'CONDITION') {
            bundleCode += printCommentsBeforeY(node.y, indent);
            const trueEdge = node.next.find(e => ['ano', 'yes', 'true', '1', 'y', '+'].includes(e.value)) || node.next[0];
            const falseEdge = node.next.find(e => ['ne', 'no', 'false', '0', 'n', '-'].includes(e.value)) || node.next[1];
            
            const tTarget = trueEdge?.target;
            const fTarget = falseEdge?.target;

            const tIsAncestor = tTarget ? inPath.has(tTarget) : false;
            const fIsAncestor = fTarget ? inPath.has(fTarget) : false;

            const tLoopsBack = (tTarget && !tIsAncestor) ? doesPathLoopBack(tTarget, node.id) : false;
            const fLoopsBack = (fTarget && !fIsAncestor) ? doesPathLoopBack(fTarget, node.id) : false;

            if (tLoopsBack || fLoopsBack) {
                const isTrueLoop = tLoopsBack;
                const bodyTarget = isTrueLoop ? tTarget : fTarget;
                const exitTarget = isTrueLoop ? fTarget : tTarget;

                const isForLoop = node.value.toUpperCase().startsWith('FOR ');
                const conditionText = isTrueLoop ? node.value : `NOT (${node.value})`;
                
                if (isForLoop) bundleCode += `${indent}${conditionText} DO\n`;
                else bundleCode += `${indent}WHILE ${conditionText} DO\n`;
                
                traverse(bodyTarget, indent + "    ", node.id);

                if (isForLoop) bundleCode += `${indent}ENDFOR\n`;
                else bundleCode += `${indent}ENDWHILE\n`;

                if (exitTarget) traverse(exitTarget, indent, stopId);
            } else if (tIsAncestor || fIsAncestor) {
                const isTrueLoop = tIsAncestor;
                const loopTarget = isTrueLoop ? tTarget : fTarget;
                const exitTarget = isTrueLoop ? fTarget : tTarget;

                const isForLoop = node.value.toUpperCase().startsWith('FOR ');
                const conditionText = isTrueLoop ? node.value : `NOT (${node.value})`;
                
                if (isForLoop) bundleCode += `${indent}${conditionText} DO\n`;
                else bundleCode += `${indent}WHILE ${conditionText} DO\n`;
                
                const loopBody = getLinearPath(loopTarget, node.id);
                loopBody.forEach(bNode => { bundleCode += generateStatement(bNode, indent + "    "); });

                if (isForLoop) bundleCode += `${indent}ENDFOR\n`;
                else bundleCode += `${indent}ENDWHILE\n`;

                if (exitTarget) traverse(exitTarget, indent, stopId);
            } else {
                let mergeNodeId = null;
                if (tTarget && fTarget) {
                    const reachTrue = getReachable(tTarget);
                    const reachFalse = getReachable(fTarget);
                    for (let id of reachTrue) {
                        if (reachFalse.has(id)) { mergeNodeId = id; break; }
                    }
                }

                const isForLoop = node.value.toUpperCase().startsWith('FOR ');
                
                if (isForLoop) {
                    bundleCode += `${indent}${node.value} DO\n`;
                    if (tTarget && tTarget !== mergeNodeId) traverse(tTarget, indent + "    ", mergeNodeId || stopId);
                    bundleCode += `${indent}ENDFOR\n`;
                    if (fTarget && fTarget !== mergeNodeId && nodes[fTarget] && nodes[fTarget].type !== 'START_END') traverse(fTarget, indent, stopId);
                } else {
                    bundleCode += `${indent}IF ${node.value} THEN\n`;
                    if (tTarget && tTarget !== mergeNodeId) traverse(tTarget, indent + "    ", mergeNodeId || stopId);
                    
                    if (fTarget && fTarget !== mergeNodeId && nodes[fTarget] && nodes[fTarget].type !== 'START_END') {
                        bundleCode += `${indent}ELSE\n`;
                        traverse(fTarget, indent + "    ", mergeNodeId || stopId);
                    }
                    bundleCode += `${indent}ENDIF\n`;
                }

                if (mergeNodeId && !inPath.has(mergeNodeId)) traverse(mergeNodeId, indent, stopId);
            }
        }
        inPath.delete(nodeId);
      };

      if (start.next.length > 0) traverse(start.next[0].target);
      bundleCode += `END${entity}\n`;
      bundles.push(bundleCode);
    });

    if (bundles.length === 0) return { code: "", errors: ["Diagram neobsahuje počáteční blok."] };
    return { code: bundles.join('\n\n# ----------------------\n\n'), errors };
  } catch (err) {
    return { bundles: [], code: "", errors: [err.message] };
  }
};