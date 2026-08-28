export class DiagramRunner {
    constructor(nodes, edges) {
        this.nodes = nodes;
        this.edges = edges;
        this.variables = {};
        this.loopStates = {};
        this.output = [];
        this.events = [];
        this.isFinished = false;

        // Precompute LOOP_CONTAINER regions
        this.loopContainers = this.nodes.filter(n => n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER');
        this.nodeToLoop = {};
        this.nodes.forEach(n => {
            if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'GROUP_BG') return;
            const nx = n.position?.x || n.x || 0;
            const ny = n.position?.y || n.y || 0;
            let innermost = null, minArea = Infinity;
            this.loopContainers.forEach(l => {
                const lx = l.position?.x || l.x || 0;
                const ly = l.position?.y || l.y || 0;
                const lw = l.width || l.style?.width || 300;
                const lh = l.height || l.style?.height || 150;
                if (nx >= lx && nx <= lx + lw && ny >= ly && ny <= ly + lh) {
                    const area = lw * lh;
                    if (area < minArea) { minArea = area; innermost = l; }
                }
            });
            if (innermost) this.nodeToLoop[n.id] = innermost;
        });

        this.loopExits = {};
        this.loopEntries = {};
        this.edges.forEach(e => {
            const srcLoop = this.nodeToLoop[e.source];
            const tgtLoop = this.nodeToLoop[e.target];
            if (srcLoop && (!tgtLoop || tgtLoop.id !== srcLoop.id)) {
                this.loopExits[srcLoop.id] = e.target;
            }
            if (tgtLoop && (!srcLoop || srcLoop.id !== tgtLoop.id)) {
                this.loopEntries[tgtLoop.id] = e.target;
            }
            
            // Check direct connections to container handles
            const isSrcContainer = this.loopContainers.some(l => l.id === e.source);
            if (isSrcContainer) {
                this.loopExits[e.source] = e.target;
            }
            
            const isTgtContainer = this.loopContainers.some(l => l.id === e.target);
            if (isTgtContainer) {
                // If targeting the container, we need to find the top-most node inside it as entry
                const nodesInside = Object.keys(this.nodeToLoop).filter(id => this.nodeToLoop[id].id === e.target);
                const entryNode = nodesInside.sort((a, b) => {
                    const na = this.nodes.find(n => n.id === a);
                    const nb = this.nodes.find(n => n.id === b);
                    return (na?.position?.y || 0) - (nb?.position?.y || 0);
                })[0];
                if (entryNode) this.loopEntries[e.target] = entryNode;
            }
        });

        let startNode = this.nodes.find(n => n.type === 'START_END' && n.data?.mode === 'start');
        if (!startNode) {
            startNode = this.nodes.find(n => n.type === 'START_END' && !this.edges.some(e => e.target === n.id)) || this.nodes.find(n => n.type === 'START_END');
        }
        
        this.currentNodeId = startNode ? startNode.id : null;
        if (!this.currentNodeId) this.isFinished = true;
    }

    cleanText(html) {
        if (!html) return '';
        let t = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n');
        t = t.replace(/<\/?(?:b|i|u|span|font|div|p|strong|em|strike|s|sub|sup|h[1-6])(?:\s+[^>]*?)?>/gi, ""); 
        t = t.replace(/&nbsp;/gi, ' ').replace(/&gt;/gi, '>').replace(/&lt;/gi, '<').replace(/&amp;/gi, '&').replace(/\u00A0/g, ' ');
        return t.trim();
    }

    getScopeForExpr(jsExpr) {
        const idRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
        const reserved = new Set([
            'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
            'Math', 'Number', 'String', 'Boolean', 'Array', 'Object', 'Date', 'RegExp',
            'parseInt', 'parseFloat', 'isNaN', 'isFinite',
            'typeof', 'instanceof', 'in', 'void', 'delete', 'new',
            'if', 'else', 'return', 'var', 'let', 'const', 'function', 'this',
            'case', 'switch', 'break', 'continue', 'default', 'for', 'while', 'do',
            'try', 'catch', 'finally', 'throw', 'class', 'extends', 'super', 'import', 'export'
        ]);

        const ids = new Set();
        let match;
        while ((match = idRegex.exec(jsExpr)) !== null) {
            const id = match[0];
            if (!reserved.has(id)) {
                ids.add(id);
            }
        }

        // Check if string context exists (presence of string literals or known string variables)
        const hasStringLiteral = /(["'`])(?:\\.|[^\\])*?\1/.test(jsExpr);
        let hasStringVariable = false;
        ids.forEach(id => {
            if (id in this.variables && typeof this.variables[id] === 'string') {
                hasStringVariable = true;
            }
        });

        const isStringContext = hasStringLiteral || hasStringVariable;

        const scope = {};
        ids.forEach(id => {
            if (id in this.variables && this.variables[id] !== undefined && this.variables[id] !== null) {
                scope[id] = this.variables[id];
            } else {
                // When nothing is inserted into a variable, default to 0 for numbers and "" for strings
                scope[id] = isStringContext ? "" : 0;
            }
        });

        return scope;
    }

    evalExpr(expr) {
        try {
            let jsExpr = expr
                .replace(/\bAND\b/gi, '&&')
                .replace(/\bOR\b/gi, '||')
                .replace(/\bNOT\b/gi, '!')
                .replace(/\bTrue\b/g, 'true')
                .replace(/\bFalse\b/g, 'false')
                .replace(/\bNone\b/g, 'null');
            jsExpr = jsExpr.replace(/(?<![<>=!])=(?!=)/g, '==');
            
            const scope = this.getScopeForExpr(jsExpr);
            const keys = Object.keys(scope);
            const values = Object.values(scope);
            const fn = new Function(...keys, `return ${jsExpr};`);
            return fn(...values);
        } catch (err) {
            console.error("Eval error pro:", expr, err);
            return undefined;
        }
    }

    step(inputValue = undefined) {
        if (this.isFinished || !this.currentNodeId) return { finished: true, variables: this.variables, output: this.output };

        const node = this.nodes.find(n => n.id === this.currentNodeId);
        if (!node) { this.isFinished = true; return { finished: true, variables: this.variables, output: this.output }; }

        let nextNodeId = null;
        const outEdges = this.edges.filter(e => e.source === node.id);

        if (node.type === 'START_END') {
            if (node.data?.mode === 'end' || this.cleanText(node.data?.label).toUpperCase().includes('END')) this.isFinished = true;
            else if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        } 
        else if (node.type === 'ACTION') {
            const lines = this.cleanText(node.data?.label || '').split('\n');
            lines.forEach(line => {
                let text = line.trim();
                if (!text) return;
                
                const assignMatch = text.match(/^(?:SET\s+)?([a-zA-Z_]\w*)\s*(?:=|:=|<-)\s*(.*)$/i);
                if (assignMatch) {
                    const varName = assignMatch[1].trim();
                    const expr = assignMatch[2].trim();
                    const val = this.evalExpr(expr);
                    if (val !== undefined) this.variables[varName] = val;
                } else if (text.includes('=')) {
                    const [left, ...rightParts] = text.split('=');
                    const varName = left.trim();
                    const expr = rightParts.join('=').trim();
                    const val = this.evalExpr(expr);
                    if (val !== undefined) this.variables[varName] = val;
                } else if (text.toUpperCase().startsWith('PRINT')) {
                    let inner = text.substring(5).trim();
                    if(inner.startsWith('(') && inner.endsWith(')')) inner = inner.substring(1, inner.length-1);
                    const val = this.evalExpr(inner);
                    const outStr = val !== undefined ? String(val) : inner;
                    this.output.push(outStr);
                    this.events.push({ type: 'output', msg: outStr });
                } else if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
                    const inner = text.slice(1, -1);
                    this.output.push(inner);
                    this.events.push({ type: 'output', msg: inner });
                }
            });
            if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        } 
        else if (node.type === 'IO') {
            let text = this.cleanText(node.data?.label || '').trim();
            const ioType = node.data?.ioType || 'input';

            if (ioType === 'output' || text.toUpperCase().startsWith('PRINT')) {
                let inner = text.toUpperCase().startsWith('PRINT') ? text.substring(5).trim() : text;
                if(inner.startsWith('(')) inner = inner.substring(1, inner.length-1);
                const val = this.evalExpr(inner);
                const outStr = val !== undefined ? String(val) : inner;
                this.output.push(outStr);
                this.events.push({ type: 'output', msg: outStr });
                if (outEdges.length > 0) nextNodeId = outEdges[0].target;
            } 
            else if (text.includes('=') || text.includes('<-') || text.includes(':=')) {
                const assignMatch = text.match(/^(?:SET\s+)?([a-zA-Z_]\w*)\s*(?:=|:=|<-)\s*(.*)$/i);
                const varName = assignMatch ? assignMatch[1].trim() : text.split('=')[0].trim();
                const expr = assignMatch ? assignMatch[2].trim() : text.split('=').slice(1).join('=').trim();
                const val = this.evalExpr(expr);
                if (val !== undefined) this.variables[varName] = val;
                if (outEdges.length > 0) nextNodeId = outEdges[0].target;
            } 
            else {
                const varName = text.replace(/^VSTUP\s+/i, '').trim() || 'x';
                
                if (inputValue === undefined) {
                    // Fallback pre testovaci knihovnu
                    // eslint-disable-next-line no-undef
                    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
                        let input = window.prompt(`Zadejte hodnotu pro proměnnou '${varName}':`, "0");
                        let parsed = parseFloat(input);
                        this.variables[varName] = isNaN(parsed) ? input : parsed;
                        if (outEdges.length > 0) nextNodeId = outEdges[0].target;
                    } else {
                        return {
                            variables: { ...this.variables },
                            output: [...this.output],
                            events: [...this.events],
                            currentNodeId: this.currentNodeId,
                            nextNodeId: this.currentNodeId,
                            finished: false,
                            requiresInput: true,
                            variableName: varName
                        };
                    }
                } else {
                    let parsed = parseFloat(inputValue);
                    this.variables[varName] = isNaN(parsed) ? inputValue : parsed;
                    if (outEdges.length > 0) nextNodeId = outEdges[0].target;
                }
            }
        } 
        else if (node.type === 'CONDITION') {
            const cond = this.cleanText(node.data?.label || '');
            const isTrue = !!this.evalExpr(cond);

            const trueEdge = outEdges.find(e => ['ano', 'yes', 'true', '1', 'y', '+'].includes(this.cleanText(e.data?.label || '').toLowerCase())) || outEdges[0];
            const falseEdge = outEdges.find(e => ['ne', 'no', 'false', '0', 'n', '-'].includes(this.cleanText(e.data?.label || '').toLowerCase())) || outEdges[1];

            const selectedEdge = isTrue ? trueEdge : falseEdge;
            if (selectedEdge) nextNodeId = selectedEdge.target;
            else this.isFinished = true;
        }
        else if (node.type === 'COMMENT' || node.type === 'MERGE' || node.type === 'GROUP_BG') {
            if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        }
        else if (node.type === 'SWITCH_CONTAINER') {
            const switchVar = this.cleanText(node.data?.switchVar || 'x');
            const switchVal = this.evalExpr(switchVar);
            
            const cases = this.nodes.filter(n => n.type === 'CASE_CONTAINER' && n.data?.switchId === node.id);
            let targetCase = cases.find(c => !c.data?.isDefault && String(this.evalExpr(this.cleanText(c.data?.caseVal || '1'))) === String(switchVal));
            if (!targetCase) targetCase = cases.find(c => c.data?.isDefault);
            
            if (targetCase) {
                const caseEdge = this.edges.find(e => e.source === targetCase.id);
                if (caseEdge) nextNodeId = caseEdge.target;
                else if (outEdges.length > 0) nextNodeId = outEdges[0].target;
            } else {
                if (outEdges.length > 0) nextNodeId = outEdges[0].target;
            }
        }

        const currentLoop = this.nodeToLoop[this.currentNodeId];
        
        // --- LOOP_CONTAINER: Routing out of the loop ---
        // If the edge points outside the loop, we reached the end of the loop body!
        // We must redirect back to the START of the loop instead of exiting (if it's a loop)
        if (currentLoop && nextNodeId) {
            const nextLoop = this.nodeToLoop[nextNodeId];
            if (!nextLoop || nextLoop.id !== currentLoop.id) {
                // We are trying to exit the loop. 
                // Instead of exiting, we loop back to the first node!
                if (this.loopEntries[currentLoop.id]) {
                    nextNodeId = this.loopEntries[currentLoop.id];
                }
            }
        }

        // --- LOOP_CONTAINER: Redirect direct targets ---
        // If an edge targets the loop container itself, redirect to its entry node
        if (nextNodeId && this.loopContainers.some(l => l.id === nextNodeId)) {
            if (this.loopEntries[nextNodeId]) {
                nextNodeId = this.loopEntries[nextNodeId];
            } else {
                // If the loop has no entry, it's empty, we should just exit it
                nextNodeId = this.loopExits[nextNodeId] || null;
            }
        }

        // --- LOOP_CONTAINER: Condition Check on Entry ---
        // Before we execute the nextNodeId, if it's the START of a loop, we evaluate the condition!
        let finalNextId = nextNodeId;
        if (finalNextId) {
            const tgtLoop = this.nodeToLoop[finalNextId];
            // If the next node is in a loop, and it's the entry node of that loop
            if (tgtLoop && finalNextId === this.loopEntries[tgtLoop.id]) {
                const isDoWhile = tgtLoop.data?.doWhile === true;
                
                // For DO-WHILE loops, we only evaluate the condition if we are looping BACK, 
                // not on the first entry.
                const isLoopBack = currentLoop && currentLoop.id === tgtLoop.id;
                
                if (!isDoWhile || isLoopBack) {
                    const cond = this.cleanText(tgtLoop.data?.label || '');
                    let isTrue = false;
                    
                    const forMatch = cond.match(/^FOR\s+([a-zA-Z_]\w*)\s*(?:=|<-)\s*(.*?)\s+TO\s+(.*)$/i);
                    if (tgtLoop.type === 'FOR_CONTAINER') {
                        const initStr = tgtLoop.data?.forInit || '';
                        const limitStr = tgtLoop.data?.forLimit || '';
                        const stepStr = tgtLoop.data?.forStep || '1';
                        
                        const initMatch = initStr.match(/([a-zA-Z_]\w*)\s*(?:=|<-)\s*(.*)/);
                        const varName = initMatch ? initMatch[1] : 'i';
                        const initValExpr = initMatch ? initMatch[2] : initStr;
                        
                        if (!isLoopBack || !this.loopStates[tgtLoop.id]) {
                            const startVal = Number(this.evalExpr(initValExpr));
                            const endVal = Number(this.evalExpr(limitStr));
                            const stepVal = Number(this.evalExpr(stepStr));
                            this.variables[varName] = startVal;
                            this.loopStates[tgtLoop.id] = { endVal, varName, step: stepVal };
                            isTrue = stepVal > 0 ? (startVal <= endVal) : (startVal >= endVal);
                        } else {
                            const state = this.loopStates[tgtLoop.id];
                            this.variables[state.varName] += state.step;
                            isTrue = state.step > 0 ? (this.variables[state.varName] <= state.endVal) : (this.variables[state.varName] >= state.endVal);
                        }
                    } else if (forMatch) {
                        const varName = forMatch[1];
                        if (!isLoopBack || !this.loopStates[tgtLoop.id]) {
                            const startVal = Number(this.evalExpr(forMatch[2]));
                            const endVal = Number(this.evalExpr(forMatch[3]));
                            this.variables[varName] = startVal;
                            this.loopStates[tgtLoop.id] = { endVal, varName, step: 1 };
                            isTrue = startVal <= endVal;
                        } else {
                            const state = this.loopStates[tgtLoop.id];
                            this.variables[state.varName] += state.step;
                            isTrue = this.variables[state.varName] <= state.endVal;
                        }
                    } else {
                        isTrue = !!this.evalExpr(cond);
                    }
                    
                    if (!isTrue) {
                        // Format current variables state for insight
                        const varsState = Object.entries(this.variables).map(([k, v]) => `${k}=${v}`).join(', ');
                        const varsMsg = varsState ? ` [${varsState}]` : '';
                        this.events.push({ 
                            type: 'insight', 
                            msg: `Konec cyklu: '${cond}' je nepravdivá${varsMsg}` 
                        });
                        // Condition is false, exit the loop!
                        finalNextId = this.loopExits[tgtLoop.id] || null;
                    }
                }
            }
        }

        const prevNodeId = this.currentNodeId;
        this.currentNodeId = finalNextId;
        if (!this.currentNodeId) this.isFinished = true;

        return {
            variables: { ...this.variables },
            output: [...this.output],
            events: [...this.events],
            currentNodeId: prevNodeId,
            nextNodeId: this.currentNodeId,
            finished: this.isFinished
        };
    }
}