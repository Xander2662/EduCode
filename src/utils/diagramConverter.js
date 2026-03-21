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
      value = value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/gi, ' ').trim();
      const style = cell.getAttribute('style') || '';
      const geo = cell.querySelector('mxGeometry');
      const x = geo ? parseFloat(geo.getAttribute('x') || 0) : 0;
      const y = geo ? parseFloat(geo.getAttribute('y') || 0) : 0;

      let type = 'ACTION';
      let mode = 'unassigned';
      let entityType = 'FUNCTION';
      
      if (style.includes('ellipse')) {
        type = 'START_END';
        if (value.toLowerCase().includes('konec') || value.toLowerCase() === 'end') mode = 'end';
        else if (value) mode = 'start';
      }
      else if (style.includes('rhombus')) type = 'CONDITION';
      else if (style.includes('shape=parallelogram')) type = 'IO';
      else if (style.includes('shape=note') || style.includes('fillColor=#fff2cc')) type = 'COMMENT';

      nodes.push({ id, type, position: { x, y }, data: { label: value, mode, entityType } });
    } else if (edge === '1') {
      const source = cell.getAttribute('source');
      const target = cell.getAttribute('target');
      let value = cell.getAttribute('value') || '';
      value = value.replace(/<[^>]*>?/gm, '').trim();
      
      if (source && target) {
        let label = value === 'Ano' ? '+' : (value === 'Ne' ? '-' : value);
        edges.push({ id, source, target, type: 'customEdge', data: { label } });
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
    COMMENT: "shape=note;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
    EDGE: "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
  };

  let xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">\n  <root>\n    <mxCell id="0" />\n    <mxCell id="1" parent="0" />\n`;

  nodes.forEach(n => {
    let w = 120, h = 60;
    if (n.type === 'CONDITION') { w = 80; h = 80; }
    if (n.type === 'START_END') { w = 140; h = 60; }
    if (n.type === 'COMMENT') { w = 140; h = 50; }
    
    let safeText = (n.data.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (n.type === 'START_END' && n.data.mode === 'end') safeText = 'Konec';

    xml += `    <mxCell id="${n.id}" value="${safeText}" style="${STYLES[n.type] || n.type}" vertex="1" parent="1">\n`;
    xml += `      <mxGeometry x="${Math.round(n.position.x)}" y="${Math.round(n.position.y)}" width="${w}" height="${h}" as="geometry" />\n`;
    xml += `    </mxCell>\n`;
  });

  edges.forEach(e => {
    let finalLabel = e.data?.label || e.label || '';
    if (finalLabel === '+') finalLabel = 'Ano';
    if (finalLabel === '-') finalLabel = 'Ne';

    const safeText = finalLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    xml += `    <mxCell id="${e.id}" value="${safeText}" style="${STYLES.EDGE}" edge="1" parent="1" source="${e.source}" target="${e.target}">\n`;
    xml += `      <mxGeometry relative="1" as="geometry" />\n`;
    xml += `    </mxCell>\n`;
  });

  xml += `  </root>\n</mxGraphModel>`;
  return xml;
};