export const drawioToReactFlow = (xml) => {
  if (!xml || !xml.includes('<mxGraphModel')) return { nodes: [], edges: [] };
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const cells = Array.from(doc.querySelectorAll('mxCell'));

  let nodes = [];
  let edges = [];

  cells.forEach(cell => {
    const id = cell.getAttribute('id');
    const vertex = cell.getAttribute('vertex');
    const edge = cell.getAttribute('edge');

    if (vertex === '1') {
      let value = cell.getAttribute('value') || '';
      value = value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/gi, ' ').replace(/&gt;/gi, '>').replace(/&lt;/gi, '<').replace(/&amp;/gi, '&').trim();

      const style = cell.getAttribute('style') || '';
      const geo = cell.querySelector('mxGeometry');
      const x = geo ? parseFloat(geo.getAttribute('x') || 0) : 0;
      const y = geo ? parseFloat(geo.getAttribute('y') || 0) : 0;

      let type = 'ACTION';
      if (style.includes('ellipse')) type = 'START_END';
      else if (style.includes('rhombus') || style.includes('hexagon')) type = 'CONDITION';
      else if (style.includes('shape=parallelogram')) type = 'IO';
      else if (style.includes('shape=note') || style.includes('fillColor=#fff2cc')) type = 'COMMENT';

      // Přečtení uloženého módu a entityType z XML stylu
      const modeMatch = style.match(/mode=([^;]+)/);
      const entityMatch = style.match(/entityType=([^;]+)/);

      nodes.push({ 
          id, type, position: { x, y }, 
          data: { 
              label: value,
              mode: modeMatch ? modeMatch[1] : undefined,
              entityType: entityMatch ? entityMatch[1] : undefined
          } 
      });
    } else if (edge === '1') {
      const source = cell.getAttribute('source');
      const target = cell.getAttribute('target');
      let value = cell.getAttribute('value') || '';
      value = value.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/gi, ' ').trim();

      if (source && target) {
        const style = cell.getAttribute('style') || '';
        const shMatch = style.match(/sourceHandle=([^;]+)/);
        const thMatch = style.match(/targetHandle=([^;]+)/);
        
        let edgeProps = {
            id, source, target,
            data: { label: value }, 
            type: 'customEdge'      
        };

        if (shMatch) edgeProps.sourceHandle = shMatch[1];
        if (thMatch) edgeProps.targetHandle = thMatch[1];

        edges.push(edgeProps);
      }
    }
  });
  return { nodes, edges };
};

export const reactFlowToDrawio = (nodes, edges) => {
  const STYLES = {
    START_END: "ellipse;whiteSpace=wrap;html=1;",
    ACTION: "whiteSpace=wrap;html=1;",
    IO: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;",
    CONDITION: "rhombus;whiteSpace=wrap;html=1;",
    COMMENT: "shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;darkOpacity=0.05;fillColor=#fff2cc;strokeColor=#d6b656;",
    EDGE: "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
  };

  let xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">\n  <root>\n    <mxCell id="0" />\n    <mxCell id="1" parent="0" />\n`;

  nodes.forEach(n => {
    let w = 120, h = 60;
    if (n.type === 'CONDITION') { w = 80; h = 80; }
    if (n.type === 'START_END') { w = 100; h = 40; }
    if (n.type === 'COMMENT') { w = 120; h = 50; }
    const safeText = (n.data.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#xa;');
    
    // Uložení interního stavu uzlu do atributů stylů (jinak to draw.io ztratí)
    let style = STYLES[n.type] || n.type;
    if (n.data?.mode) style += `mode=${n.data.mode};`;
    if (n.data?.entityType) style += `entityType=${n.data.entityType};`;

    xml += `    <mxCell id="${n.id}" value="${safeText}" style="${style}" vertex="1" parent="1">\n`;
    xml += `      <mxGeometry x="${Math.round(n.position.x)}" y="${Math.round(n.position.y)}" width="${w}" height="${h}" as="geometry" />\n`;
    xml += `    </mxCell>\n`;
  });

  edges.forEach(e => {
    let finalLabel = e.data?.label || e.label || '';
    
    let style = STYLES.EDGE;
    if (e.sourceHandle) style += `sourceHandle=${e.sourceHandle};`;
    if (e.targetHandle) style += `targetHandle=${e.targetHandle};`;

    const safeText = finalLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    xml += `    <mxCell id="${e.id}" value="${safeText}" style="${style}" edge="1" parent="1" source="${e.source}" target="${e.target}">\n`;
    xml += `      <mxGeometry relative="1" as="geometry" />\n`;
    xml += `    </mxCell>\n`;
  });

  xml += `  </root>\n</mxGraphModel>`;
  return xml;
};