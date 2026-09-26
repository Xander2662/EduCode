import { parseDrawioToPseudocode } from './diagramToPseudocode.js';

export const parsePseudocodeToDrawio = (code, existingXml = null, edgeStyle = 'true-false', conditionShape = 'hexagon', editorMode = 'simple') => {
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
    const nodeLineMap = {};
    let searchStartIdx = 0;

    let originalCodeNodeIds = null;
    let originalCodeLines = null;
    if (existingXml && existingXml.includes('<mxGraphModel')) {
        try {
            const parsed = parseDrawioToPseudocode(existingXml);
            if (parsed && parsed.codeNodeIds) {
                originalCodeNodeIds = parsed.codeNodeIds;
                originalCodeLines = parsed.code ? parsed.code.split('\n').map(l => l.trim()) : [];
            }
        } catch {
            // ignore
        }
    }

    const getOriginalIdForLine = (lineIdx, text) => {
        if (!originalCodeNodeIds || !originalCodeLines) return null;
        const norm = (t) => (t || '').replace(/\(\)$/, '').replace(/\s+/g, ' ').trim();
        const normTarget = norm(text);

        if (originalCodeLines[lineIdx] && norm(originalCodeLines[lineIdx]) === normTarget) {
            return originalCodeNodeIds[lineIdx] || null;
        }
        for (let offset = 1; offset < 5; offset++) {
            const up = lineIdx - offset;
            if (up >= 0 && originalCodeLines[up] && norm(originalCodeLines[up]) === normTarget) {
                return originalCodeNodeIds[up] || null;
            }
            const dn = lineIdx + offset;
            if (dn < originalCodeLines.length && originalCodeLines[dn] && norm(originalCodeLines[dn]) === normTarget) {
                return originalCodeNodeIds[dn] || null;
            }
        }
        return null;
    };

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
    let existingEdges = [];
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
            const cellType = cell.getAttribute('type');
            const geo = cell.querySelector('mxGeometry');
            if (geo) {
                let type = 'ACTION';
                if (style.includes('ellipse') && style.includes('strokeColor=none') && style.includes('fillColor=none')) type = 'MERGE';
                else if (style.includes('ellipse') || cellType === 'START_END') type = 'START_END';
                else if (style.includes('rhombus') || style.includes('hexagon') || cellType === 'CONDITION') type = 'CONDITION';
                else if (style.includes('shape=parallelogram') || cellType === 'IO') type = 'IO';
                else if (style.includes('shape=note') || cellType === 'COMMENT') type = 'COMMENT';
                else if (style.includes('swimlane') || style.includes('LOOP_CONTAINER') || cellType === 'LOOP_CONTAINER') type = 'LOOP_CONTAINER';
                const isSwapped = style.includes('isSwapped=true');
                const w = parseFloat(geo.getAttribute('width'));
                const h = parseFloat(geo.getAttribute('height'));
                existingNodes.push({ id: cell.getAttribute('id'), val, type, x: parseFloat(geo.getAttribute('x')), y: parseFloat(geo.getAttribute('y')), w: !isNaN(w) ? w : undefined, h: !isNaN(h) ? h : undefined, isSwapped, used: false });
            }
        });

        doc.querySelectorAll('mxCell[edge="1"]').forEach(cell => {
            const source = cell.getAttribute('source');
            const target = cell.getAttribute('target');
            let rawVal = cell.getAttribute('value') || '';
            let val = rawVal.replace(/<[^>]*>?/gm, '').trim().toLowerCase();
            const style = cell.getAttribute('style') || '';
            const shMatch = style.match(/sourceHandle=([^;]+)/);
            existingEdges.push({ source, target, val, sourceHandle: shMatch ? shMatch[1] : 's-bottom' });
        });
    }

    let currentBlockStartIndex = 0;

    const getPos = (text, type, defX, currentY, originalId = null, isOutsideContainer = false) => {
        const normalize = (t) => t.replace(/\(\)$/g, '').replace(/\s+/g, ' ').trim();
        const normalizedTarget = normalize(text);

        if (originalId) {
            const idMatch = existingNodes.find(n => !n.used && n.id === originalId);
            if (idMatch) {
                const isCrossFromContainer = (type === 'CONDITION' && (idMatch.type === 'LOOP_CONTAINER' || idMatch.type === 'FOR_CONTAINER'));
                const isCrossFromCond = ((type === 'LOOP_CONTAINER' || type === 'FOR_CONTAINER') && idMatch.type === 'CONDITION');
                if (idMatch.type === type || isCrossFromContainer || isCrossFromCond) {
                    idMatch.used = true;
                    const x = (isCrossFromContainer || (editorMode === 'simple' && isOutsideContainer && Math.abs(idMatch.x - defX) > 40)) ? defX : idMatch.x;
                    const lastNode = outNodes.length > currentBlockStartIndex ? outNodes[outNodes.length - 1] : null;
                    const lastH = lastNode ? (lastNode.type === 'CONDITION' ? (lastNode.h && lastNode.h <= 100 ? lastNode.h : 80) : (lastNode.h || 50)) : 0;
                    const lastBottom = lastNode ? lastNode.y + lastH : 0;
                    const y = (isCrossFromContainer || (lastNode && idMatch.y < lastBottom + 20))
                        ? Math.max(lastBottom + 30, (typeof idMatch.y === 'number' && !isNaN(idMatch.y)) ? idMatch.y : currentY)
                        : ((typeof idMatch.y === 'number' && !isNaN(idMatch.y)) ? idMatch.y : currentY);
                    return {
                        x,
                        y,
                        matched: true,
                        isFromCond: isCrossFromCond,
                        oldId: isCrossFromContainer ? getNewId() : idMatch.id,
                        isSwapped: idMatch.isSwapped,
                        w: (isCrossFromContainer || isCrossFromCond) ? undefined : idMatch.w,
                        h: (isCrossFromContainer || isCrossFromCond) ? undefined : idMatch.h
                    };
                }
            }
        }

        const candidates = existingNodes.filter(n => !n.used && n.type === type && normalize(n.val) === normalizedTarget);
        if (candidates.length > 0) {
            // Only consider candidates in the local proximity of defX (same fragment/column)
            // to avoid stealing nodes from other distant fragments across the canvas
            const localCandidates = candidates.filter(cand => Math.abs(cand.x - defX) <= 450);
            if (localCandidates.length > 0) {
                localCandidates.sort((a, b) => {
                    const xDistA = Math.abs(a.x - defX);
                    const xDistB = Math.abs(b.x - defX);
                    if (Math.abs(xDistA - xDistB) > 200) {
                        return xDistA - xDistB;
                    }
                    if (a.y !== b.y) return a.y - b.y;
                    return xDistA - xDistB;
                });
                const match = localCandidates[0];
                match.used = true;
                const lastNode = outNodes.length > currentBlockStartIndex ? outNodes[outNodes.length - 1] : null;
                const lastH = lastNode ? (lastNode.type === 'CONDITION' ? (lastNode.h && lastNode.h <= 100 ? lastNode.h : 80) : (lastNode.h || 50)) : 0;
                const lastBottom = lastNode ? lastNode.y + lastH : 0;
                const y = (lastNode && match.y < lastBottom + 20)
                    ? Math.max(lastBottom + 30, (typeof match.y === 'number' && !isNaN(match.y)) ? match.y : currentY)
                    : ((typeof match.y === 'number' && !isNaN(match.y)) ? match.y : currentY);
                return { x: match.x, y, matched: true, oldId: match.id, isSwapped: match.isSwapped, w: match.w, h: match.h };
            }
        }

        // Cross-mode conversion matching when switching between simple and advanced mode:
        // 1. In advanced mode: CONDITION can inherit position from existing LOOP_CONTAINER / FOR_CONTAINER
        if (type === 'CONDITION') {
            const containerCand = existingNodes.find(n => !n.used && (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') && normalize(n.val) === normalizedTarget && Math.abs(n.x - defX) <= 450);
            if (containerCand) {
                containerCand.used = true;
                const x = defX;
                const y = (typeof containerCand.y === 'number' && !isNaN(containerCand.y)) ? Math.max(currentY, containerCand.y) : currentY;
                return { x, y, matched: true, oldId: getNewId() };
            }
        }
        // 2. In simple mode: LOOP_CONTAINER / FOR_CONTAINER can inherit position from existing CONDITION
        if (type === 'LOOP_CONTAINER' || type === 'FOR_CONTAINER') {
            const condCand = existingNodes.find(n => !n.used && n.type === 'CONDITION' && normalize(n.val) === normalizedTarget && Math.abs(n.x - defX) <= 450);
            if (condCand) {
                condCand.used = true;
                const x = condCand.x - 95;
                const y = (typeof condCand.y === 'number' && !isNaN(condCand.y)) ? Math.max(40, condCand.y - 40) : currentY;
                return { x, y, matched: true, isFromCond: true, oldId: getNewId() };
            }
        }

        return { x: defX, y: currentY, matched: false, oldId: getNewId() };
    };

    const getConditionPorts = (nodeId, isNot) => {
        let tHandle = "s-bottom";
        let fHandle = "s-right";

        const trueVals = ['ano', 'yes', 'true', '1', 'y', '+'];
        const falseVals = ['ne', 'no', 'false', '0', 'n', '-'];

        const oldTrueEdge = existingEdges.find(e => e.source === nodeId && trueVals.includes(e.val));
        const oldFalseEdge = existingEdges.find(e => e.source === nodeId && falseVals.includes(e.val));

        const matchedNode = existingNodes.find(n => n.id === nodeId) || outNodes.find(n => n.id === nodeId);
        if (oldTrueEdge && !oldFalseEdge) {
            tHandle = oldTrueEdge.sourceHandle;
            fHandle = tHandle === 's-bottom' ? 's-right' : 's-bottom';
        } else if (!oldTrueEdge && oldFalseEdge) {
            fHandle = oldFalseEdge.sourceHandle;
            tHandle = fHandle === 's-bottom' ? 's-right' : 's-bottom';
        } else if (oldTrueEdge && oldFalseEdge) {
            tHandle = oldTrueEdge.sourceHandle;
            fHandle = oldFalseEdge.sourceHandle;
            if (tHandle === fHandle) {
                fHandle = tHandle === 's-bottom' ? 's-right' : 's-bottom';
            }
        } else if (matchedNode?.isSwapped) {
            let tempH = tHandle;
            tHandle = fHandle;
            fHandle = tempH;
        }

        let tText = EL.t;
        let fText = EL.f;

        if (isNot) {
            let tempH = tHandle;
            tHandle = fHandle;
            fHandle = tempH;
            
            let tempT = tText;
            tText = fText;
            fText = tempT;
        }

        return { tHandle, fHandle, tText, fText };
    };

    let outNodes = [];
    let outEdges = [];
    let globalGroupX = 360;

    const STYLES = {
        START_END: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
        ACTION: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
        IO: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;spacingLeft=35;spacingRight=30;fillColor=#d5e8d4;strokeColor=#82b366;",
        CONDITION: conditionShape === 'diamond' 
            ? "rhombus;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;" 
            : "shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;size=0.15;fillColor=#ffe6cc;strokeColor=#d79b00;",
        COMMENT: "shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;darkOpacity=0.05;fillColor=#fff2cc;strokeColor=#d6b656;",
        MERGE: "ellipse;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none;resizable=0;movable=0;rotatable=0;",
        LOOP_CONTAINER: "swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;LOOP_CONTAINER;",
        FOR_CONTAINER: "swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;strokeColor=#4f46e5;FOR_CONTAINER;",
        SWITCH_CONTAINER: "swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;strokeColor=#f97316;SWITCH_CONTAINER;",
        CASE_CONTAINER: "swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;strokeColor=#f97316;CASE_CONTAINER;",
        EDGE: "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
    };

    const getNodeBounds = (n) => {
        let w = Math.max(n.w || 0, n.type === 'CONDITION' ? 160 : (n.type === 'START_END' ? 180 : 160));
        let h = Math.max(n.h || 0, n.type === 'CONDITION' ? 80 : 50);
        if (n.type === 'COMMENT') { w = Math.max(w, 160); h = Math.max(h, 50); }
        else if (n.type === 'MERGE') { w = 10; h = 10; }
        else if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') { w = Math.max(w, 350); h = Math.max(h, 200); }
        else if (n.type === 'SWITCH_CONTAINER') { w = Math.max(w, 450); h = Math.max(h, 250); }
        else if (n.type === 'CASE_CONTAINER') { w = Math.max(w, 300); h = Math.max(h, 150); }
        return {
            left: n.x,
            top: n.y,
            right: n.x + w,
            bottom: n.y + h,
            w,
            h
        };
    };

    const checkOverlap = (nodeA, nodeB) => {
        if (nodeA.parentId === nodeB.id || nodeB.parentId === nodeA.id) return false;
        const b1 = getNodeBounds(nodeA);
        const b2 = getNodeBounds(nodeB);
        const margin = 20;
        return !(
            b1.right + margin <= b2.left ||
            b1.left >= b2.right + margin ||
            b1.bottom + margin <= b2.top ||
            b1.top >= b2.bottom + margin
        );
    };

    let lastBlockMaxY = 0;

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

        if (/^fragment_\d+$/i.test(funcName)) {
            const hasRealStatements = blockLines.some(l => {
                const trimmed = l.trim();
                return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//') &&
                       trimmed.toUpperCase() !== 'ENDFUNCTION' && trimmed.toUpperCase() !== 'ENDCLASS' && trimmed.toUpperCase() !== 'KONEC';
            });
            if (!hasRealStatements) return;
        }

        const blockStartIndex = outNodes.length;
        currentBlockStartIndex = blockStartIndex;

        let hasEnd = false;
        let endLineText = "Konec";
        let originalEndLine = null;
        if (blockLines.length > 0) {
            const lastLine = blockLines[blockLines.length - 1].toUpperCase();
            if (lastLine === 'ENDFUNCTION' || lastLine === 'ENDCLASS' || lastLine === 'KONEC') {
                endLineText = blockLines.pop();
                originalEndLine = endLineText;
                hasEnd = true;
            }
        }

        const isFragment = /^fragment_\d+$/i.test(funcName);

        const isStandaloneLoopGroup = (lines) => {
            if (lines.length === 0) return false;
            const firstUpper = lines[0].toUpperCase();
            if (!firstUpper.startsWith('WHILE ') && !firstUpper.startsWith('FOR ')) {
                return false;
            }
            let depth = 0;
            for (let idx = 0; idx < lines.length; idx++) {
                const u = lines[idx].toUpperCase();
                if (u.startsWith('WHILE ') || u.startsWith('FOR ')) {
                    depth++;
                } else if (u === 'ENDWHILE' || u === 'ENDFOR') {
                    depth--;
                    if (depth === 0) {
                        return idx === lines.length - 1;
                    }
                }
            }
            return false;
        };

        const contentLines = blockLines.map(l => l.trim()).filter(l => 
            l && !l.startsWith('#') && !l.startsWith('//') &&
            l.toUpperCase() !== 'ENDFUNCTION' && l.toUpperCase() !== 'ENDCLASS' && l.toUpperCase() !== 'KONEC'
        );

        const isStandaloneLoop = editorMode === 'simple' && isFragment && isStandaloneLoopGroup(contentLines);

        let yOffset = lastBlockMaxY > 0 ? lastBlockMaxY + 100 : 40;
        let effectiveStartDefX = globalGroupX;
        const normalize = (t) => t.replace(/\(\)$/g, '').replace(/\s+/g, ' ').trim();
        let existingStart = existingNodes.find(n => !n.used && n.type === 'START_END' && normalize(n.val) === normalize(funcName || "main"));
        if (!existingStart && isFragment && !isStandaloneLoop) {
            const unusedFragStarts = existingNodes.filter(n => !n.used && n.type === 'START_END' && /^fragment(_\d+)?$/i.test(normalize(n.val)));
            if (unusedFragStarts.length > 0) {
                unusedFragStarts.sort((a, b) => a.x - b.x || a.y - b.y);
                existingStart = unusedFragStarts[0];
            }
        }

        let spawnStartEnd = true;
        if (isStandaloneLoop && !existingStart) {
            spawnStartEnd = false;
        }

        if (existingStart) {
            effectiveStartDefX = existingStart.x;
            if (typeof existingStart.y === 'number' && !isNaN(existingStart.y)) {
                yOffset = existingStart.y;
            }
        } else {
            const unusedNonStart = existingNodes.filter(n => !n.used && n.type !== 'START_END');
            if (unusedNonStart.length > 0) {
                unusedNonStart.sort((a, b) => a.y - b.y);
                const firstMatched = unusedNonStart[0];
                if (firstMatched.type === 'LOOP_CONTAINER' || firstMatched.type === 'FOR_CONTAINER') {
                    effectiveStartDefX = firstMatched.x + 90;
                } else {
                    effectiveStartDefX = firstMatched.x;
                }
                if (typeof firstMatched.y === 'number' && !isNaN(firstMatched.y)) {
                    yOffset = spawnStartEnd ? Math.max(40, firstMatched.y - 100) : firstMatched.y;
                }
            }
        }

        let startId = null;
        let startPos = null;
        if (spawnStartEnd) {
            startPos = getPos(funcName || "main", 'START_END', effectiveStartDefX, yOffset);
            startId = startPos.oldId;
            outNodes.push({ id: startId, text: funcName || "main", type: 'START_END', x: startPos.x, y: startPos.y, mode: 'start', entityType });
            
            // Map the FUNCTION line to startId
            for (let k = searchStartIdx; k < lines.length; k++) {
                if (lines[k].toUpperCase().startsWith(firstUpper.startsWith('CLASS ') ? 'CLASS ' : 'FUNCTION ')) {
                    nodeLineMap[startId] = k;
                    searchStartIdx = k + 1;
                    break;
                }
            }
            yOffset = Math.max(140, startPos.y + 120);
        } else {
            if (typeof yOffset !== 'number' || isNaN(yOffset)) {
                yOffset = lastBlockMaxY > 0 ? lastBlockMaxY + 100 : 40;
            }
        }

        let stack = [];
        let skipSet = new Set();
        let pendingExits = spawnStartEnd ? [{ id: startId, text: "", handle: "s-bottom" }] : [];

        const addNode = (text, type, defaultX, extraProps = {}, originalLineText = null) => {
            // Find active case if any
            let parentIdAttr = '1';
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].type === 'SWITCH' && stack[i].currentCaseId) {
                    parentIdAttr = stack[i].currentCaseId;
                    break;
                }
            }
            if (extraProps.parentId) parentIdAttr = extraProps.parentId; // override

            let matchedLineIdx = null;
            if (originalLineText !== null) {
                for (let k = searchStartIdx; k < lines.length; k++) {
                    if (lines[k] === originalLineText) {
                        matchedLineIdx = k;
                        break;
                    }
                }
            }

            const originalId = matchedLineIdx !== null ? getOriginalIdForLine(matchedLineIdx, originalLineText) : null;
            const pos = getPos(text, type, defaultX, yOffset, originalId, stack.length === 0);
            const isSwapped = extraProps.isSwapped !== undefined ? extraProps.isSwapped : pos.isSwapped;
            const nodeW = extraProps.w !== undefined ? extraProps.w : pos.w;
            const nodeH = extraProps.h !== undefined ? extraProps.h : pos.h;
            outNodes.push({ id: pos.oldId, text, type, x: pos.x, y: pos.y, matched: pos.matched, parentId: parentIdAttr, isSwapped, ...(nodeW ? { w: nodeW } : {}), ...(nodeH ? { h: nodeH } : {}), ...extraProps });
            yOffset = Math.max(yOffset, pos.y) + (type === 'CONDITION' ? 160 : 100);
            
            if (matchedLineIdx !== null) {
                nodeLineMap[pos.oldId] = matchedLineIdx;
                searchStartIdx = matchedLineIdx + 1;
            }
            return pos.oldId;
        };

        const addEdge = (source, target, value = "", sourceHandle = "s-bottom", targetHandle = "t-top") => {
            let finalVal = value;
            const srcNode = outNodes.find(n => n.id === source);
            if (srcNode && srcNode.type === 'CONDITION' && !finalVal) {
                const ports = getConditionPorts(source, false);
                finalVal = sourceHandle === ports.fHandle ? ports.fText : ports.tText;
            }
            outEdges.push({ id: getNewId(), source, target, value: finalVal, sourceHandle, targetHandle });
        };

        const getXPos = () => {
            let x = startPos ? startPos.x : effectiveStartDefX;
            for (let i = 0; i < stack.length; i++) {
                if (stack[i].type === 'IF' && stack[i].trueExits !== null) x += 240;
                if (stack[i].type === 'SWITCH' && stack[i].currentCaseX !== undefined) {
                    return stack[i].currentCaseX;
                }
            }
            return x;
        };

        for (let i = 0; i < blockLines.length; i++) {
            if (skipSet.has(i)) continue;
            let line = blockLines[i];
            if (!line || line.trim() === '') continue;

            let upper = line.toUpperCase();

            if (upper.startsWith('//') || upper.startsWith('#')) {
                const commentText = line.replace(/^[/#\s]+/, '');
                addNode(commentText, 'COMMENT', getXPos() + 160, {}, commentText);
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
                }

                const condId = addNode(condText, 'CONDITION', getXPos(), {}, line);
                pendingExits.forEach(exit => addEdge(exit.id, condId, exit.text, exit.handle, "t-top"));

                const ports = getConditionPorts(condId, isNot);
                stack.push({ type: 'IF', id: condId, trueExits: null, isNot, branchStartY: yOffset, trueMaxY: 0 });

                pendingExits = [{ id: condId, text: ports.tText, handle: ports.tHandle }];
            }
            else if (upper === 'ELSE') {
                const currentIf = stack[stack.length - 1];
                currentIf.trueExits = [...pendingExits];
                currentIf.trueMaxY = yOffset;
                yOffset = currentIf.branchStartY;

                const ports = getConditionPorts(currentIf.id, currentIf.isNot);
                pendingExits = [{ id: currentIf.id, text: ports.fText, handle: ports.fHandle }];
            }
            else if (upper === 'ENDIF') {
                const currentIf = stack.pop();
                if (currentIf.trueExits === null) {
                    currentIf.trueExits = [...pendingExits];
                    const ports = getConditionPorts(currentIf.id, currentIf.isNot);
                    pendingExits = [{ id: currentIf.id, text: ports.fText, handle: ports.fHandle }];
                }
                pendingExits = [...currentIf.trueExits, ...pendingExits];
                yOffset = Math.max(yOffset, currentIf.trueMaxY || currentIf.branchStartY);
            }


            else if (upper.startsWith('SWITCH ')) {
                let switchVar = line.substring(7).trim();
                if (editorMode === 'simple') {
                    let switchX = getXPos() - 20;
                    let switchId = addNode(switchVar, 'SWITCH_CONTAINER', switchX, { switchVar, parentId: '1' }, line);
                    pendingExits.forEach(exit => addEdge(exit.id, switchId, exit.text, exit.handle, "t-left"));
                    stack.push({ type: 'SWITCH', id: switchId, isSimple: true, cases: [], switchVar, startX: switchX, startY: yOffset, currentCaseExits: null, maxCaseY: yOffset, caseCount: 0 });
                    pendingExits = []; // Nothing flows straight out of switch, it flows into cases
                } else {
                    let switchX = getXPos();
                    stack.push({
                        type: 'SWITCH',
                        isSimple: false,
                        switchVar,
                        entryExits: [...pendingExits],
                        prevFalseExit: null,
                        allExits: [],
                        caseIndex: 0,
                        startX: switchX,
                        startY: yOffset,
                        maxCaseY: yOffset
                    });
                    pendingExits = [];
                }
            }
            else if (upper.startsWith('CASE ') || upper === 'DEFAULT:') {
                let currentSwitch = stack[stack.length - 1];
                if (currentSwitch.type === 'SWITCH') {
                    let isDefault = (upper === 'DEFAULT:');
                    let caseVal = isDefault ? '' : line.substring(5, line.lastIndexOf(':')).trim();

                    if (currentSwitch.isSimple) {
                        // Save previous case exits
                        if (currentSwitch.currentCaseExits) {
                            currentSwitch.cases.push([...currentSwitch.currentCaseExits, ...pendingExits]);
                            currentSwitch.maxCaseY = Math.max(currentSwitch.maxCaseY, yOffset);
                        }
                        
                        const caseX = currentSwitch.startX + 20 + currentSwitch.caseCount * 270;
                        const caseY = currentSwitch.startY + 50;
                        let caseId = addNode(`Case ${isDefault ? 'default' : caseVal}`, 'CASE_CONTAINER', caseX, { caseVal, isDefault, switchId: currentSwitch.id, parentId: currentSwitch.id, w: 250, h: 150 }, line);
                        
                        yOffset = caseY + 60; // Start inside case container
                        pendingExits = [{ id: caseId, text: "", handle: "s-bottom" }];
                        currentSwitch.currentCaseExits = [];
                        currentSwitch.currentCaseId = caseId;
                        currentSwitch.currentCaseX = caseX + 45;
                        currentSwitch.caseCount++;
                    } else {
                        // Advanced mode: chained CONDITION blocks
                        if (currentSwitch.caseIndex > 0) {
                            currentSwitch.allExits.push(...pendingExits);
                            currentSwitch.maxCaseY = Math.max(currentSwitch.maxCaseY, yOffset);
                        }

                        const caseX = currentSwitch.startX + currentSwitch.caseIndex * 240;
                        currentSwitch.currentCaseX = caseX;
                        yOffset = currentSwitch.startY;

                        if (isDefault) {
                            // Default case: no condition block, fed directly by previous False exit
                            pendingExits = currentSwitch.prevFalseExit ? [currentSwitch.prevFalseExit] : [];
                            currentSwitch.prevFalseExit = null;
                            yOffset += 40;
                        } else {
                            let condText;
                            if (/^(?:==|===|!=|<=|>=|<|>)\s*/.test(caseVal)) {
                                condText = `${currentSwitch.switchVar} ${caseVal}`;
                            } else {
                                condText = `${currentSwitch.switchVar} == ${caseVal}`;
                            }

                            const condId = addNode(condText, 'CONDITION', caseX, {}, line);

                            if (currentSwitch.caseIndex === 0) {
                                currentSwitch.entryExits.forEach(exit => addEdge(exit.id, condId, exit.text, exit.handle, "t-top"));
                            } else if (currentSwitch.prevFalseExit) {
                                addEdge(currentSwitch.prevFalseExit.id, condId, currentSwitch.prevFalseExit.text, currentSwitch.prevFalseExit.handle, "t-top");
                            }

                            const ports = getConditionPorts(condId, false);
                            pendingExits = [{ id: condId, text: ports.tText, handle: ports.tHandle }];
                            currentSwitch.prevFalseExit = { id: condId, text: ports.fText, handle: ports.fHandle };
                        }
                        currentSwitch.caseIndex++;
                    }
                }
            }
            else if (upper === 'ENDSWITCH') {
                const currentSwitch = stack.pop();
                if (currentSwitch.isSimple) {
                    if (currentSwitch.currentCaseExits) {
                        currentSwitch.cases.push([...currentSwitch.currentCaseExits, ...pendingExits]);
                        currentSwitch.maxCaseY = Math.max(currentSwitch.maxCaseY, yOffset);
                    }
                    pendingExits = currentSwitch.cases.flat();
                    yOffset = currentSwitch.maxCaseY + 60; // Padding after switch
                    
                    // Adjust SWITCH_CONTAINER and CASE_CONTAINER sizes
                    const swNode = outNodes.find(n => n.id === currentSwitch.id);
                    if (swNode) {
                        swNode.h = Math.max(230, currentSwitch.maxCaseY - currentSwitch.startY + 60);
                        swNode.w = Math.max(350, 40 + currentSwitch.caseCount * 270);
                    }
                } else {
                    currentSwitch.allExits.push(...pendingExits);
                    currentSwitch.maxCaseY = Math.max(currentSwitch.maxCaseY, yOffset);

                    if (currentSwitch.prevFalseExit) {
                        currentSwitch.allExits.push(currentSwitch.prevFalseExit);
                    }

                    pendingExits = [...currentSwitch.allExits];
                    yOffset = currentSwitch.maxCaseY + 60;
                }
            }
            else if (upper.startsWith('WHILE ') || upper.startsWith('FOR ')) {
                const isFor = upper.startsWith('FOR ');
                let doIndex = upper.lastIndexOf(' DO');
                let condText = isFor ? line.substring(0, doIndex !== -1 ? doIndex : line.length).trim() : line.substring(6, doIndex !== -1 ? doIndex : line.length).trim();

                let forVar = null;
                let forStep = '1';
                let forInit = '';
                let forLimit = '';
                if (isFor) {
                    const forMatch = condText.match(/^FOR\s+([a-zA-Z_]\w*)\s*(?:=|<-)\s*(.*?)\s+TO\s+(.*?)(?:\s+STEP\s+(.*))?$/i);
                    if (forMatch) {
                        forVar = forMatch[1];
                        const initVal = forMatch[2];
                        const toVal = forMatch[3];
                        if (forMatch[4]) forStep = forMatch[4].trim();
                        
                        forInit = `${forVar} = ${initVal}`;
                        forLimit = toVal;
                        
                        if (editorMode !== 'simple') {
                            const initId = addNode(`${forVar} = ${initVal}`, 'ACTION', getXPos(), {}, line);
                            pendingExits.forEach(exit => addEdge(exit.id, initId, exit.text, exit.handle, "t-top"));
                            pendingExits = [{ id: initId, text: "", handle: "s-bottom" }];
                            
                            condText = `${forVar} <= ${toVal}`;
                        }
                    }
                }

                let isNot = false;
                let notMatch = condText.match(/^NOT\s*\((.*)\)$/i);
                if (!notMatch) notMatch = condText.match(/^NOT\s+(.*)$/i);
                if (notMatch) {
                    condText = notMatch[1].trim();
                    isNot = true;
                }

                if (editorMode === 'simple') {
                    yOffset += 60;
                    let matchedLineIdx = null;
                    for (let k = searchStartIdx; k < lines.length; k++) {
                        if (lines[k] === line) {
                            matchedLineIdx = k;
                            break;
                        }
                    }
                    if (matchedLineIdx !== null) {
                        searchStartIdx = matchedLineIdx + 1;
                    }
                    stack.push({ type: 'LOOP', id: getNewId(), matchedLineIdx, isSimple: true, condText: (isFor ? upper : condText), startY: yOffset, entryExits: [...pendingExits], doWhile: false, outNodesStartIndex: outNodes.length, isFor, forVar, forStep, forInit, forLimit });
                } else {
                    const loopId = addNode(condText, 'CONDITION', getXPos(), {}, isFor ? null : line);

                    pendingExits.forEach(exit => addEdge(exit.id, loopId, exit.text, exit.handle, "t-top"));
                    const ports = getConditionPorts(loopId, isNot);
                    stack.push({
                        type: 'LOOP',
                        id: loopId,
                        mergeId: null,
                        isNot,
                        isFor,
                        forVar,
                        forStep,
                        isSimple: false,
                        doWhile: false,
                        condNodeIndex: outNodes.length - 1,
                        bodyStartIndex: outNodes.length
                    });
                    pendingExits = [{ id: loopId, text: ports.tText, handle: ports.tHandle }];
                }
            }
            else if (upper === 'ENDWHILE' || upper === 'ENDFOR') {
                const currentLoop = stack.pop();

                if (currentLoop.isSimple) {
                    const loopBodyNodes = outNodes.slice(currentLoop.outNodesStartIndex);
                    const k = loopBodyNodes.length;
                    if (k > 0 && outNodes.length >= currentLoop.outNodesStartIndex + k) {
                        const preLoopStartIdx = currentLoop.outNodesStartIndex - k;
                        if (preLoopStartIdx >= 0) {
                            const preLoopNodes = outNodes.slice(preLoopStartIdx, currentLoop.outNodesStartIndex);
                            let match = true;
                            for (let i = 0; i < k; i++) {
                                if (preLoopNodes[i].text !== loopBodyNodes[i].text || preLoopNodes[i].type !== loopBodyNodes[i].type) {
                                    match = false;
                                    break;
                                }
                            }
                            if (match) {
                                currentLoop.doWhile = true;
                                const removedNodeIds = new Set(preLoopNodes.map(n => n.id));
                                
                                outEdges.forEach(e => {
                                    if (e.target === preLoopNodes[0].id && !removedNodeIds.has(e.source)) {
                                        e.target = loopBodyNodes[0].id;
                                    }
                                });
                                
                                outEdges = outEdges.filter(e => !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target));
                                outNodes.splice(preLoopStartIdx, k);
                                currentLoop.outNodesStartIndex -= k;
                                
                                // Calculate container top and determine if any downward shift is required
                                // to prevent the container from overlapping the block above it
                                let minBodyY = Infinity, maxBodyY = -Infinity;
                                for (let i = 0; i < k; i++) {
                                    const ny = preLoopNodes[i].y;
                                    const nh = preLoopNodes[i].h || (preLoopNodes[i].type === 'CONDITION' ? 80 : 50);
                                    if (ny < minBodyY) minBodyY = ny;
                                    if (ny + nh > maxBodyY) maxBodyY = ny + nh;
                                }
                                const childContentH = maxBodyY - minBodyY;
                                const estimatedH = Math.max(200, childContentH + 45 + 70);
                                const extraSpace = Math.max(0, estimatedH - (childContentH + 45 + 70));
                                const estimatedContainerY = Math.round(minBodyY - 45 - 35 - extraSpace / 2);

                                const prevNode = preLoopStartIdx > 0 ? outNodes[preLoopStartIdx - 1] : null;
                                const prevBottom = prevNode ? prevNode.y + (prevNode.h || (prevNode.type === 'CONDITION' ? 80 : 50)) : 0;
                                const minAllowedTop = prevNode ? prevBottom + 30 : 40;
                                const shiftAmount = estimatedContainerY < minAllowedTop ? (minAllowedTop - estimatedContainerY) : 0;

                                currentLoop.startY = estimatedContainerY + shiftAmount;

                                for (let i = 0; i < k; i++) {
                                    loopBodyNodes[i].x = preLoopNodes[i].x;
                                    loopBodyNodes[i].y = preLoopNodes[i].y + shiftAmount;
                                    if (preLoopNodes[i].matched) {
                                        loopBodyNodes[i].matched = true;
                                    }
                                }

                                for (let i = preLoopStartIdx + k; i < outNodes.length; i++) {
                                    outNodes[i].y += shiftAmount;
                                }
                            }
                        }
                    }

                    const h = Math.max(150, yOffset - currentLoop.startY + 50);
                    const memPos = getPos(currentLoop.condText, currentLoop.isFor ? 'FOR_CONTAINER' : 'LOOP_CONTAINER', getXPos() - 90, currentLoop.startY - 50);
                    const id = (memPos.matched && !memPos.isFromCond && memPos.oldId) ? memPos.oldId : currentLoop.id;
                    if (currentLoop.matchedLineIdx !== null) {
                        nodeLineMap[id] = currentLoop.matchedLineIdx;
                        if (id !== currentLoop.id) {
                            nodeLineMap[currentLoop.id] = currentLoop.matchedLineIdx;
                        }
                    }

                    const currentLoopBodyNodes = outNodes.slice(currentLoop.outNodesStartIndex);
                    let containerX = memPos.x;
                    let containerY = memPos.y;
                    let containerW = Math.max(350, memPos.w || 350);
                    let containerH = Math.max(200, memPos.h || h);

                    if (currentLoopBodyNodes.length > 0) {
                        let minX = Infinity, maxX = -Infinity;
                        let minY = Infinity, maxY = -Infinity;
                        currentLoopBodyNodes.forEach(n => {
                            const nw = n.w || (n.type === 'CONDITION' ? 160 : (n.type === 'START_END' ? 180 : 160));
                            const nh = n.h || (n.type === 'CONDITION' ? 80 : 50);
                            if (n.x < minX) minX = n.x;
                            if (n.x + nw > maxX) maxX = n.x + nw;
                            if (n.y < minY) minY = n.y;
                            if (n.y + nh > maxY) maxY = n.y + nh;
                        });

                        if (!memPos.matched || memPos.isFromCond) {
                            const childCenterX = (minX + maxX) / 2;
                            containerW = Math.max(350, (maxX - minX) + 80);
                            containerX = childCenterX - containerW / 2;

                            const pad = 35;
                            const childContentH = maxY - minY;
                            containerH = Math.max(200, childContentH + 45 + pad * 2);
                            const extraSpace = Math.max(0, containerH - (childContentH + 45 + pad * 2));
                            containerY = Math.round(minY - 45 - pad - extraSpace / 2);
                        } else {
                            if (minX < containerX + 20) containerX = minX - 40;
                            if (maxX > containerX + containerW - 20) containerW = (maxX - containerX) + 40;
                            containerW = Math.max(350, containerW);

                            const pad = 35;
                            const childContentH = maxY - minY;
                            if (minY < containerY + 45 + 10 || maxY > containerY + containerH - 20) {
                                containerH = Math.max(containerH, childContentH + 45 + pad * 2);
                                if (minY < containerY + 45 + 10) {
                                    containerY = minY - 45 - pad;
                                }
                            }
                        }

                        // Prevent container from overlapping previous node above it
                        const prevNode = currentLoop.outNodesStartIndex > 0 ? outNodes[currentLoop.outNodesStartIndex - 1] : null;
                        const prevBottom = prevNode ? prevNode.y + (prevNode.h || (prevNode.type === 'CONDITION' ? 80 : (prevNode.type === 'START_END' ? 50 : 50))) : 0;
                        const minAllowedTop = prevNode ? prevBottom + 35 : 40;
                        if (containerY < minAllowedTop) {
                            const shiftAmount = minAllowedTop - containerY;
                            containerY += shiftAmount;
                            currentLoopBodyNodes.forEach(n => {
                                n.y += shiftAmount;
                            });
                        }

                        containerH = Math.max(200, containerH);
                    }

                    outNodes.push({ id, text: currentLoop.condText, type: currentLoop.isFor ? 'FOR_CONTAINER' : 'LOOP_CONTAINER', x: containerX, y: containerY, w: containerW, h: containerH, doWhile: currentLoop.doWhile, forInit: currentLoop.forInit, forLimit: currentLoop.forLimit, forStep: currentLoop.forStep });
                    // pendingExits just flows sequentially to the next block, no back edges.
                    yOffset = Math.max(yOffset + 50, containerY + containerH + 30);
                } else if (currentLoop.isFor && currentLoop.forVar) {
                    const incId = addNode(`${currentLoop.forVar} = ${currentLoop.forVar} + ${currentLoop.forStep}`, 'ACTION', getXPos(), {}, line);
                    pendingExits.forEach(exit => {
                        let returnHandle = exit.id === currentLoop.id ? getConditionPorts(currentLoop.id, currentLoop.isNot).tHandle : exit.handle;
                        addEdge(exit.id, incId, exit.text, returnHandle, "t-top");
                    });
                    addEdge(incId, currentLoop.id, "", "s-bottom", "t-top");
                    const ports = getConditionPorts(currentLoop.id, currentLoop.isNot);
                    pendingExits = [{ id: currentLoop.id, text: ports.fText, handle: ports.fHandle }];
                } else {
                    const loopBodyNodes = outNodes.slice(currentLoop.bodyStartIndex);
                    const k = loopBodyNodes.length;
                    const condIdx = currentLoop.condNodeIndex;
                    let isDoWhile = false;

                    if (!currentLoop.isFor && k > 0 && condIdx >= k) {
                        const preLoopStartIdx = condIdx - k;
                        const preLoopNodes = outNodes.slice(preLoopStartIdx, condIdx);
                        let match = true;
                        for (let i = 0; i < k; i++) {
                            if (preLoopNodes[i].text !== loopBodyNodes[i].text || preLoopNodes[i].type !== loopBodyNodes[i].type) {
                                match = false;
                                break;
                            }
                        }
                        if (match) {
                            isDoWhile = true;
                            const removedNodeIds = new Set(loopBodyNodes.map(n => n.id));

                            // Remove duplicate loopBodyNodes
                            outNodes.splice(currentLoop.bodyStartIndex, k);

                            // Remove edges involving duplicate body nodes
                            outEdges = outEdges.filter(e => !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target));

                            // Shift preLoopNodes up if there is an excessive gap created by removing a container
                            const prevNode = preLoopStartIdx > 0 ? outNodes[preLoopStartIdx - 1] : null;
                            if (prevNode) {
                                const prevH = prevNode.type === 'CONDITION' ? (prevNode.h || 80) : (prevNode.h || 50);
                                const prevBottom = prevNode.y + prevH;
                                if (preLoopNodes[0].y > prevBottom + 40) {
                                    const shift = preLoopNodes[0].y - (prevBottom + 30);
                                    for (let i = 0; i < k; i++) {
                                        preLoopNodes[i].y -= shift;
                                    }
                                }
                            }

                            // Position the CONDITION node cleanly below the last body node
                            const lastBodyNode = preLoopNodes[k - 1];
                            const lastBodyH = lastBodyNode.h || 50;
                            const condNode = outNodes.find(n => n.id === currentLoop.id);
                            if (condNode) {
                                condNode.x = lastBodyNode.x;
                                condNode.y = lastBodyNode.y + lastBodyH + 40;
                                condNode.w = condNode.w && condNode.w <= 160 ? condNode.w : 160;
                                condNode.h = condNode.h && condNode.h <= 80 ? condNode.h : 80;
                                condNode.isSwapped = !currentLoop.isNot;
                                yOffset = condNode.y + condNode.h + 30;
                            }

                            // Wire condition edges:
                            // In DO-WHILE advanced mode, the loopback edge leaves from s-right and the exit edge leaves from s-bottom.
                            // With isSwapped = !currentLoop.isNot, s-right matches True ('T') and s-bottom matches False ('F').
                            const isSwapped = condNode ? condNode.isSwapped : !currentLoop.isNot;
                            const loopbackText = isSwapped ? EL.t : EL.f;
                            const exitText = isSwapped ? EL.f : EL.t;

                            addEdge(currentLoop.id, preLoopNodes[0].id, loopbackText, "s-right", "t-top");
                            pendingExits = [{ id: currentLoop.id, text: exitText, handle: "s-bottom" }];
                        }
                    }

                    if (!isDoWhile) {
                        const ports = getConditionPorts(currentLoop.id, currentLoop.isNot);
                        let trueTargetHandle = "t-top";
                        if (currentLoop.mergeId) trueTargetHandle = "t-top"; 

                        pendingExits.forEach(exit => {
                            let returnHandle = exit.id === currentLoop.id ? ports.tHandle : exit.handle;
                            addEdge(exit.id, currentLoop.mergeId || currentLoop.id, exit.text, returnHandle, trueTargetHandle);
                        });
                        pendingExits = [{ id: currentLoop.id, text: ports.fText, handle: ports.fHandle }];
                    }
                }
            }
            else {
                let isIo = false;
                let text = line;
                let ioType = 'input'; 

                if (upper.startsWith('PRINT')) {
                    isIo = true;
                    ioType = 'output';
                    let inner = line.replace(/^PRINT\s*\(/i, '').replace(/\)$/, '').trim();
                    if (upper.startsWith('PRINT ') && !upper.includes('(')) {
                        inner = line.replace(/^PRINT\s+/i, '').trim();
                    }
                    text = inner;
                }
                else if (upper.includes('= INPUT()') || upper.includes('=INPUT()')) {
                    isIo = true;
                    ioType = 'input';
                    text = line.replace(/\s*=\s*INPUT\(\)/i, '').trim();
                }
                else if (upper.startsWith('VSTUP') || upper.startsWith('INPUT')) { 
                    isIo = true;
                    ioType = 'input';
                    let inner = line.replace(/^(?:VSTUP|INPUT)\s*\(/i, '').replace(/\)$/, '').trim();
                    if (upper.startsWith('VSTUP ') || upper.startsWith('INPUT ')) {
                        inner = line.replace(/^(?:VSTUP|INPUT)\s+/i, '').trim();
                    }
                    text = inner || 'Vstup';
                }
                else if (upper.startsWith('RETURN')) {
                    isIo = false;
                    text = line;
                }
                else {
                    if (text.endsWith('()')) {
                        text = text.substring(0, text.length - 2).trim();
                    } else if (!text.includes('=') && !text.includes('(')) {
                        isIo = true;
                        ioType = 'input';
                        errors.push({ line: i + 1, message: `Očekáváno přiřazení (např. '='). Bude zpracováno jako VSTUP pro potřeby debuggeru.` });
                    }
                }

                let xPos = getXPos();
                let nodeProps = isIo ? { ioType } : {};
                const nodeId = addNode(text, isIo ? 'IO' : 'ACTION', xPos, nodeProps, line);

                pendingExits.forEach(exit => addEdge(exit.id, nodeId, exit.text, exit.handle, "t-top"));
                pendingExits = [{ id: nodeId, text: "", handle: "s-bottom" }];
            }
        }

        while (stack.length > 0) {
            const currentItem = stack.pop();
            const typeStr = currentItem.type === 'IF' ? 'ENDIF' : currentItem.type === 'LOOP' ? (currentItem.isFor ? 'ENDFOR' : 'ENDWHILE') : 'END';
            errors.push({ line: lines.length, message: `Chybí uzavření bloku (${typeStr}) před koncem funkce.` });
            
            if (currentItem.type === 'IF') {
                if (!currentItem.trueExits) {
                    currentItem.trueExits = [{ id: currentItem.id, text: getConditionPorts(currentItem.id, currentItem.isNot).fText, handle: getConditionPorts(currentItem.id, currentItem.isNot).fHandle }];
                }
                pendingExits = [...currentItem.trueExits, ...pendingExits];
            } else if (currentItem.type === 'LOOP') {
                pendingExits.forEach(exit => {
                    let returnHandle = exit.id === currentItem.id ? getConditionPorts(currentItem.id, currentItem.isNot).tHandle : exit.handle;
                    addEdge(exit.id, currentItem.id, exit.text, returnHandle, "t-top");
                });
                pendingExits = [{ id: currentItem.id, text: getConditionPorts(currentItem.id, currentItem.isNot).fText, handle: getConditionPorts(currentItem.id, currentItem.isNot).fHandle }];
            }
        }

        if (hasEnd && spawnStartEnd) {
            const endId = addNode(endLineText, 'START_END', startPos.x, { mode: 'end' }, originalEndLine);
            pendingExits.forEach(exit => addEdge(exit.id, endId, exit.text, exit.handle, "t-top"));
            pendingExits = [];
        } else if (!spawnStartEnd) {
            pendingExits = [];
        }

        const currentFragmentNodes = outNodes.slice(blockStartIndex);
        const previousNodes = outNodes.slice(0, blockStartIndex);

        const hardcodedMargin = 60;
        if (previousNodes.length > 0 && currentFragmentNodes.length > 0) {
            const hasOverlap = currentFragmentNodes.some(curr =>
                previousNodes.some(prev => checkOverlap(curr, prev))
            );

            if (hasOverlap) {
                const maxPrevRight = Math.max(...previousNodes.map(n => getNodeBounds(n).right));
                const minCurrLeft = Math.min(...currentFragmentNodes.map(n => getNodeBounds(n).left));
                const targetLeft = maxPrevRight + hardcodedMargin;
                const shiftX = targetLeft - minCurrLeft;
                if (shiftX > 0) {
                    currentFragmentNodes.forEach(n => {
                        n.x += shiftX;
                    });
                }
            }
        }

        const currentMaxRight = currentFragmentNodes.length > 0
            ? Math.max(...currentFragmentNodes.map(n => getNodeBounds(n).right))
            : globalGroupX;
        const currentMaxBottom = currentFragmentNodes.length > 0
            ? Math.max(...currentFragmentNodes.map(n => getNodeBounds(n).bottom))
            : yOffset;
        globalGroupX = Math.max(globalGroupX, currentMaxRight + hardcodedMargin);
        lastBlockMaxY = Math.max(lastBlockMaxY, currentMaxBottom, yOffset);
    });

    let xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">\n  <root>\n    <mxCell id="0" />\n    <mxCell id="1" parent="0" />\n`;


    outNodes.forEach(n => {
        let w = n.w || (n.type === 'CONDITION' ? 160 : (n.type === 'START_END' ? 180 : 160));
        let h = n.h || (n.type === 'CONDITION' ? 80 : 50);
        if (n.type === 'COMMENT') { w = n.w || 160; h = n.h || 50; }
        if (n.type === 'MERGE') { w = 10; h = 10; }

        let style = STYLES[n.type] || n.type;
        if (n.mode) style += `mode=${n.mode};`;
        if (n.entityType) style += `entityType=${n.entityType};`;
        if (n.ioType) style += `ioType=${n.ioType};`; 
        if (n.isSwapped !== undefined) style += `isSwapped=${n.isSwapped};`; 
        if (n.type === 'FOR_CONTAINER') {
            style += `forInit=${encodeURIComponent(n.forInit || 'i = 0')};forLimit=${encodeURIComponent(n.forLimit || '10')};forStep=${encodeURIComponent(n.forStep || '1')};`;
        }

        let extraAttrs = "";
        if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') {
            extraAttrs = ` type="${n.type}" doWhile="${n.doWhile ? 'true' : 'false'}"`;
            if (n.type === 'FOR_CONTAINER') {
                extraAttrs += ` forInit="${encodeURIComponent(n.forInit || '')}" forLimit="${encodeURIComponent(n.forLimit || '')}" forStep="${encodeURIComponent(n.forStep || '1')}"`;
            }
            if (n.type === 'SWITCH_CONTAINER') {
                extraAttrs += ` switchVar="${encodeURIComponent(n.switchVar || '')}"`;
            }
            if (n.type === 'CASE_CONTAINER') {
                extraAttrs += ` caseVal="${encodeURIComponent(n.caseVal || '')}" isDefault="${n.isDefault ? 'true' : 'false'}"`;
            }
        }

        let relX = n.x;
        let relY = n.y;
        if (n.parentId && n.parentId !== '1') {
            const parentNode = outNodes.find(p => p.id === n.parentId);
            if (parentNode) {
                relX -= parentNode.x;
                relY -= parentNode.y;
            }
        }

        const safeText = (n.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        xml += `    <mxCell id="${n.id}" value="${safeText}" style="${style}"${extraAttrs} vertex="1" parent="${n.parentId || '1'}">\n`;
        xml += `      <mxGeometry x="${relX}" y="${relY}" width="${w}" height="${h}" as="geometry" />\n`;
        xml += `    </mxCell>\n`;
    });

    outEdges.forEach(e => {
        let style = STYLES.EDGE + `sourceHandle=${e.sourceHandle};targetHandle=${e.targetHandle};`;
        const srcNode = outNodes.find(n => n.id === e.source);
        if (srcNode && srcNode.type === 'CONDITION') {
            style += 'isCondition=true;';
        }

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
    
    return { xml, nodeLineMap, errors };
};