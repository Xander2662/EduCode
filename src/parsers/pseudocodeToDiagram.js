export const parsePseudocodeToDrawio = (code) => {
  let idCounter = 2; 
  const getNewId = () => (idCounter++).toString();
  
  const blocks = code.split('# ----------------------').map(b => b.trim()).filter(Boolean);
  if (blocks.length === 0) return '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

  let nodes = [];
  let edges = [];
  
  const STYLES = {
      START_END: "ellipse;whiteSpace=wrap;html=1;",
      ACTION: "whiteSpace=wrap;html=1;",
      IO: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;",
      CONDITION: "rhombus;whiteSpace=wrap;html=1;",
      COMMENT: "shape=note;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
      EDGE: "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;",
      BUBBLE: "swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;strokeColor=#b0bec5;startSize=0;"
  };

  let groupX = 50;
  
  blocks.forEach(blockCode => {
      const lines = blockCode.split('\n').map(l => l.trim()).filter(Boolean);
      let funcName = 'main';
      let entityType = 'FUNCTION';
      if (lines[0] && (lines[0].startsWith('FUNCTION') || lines[0].startsWith('CLASS'))) {
          if (lines[0].startsWith('CLASS')) entityType = 'CLASS';
          funcName = lines[0].replace('FUNCTION', '').replace('CLASS', '').replace('()', '').trim();
          lines.shift();
      }
      if (lines[lines.length - 1] === 'ENDFUNCTION' || lines[lines.length - 1] === 'ENDCLASS') lines.pop();

      const groupId = getNewId();
      nodes.push({ id: groupId, text: "", type: 'BUBBLE', x: groupX, y: 50, w: 350, h: Math.max(400, lines.length * 100 + 200) });
      
      let startId = getNewId();
      nodes.push({ id: startId, text: funcName, type: 'START_END', x: 100, y: 40, parent: groupId });

      let stack = [];
      let lastNodeId = startId;
      let yOffset = 140;

      const addNode = (text, type, x, y) => {
          const id = getNewId();
          nodes.push({ id, text, type, x, y, parent: groupId });
          return id;
      };

      const addEdge = (source, target, value = "") => {
          edges.push({ id: getNewId(), source, target, value });
      };

      for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          let upper = line.toUpperCase();
          
          if (upper.startsWith('//') || upper.startsWith('#')) {
              addNode(line, 'COMMENT', 250, yOffset - 20);
              continue;
          }

          if (upper.startsWith('IF ')) {
              const condText = line.substring(3, upper.lastIndexOf(' THEN')).trim();
              const condId = addNode(condText, 'CONDITION', 100, yOffset);
              addEdge(lastNodeId, condId);
              stack.push({ type: 'IF', id: condId, endY: yOffset, trueLast: null, falseLast: null });
              lastNodeId = condId;
              yOffset += 100;
          } 
          else if (upper === 'ELSE') {
              const currentIf = stack[stack.length - 1];
              currentIf.trueLast = lastNodeId;
              lastNodeId = currentIf.id; 
              yOffset = currentIf.endY + 100; 
          } 
          else if (upper === 'ENDIF') {
              const currentIf = stack.pop();
              const endIfId = addNode("", "ellipse;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none;", 100, yOffset); 
              if (currentIf.trueLast) addEdge(currentIf.trueLast, endIfId);
              else addEdge(currentIf.id, endIfId, "Ano"); 
              addEdge(lastNodeId, endIfId, currentIf.trueLast ? "Ne" : "Ano"); 
              lastNodeId = endIfId;
              yOffset += 80;
          }
          else if (upper.startsWith('WHILE ') || upper.startsWith('FOR ')) {
              const isFor = upper.startsWith('FOR ');
              const condText = isFor ? line.substring(0, upper.lastIndexOf(' DO')).trim() : line.substring(6, upper.lastIndexOf(' DO')).trim();
              const loopId = addNode(condText, 'CONDITION', 100, yOffset);
              addEdge(lastNodeId, loopId);
              stack.push({ type: 'LOOP', id: loopId });
              lastNodeId = loopId;
              yOffset += 100;
          }
          else if (upper === 'ENDWHILE' || upper === 'ENDFOR') {
              const currentLoop = stack.pop();
              addEdge(lastNodeId, currentLoop.id); 
              lastNodeId = currentLoop.id; 
              yOffset += 80;
          }
          else {
              let isIo = false;
              let text = line;
              if (upper.startsWith('PRINT(') && upper.endsWith(')')) { isIo = true; text = line.substring(6, line.length - 1); }
              else if (upper.startsWith('VSTUP ') || upper.startsWith('RETURN')) { isIo = true; }

              let xPos = 100;
              if (stack.length > 0 && stack[stack.length - 1].type === 'IF' && stack[stack.length - 1].trueLast) xPos = 250; 

              const nodeId = addNode(text, isIo ? 'IO' : 'ACTION', xPos, yOffset);
              
              let edgeText = "";
              if (stack.length > 0) {
                  const parent = stack[stack.length - 1];
                  if (lastNodeId === parent.id) edgeText = (parent.type === 'IF' && parent.trueLast) ? "Ne" : "Ano";
              }
              
              addEdge(lastNodeId, nodeId, edgeText);
              lastNodeId = nodeId;
              yOffset += 100;
          }
      }

      const endId = addNode("Konec", 'START_END', 100, yOffset);
      addEdge(lastNodeId, endId, stack.length > 0 ? "Ne" : "");
      groupX += 400;
  });

  let xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">\n  <root>\n    <mxCell id="0" />\n    <mxCell id="1" parent="0" />\n`;

  nodes.forEach(n => {
      let w = 120, h = 60;
      if (n.type === 'CONDITION') { w = 80; h = 80; }
      if (n.type === 'COMMENT') { w = 140; h = 50; }
      if (n.type === 'START_END') { w = 140; h = 60; }
      if (n.type === 'BUBBLE') { w = n.w; h = n.h; }
      
      const safeText = n.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      xml += `    <mxCell id="${n.id}" value="${safeText}" style="${STYLES[n.type] || n.type}" vertex="1" parent="${n.parent || '1'}">\n`;
      xml += `      <mxGeometry x="${n.x}" y="${n.y}" width="${w}" height="${h}" as="geometry" />\n`;
      xml += `    </mxCell>\n`;
  });

  edges.forEach(e => {
      xml += `    <mxCell id="${e.id}" value="${e.value}" style="${STYLES.EDGE}" edge="1" parent="1" source="${e.source}" target="${e.target}">\n`;
      xml += `      <mxGeometry relative="1" as="geometry" />\n`;
      xml += `    </mxCell>\n`;
  });

  xml += `  </root>\n</mxGraphModel>`;
  return xml;
};