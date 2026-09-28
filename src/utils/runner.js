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

        this.callStack = [];
        this.lastReturnValue = undefined;

        let startNode = this.nodes.find(n => n.type === 'START_END' && n.data?.mode === 'start' && /^main(\(\))?$/i.test(this.cleanText(n.data?.label || '')));
        if (!startNode) {
            startNode = this.nodes.find(n => n.type === 'START_END' && n.data?.mode === 'start' && !this.edges.some(e => e.target === n.id));
        }
        if (!startNode) {
            startNode = this.nodes.find(n => n.type === 'START_END' && n.data?.mode === 'start');
        }
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
            if (node.data?.mode === 'end' || this.cleanText(node.data?.label).toUpperCase().includes('END')) {
                if (this.callStack.length > 0) {
                    const frame = this.callStack.pop();
                    if (frame.assignVar) {
                        let retVal = this.lastReturnValue;
                        if (retVal === undefined && frame.funcName && this.variables[frame.funcName] !== undefined) {
                            retVal = this.variables[frame.funcName];
                        } else if (retVal === undefined && this.variables['result'] !== undefined) {
                            retVal = this.variables['result'];
                        }
                        if (retVal !== undefined) {
                            this.variables[frame.assignVar] = retVal;
                        }
                    }
                    this.events.push({
                        type: 'insight',
                        msg: `Návrat z funkce '${frame.funcName}' zpět do volajícího bloku`
                    });
                    nextNodeId = frame.returnNodeId;
                    if (!nextNodeId) this.isFinished = true;
                } else {
                    this.isFinished = true;
                }
            } else if (outEdges.length > 0) {
                nextNodeId = outEdges[0].target;
            }
        } 
        else if (node.type === 'ACTION') {
            const lines = this.cleanText(node.data?.label || '').split('\n');
            let jumped = false;

            // Map defined functions in the diagram
            const funcMap = new Map();
            this.nodes.forEach(n => {
                if (n.type === 'START_END' && n.data?.mode === 'start') {
                    const rawLabel = this.cleanText(n.data?.label || '').trim();
                    const m = rawLabel.match(/^(?:FUNCTION\s+)?([a-zA-Z_]\w*)\s*(?:\((.*?)\))?$/i);
                    if (m) {
                        const fName = m[1].toLowerCase();
                        const params = m[2] ? m[2].split(',').map(p => p.trim()).filter(Boolean) : [];
                        funcMap.set(fName, { node: n, name: m[1], params });
                    }
                }
            });

            for (const line of lines) {
                let text = line.trim();
                if (!text) continue;

                // Check for RETURN
                const returnMatch = text.match(/^RETURN(?:\s+(.*))?$/i);
                if (returnMatch) {
                    const expr = returnMatch[1]?.trim();
                    if (expr) {
                        this.lastReturnValue = this.evalExpr(expr);
                    }
                    if (this.callStack.length > 0) {
                        const frame = this.callStack.pop();
                        if (frame.assignVar && this.lastReturnValue !== undefined) {
                            this.variables[frame.assignVar] = this.lastReturnValue;
                        }
                        this.events.push({
                            type: 'insight',
                            msg: `Návrat z funkce '${frame.funcName}' zpět do volajícího bloku`
                        });
                        nextNodeId = frame.returnNodeId;
                        if (!nextNodeId) this.isFinished = true;
                        jumped = true;
                        break;
                    }
                }

                // Check for function call: e.g. foo(), call foo(), x = foo(), x = foo(a, b), or foo
                const callMatch = text.match(/^(?:(?:SET\s+)?([a-zA-Z_]\w*)\s*(?:=|:=|<-)\s*)?(?:call\s+)?([a-zA-Z_]\w*)\s*(?:\((.*?)\))?;?$/i);
                if (callMatch) {
                    const assignVar = callMatch[1] ? callMatch[1].trim() : null;
                    const funcTargetName = callMatch[2].trim();
                    const hasParens = callMatch[3] !== undefined;
                    const argsStr = hasParens ? callMatch[3].trim() : null;

                    const targetFunc = funcMap.get(funcTargetName.toLowerCase());
                    const isKnownVar = funcTargetName in this.variables;
                    const isExplicitCall = text.toLowerCase().startsWith('call ') || hasParens;
                    const isFuncCall = targetFunc && (isExplicitCall || !isKnownVar || (targetFunc.node.id !== node.id && !assignVar));

                    if (isFuncCall && targetFunc.node.id !== this.currentNodeId) {
                        if (argsStr && targetFunc.params.length > 0) {
                            const argExprs = argsStr.split(',').map(a => a.trim()).filter(Boolean);
                            argExprs.forEach((argExpr, idx) => {
                                if (idx < targetFunc.params.length) {
                                    const val = this.evalExpr(argExpr);
                                    if (val !== undefined) {
                                        this.variables[targetFunc.params[idx]] = val;
                                    }
                                }
                            });
                        }
                        this.callStack.push({
                            callerId: node.id,
                            returnNodeId: outEdges.length > 0 ? outEdges[0].target : null,
                            assignVar,
                            funcName: targetFunc.name
                        });
                        this.events.push({
                            type: 'insight',
                            msg: `Volání funkce '${targetFunc.name}'`
                        });
                        nextNodeId = targetFunc.node.id;
                        jumped = true;
                        break;
                    }
                }

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
            }
            if (!jumped && outEdges.length > 0) nextNodeId = outEdges[0].target;
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
            
            const cases = this.nodes.filter(n => n.type === 'CASE_CONTAINER' && (n.data?.switchId === node.id || n.parentId === node.id));
            let targetCase = cases.find(c => !c.data?.isDefault && String(this.evalExpr(this.cleanText(c.data?.caseVal || '1'))) === String(switchVal));
            if (!targetCase) targetCase = cases.find(c => c.data?.isDefault);
            
            if (targetCase) {
                nextNodeId = targetCase.id;
            } else {
                if (outEdges.length > 0) nextNodeId = outEdges[0].target;
            }
        }
        else if (node.type === 'CASE_CONTAINER') {
            const caseEdge = this.edges.find(e => e.source === node.id);
            if (caseEdge) {
                nextNodeId = caseEdge.target;
            } else {
                const switchId = node.data?.switchId || node.parentId;
                const swOutEdge = this.edges.find(e => e.source === switchId);
                if (swOutEdge) nextNodeId = swOutEdge.target;
                else if (outEdges.length > 0) nextNodeId = outEdges[0].target;
            }
        }

        // If nextNodeId points to a CASE_CONTAINER from an inner block, it means an inner block reached the bottom of the case (t-bottom)!
        // Since the CASE tag was already visited before entering the case, route directly to switch exit!
        if (node.type !== 'SWITCH_CONTAINER' && nextNodeId) {
            const nextNodeObj = this.nodes.find(n => n.id === nextNodeId);
            if (nextNodeObj && nextNodeObj.type === 'CASE_CONTAINER') {
                const switchId = nextNodeObj.data?.switchId || nextNodeObj.parentId;
                const swOutEdge = this.edges.find(e => e.source === switchId);
                nextNodeId = swOutEdge ? swOutEdge.target : null;
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

        if (!finalNextId && this.callStack.length > 0) {
            const frame = this.callStack.pop();
            if (frame.assignVar) {
                let retVal = this.lastReturnValue;
                if (retVal === undefined && frame.funcName && this.variables[frame.funcName] !== undefined) {
                    retVal = this.variables[frame.funcName];
                } else if (retVal === undefined && this.variables['result'] !== undefined) {
                    retVal = this.variables['result'];
                }
                if (retVal !== undefined) {
                    this.variables[frame.assignVar] = retVal;
                }
            }
            this.events.push({
                type: 'insight',
                msg: `Návrat z funkce '${frame.funcName}' zpět do volajícího bloku`
            });
            finalNextId = frame.returnNodeId;
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