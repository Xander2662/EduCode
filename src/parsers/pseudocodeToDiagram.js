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
      EDGE: "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
  };

  let groupX = 100;
  
  blocks.forEach(blockCode => {
      let lines = blockCode.split('\n').map(l => l.trim()).filter(Boolean);
      let funcName = 'main';
      let entityType = 'FUNCTION';
      
      // Zajištění robustního vyčištění deklarace funkce/třídy odkudkoliv ze začátku
      const defIndex = lines.findIndex(l => {
          const upper = l.toUpperCase();
          return upper.startsWith('FUNCTION ') || upper === 'FUNCTION()' || upper === 'FUNCTION' || upper.startsWith('CLASS ') || upper === 'CLASS';
      });

      if (defIndex !== -1) {
          const defLine = lines[defIndex];
          const upperDef = defLine.toUpperCase();
          if (upperDef.startsWith('CLASS')) entityType = 'CLASS';
          
          funcName = defLine.replace(/function/i, '').replace(/class/i, '').replace('()', '').trim();
          if (!funcName) funcName = 'main';
          
          lines.splice(defIndex, 1);
      }
      
      // Vyčištění ukončovacích tagů, abychom pro ně nevytvářeli Action bloky
      lines = lines.filter(l => {
          const upper = l.toUpperCase();
          return upper !== 'ENDFUNCTION' && upper !== 'ENDCLASS';
      });

      let startId = getNewId();
      nodes.push({ id: startId, text: funcName, type: 'START_END', x: groupX, y: 40, mode: 'start', entityType });

      let stack = [];
      let lastNodeId = startId;
      let pendingEdgeLabel = "";
      let yOffset = 140;

      const addNode = (text, type, x, y) => {
          const id = getNewId();
          nodes.push({ id, text, type, x, y });
          return id;
      };

      const addEdge = (source, target, value = "") => {
          edges.push({ id: getNewId(), source, target, value });
      };

      // Inteligentní posun osy X pro těla cyklů a podmínek - zamezí kolizi čar!
      const getXPos = () => {
          let x = groupX;
          for (let i = 0; i < stack.length; i++) {
              const s = stack[i];
              if (s.type === 'LOOP') x += 180;
              if (s.type === 'IF' && s.trueLast !== null) x += 180;
          }
          return x;
      };

      for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          let upper = line.toUpperCase();
          
          if (upper.startsWith('//') || upper.startsWith('#')) {
              addNode(line, 'COMMENT', getXPos() + 160, yOffset - 20);
              continue;
          }

          if (upper.startsWith('IF ')) {
              const condText = line.substring(3, upper.lastIndexOf(' THEN')).trim();
              const condId = addNode(condText, 'CONDITION', getXPos(), yOffset);
              addEdge(lastNodeId, condId, pendingEdgeLabel);
              pendingEdgeLabel = "";

              stack.push({ type: 'IF', id: condId, endY: yOffset, trueLast: null });
              lastNodeId = condId;
              pendingEdgeLabel = "Ano";
              yOffset += 100;
          } 
          else if (upper === 'ELSE') {
              const currentIf = stack[stack.length - 1];
              currentIf.trueLast = lastNodeId;
              lastNodeId = currentIf.id; 
              pendingEdgeLabel = "Ne";
              yOffset = currentIf.endY + 100; 
          } 
          else if (upper === 'ENDIF') {
              const currentIf = stack.pop();
              const endIfId = addNode("", "ellipse;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none;", getXPos(), yOffset); 
              
              if (currentIf.trueLast) addEdge(currentIf.trueLast, endIfId, "");
              else addEdge(currentIf.id, endIfId, "Ano"); 
              
              addEdge(lastNodeId, endIfId, currentIf.trueLast ? "" : "Ne"); 
              
              lastNodeId = endIfId;
              pendingEdgeLabel = "";
              yOffset += 80;
          }
          else if (upper.startsWith('WHILE ') || upper.startsWith('FOR ')) {
              const isFor = upper.startsWith('FOR ');
              const condText = isFor ? line.substring(0, upper.lastIndexOf(' DO')).trim() : line.substring(6, upper.lastIndexOf(' DO')).trim();
              
              const condId = addNode(condText, 'CONDITION', getXPos(), yOffset);
              addEdge(lastNodeId, condId, pendingEdgeLabel);
              pendingEdgeLabel = "";
              
              stack.push({ type: 'LOOP', id: condId });
              lastNodeId = condId;
              pendingEdgeLabel = "Ano"; 
              yOffset += 100;
          }
          else if (upper === 'ENDWHILE' || upper === 'ENDFOR') {
              const currentLoop = stack.pop();
              addEdge(lastNodeId, currentLoop.id, ""); 
              
              lastNodeId = currentLoop.id;
              pendingEdgeLabel = "Ne";
              yOffset += 80;
          }
          else {
              let isIo = false;
              let text = line;
              
              if (upper.startsWith('PRINT(') && upper.endsWith(')')) {
                  isIo = true;
                  text = line.substring(6, line.length - 1);
              } else if (upper.startsWith('VSTUP ') || upper.startsWith('RETURN')) {
                  isIo = true;
              }

              const nodeId = addNode(text, isIo ? 'IO' : 'ACTION', getXPos(), yOffset);
              addEdge(lastNodeId, nodeId, pendingEdgeLabel);
              pendingEdgeLabel = "";
              
              lastNodeId = nodeId;
              yOffset += 100;
          }
      }

      const endId = addNode("Konec", 'START_END', groupX, yOffset);
      addEdge(lastNodeId, endId, pendingEdgeLabel);
      groupX += 450;
  });

  let xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">\n  <root>\n    <mxCell id="0" />\n    <mxCell id="1" parent="0" />\n`;

  nodes.forEach(n => {
      let w = 120, h = 60;
      if (n.type === 'CONDITION') { w = 80; h = 80; }
      if (n.type === 'COMMENT') { w = 140; h = 50; }
      if (n.type === 'START_END') { w = 100; h = 40; }
      
      const safeText = n.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      xml += `    <mxCell id="${n.id}" value="${safeText}" style="${STYLES[n.type] || n.type}" vertex="1" parent="1">\n`;
      xml += `      <mxGeometry x="${n.x}" y="${n.y}" width="${w}" height="${h}" as="geometry" />\n`;
      xml += `    </mxCell>\n`;
  });
  edges.forEach(e => {
      const safeValue = e.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      xml += `    <mxCell id="${e.id}" value="${safeValue}" style="${STYLES.EDGE}" edge="1" parent="1" source="${e.source}" target="${e.target}">\n`;
      xml += `      <mxGeometry relative="1" as="geometry" />\n`;
      xml += `    </mxCell>\n`;
  });

  xml += `  </root>\n</mxGraphModel>`;
  return xml;
};