export class DiagramRunner {
    constructor(nodes, edges) {
        this.nodes = nodes;
        this.edges = edges;
        this.variables = {};
        this.output = [];
        this.isFinished = false;

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
        t = t.replace(/<\/?[^>]+(>|$)/g, ""); 
        t = t.replace(/&nbsp;/gi, ' ').replace(/&gt;/gi, '>').replace(/&lt;/gi, '<').replace(/&amp;/gi, '&').replace(/\u00A0/g, ' ');
        return t.trim();
    }

    evalExpr(expr) {
        try {
            let jsExpr = expr.replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||').replace(/\bNOT\b/gi, '!');
            jsExpr = jsExpr.replace(/(?<![<>=!])=(?!=)/g, '==');
            const keys = Object.keys(this.variables);
            const values = Object.values(this.variables);
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
                
                if (text.includes('=')) {
                    const [left, ...rightParts] = text.split('=');
                    const varName = left.trim();
                    const expr = rightParts.join('=').trim();
                    const val = this.evalExpr(expr);
                    if (val !== undefined) this.variables[varName] = val;
                } else if (text.toUpperCase().startsWith('PRINT')) {
                    let inner = text.substring(5).trim();
                    if(inner.startsWith('(')) inner = inner.substring(1, inner.length-1);
                    const val = this.evalExpr(inner);
                    this.output.push(val !== undefined ? String(val) : inner);
                }
            });
            if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        } 
        else if (node.type === 'IO') {
            let text = this.cleanText(node.data?.label || '').trim();
            const ioType = node.data?.ioType || 'input';

            // Pokud blok definuje konkrétní hodnotu nebo výstup
            if (ioType === 'output' || text.toUpperCase().startsWith('PRINT')) {
                let inner = text.toUpperCase().startsWith('PRINT') ? text.substring(5).trim() : text;
                if(inner.startsWith('(')) inner = inner.substring(1, inner.length-1);
                const val = this.evalExpr(inner);
                this.output.push(val !== undefined ? String(val) : inner);
                if (outEdges.length > 0) nextNodeId = outEdges[0].target;
            } 
            else if (text.includes('=')) {
                const [left, ...rightParts] = text.split('=');
                const varName = left.trim();
                const expr = rightParts.join('=').trim();
                const val = this.evalExpr(expr);
                if (val !== undefined) this.variables[varName] = val;
                if (outEdges.length > 0) nextNodeId = outEdges[0].target;
            } 
            else {
                // Runner zjistí, že proměnná vyžaduje vstup, a buď ho přijme, nebo se zastaví
                const varName = text.replace(/^VSTUP\s+/i, '').trim() || 'x';
                
                if (inputValue === undefined) {
                    // Runner signalizuje UI, že potřebuje pauzu a input
                    return {
                        variables: { ...this.variables },
                        output: [...this.output],
                        currentNodeId: this.currentNodeId,
                        nextNodeId: this.currentNodeId,
                        finished: false,
                        requiresInput: true,
                        variableName: varName
                    };
                } else {
                    // Runner dostal od UI input, uloží ho a pokračuje v běhu na další uzel
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

        const prevNodeId = this.currentNodeId;
        this.currentNodeId = nextNodeId;
        if (!this.currentNodeId) this.isFinished = true;

        return {
            variables: { ...this.variables },
            output: [...this.output],
            currentNodeId: prevNodeId,
            nextNodeId: this.currentNodeId,
            finished: this.isFinished
        };
    }
}