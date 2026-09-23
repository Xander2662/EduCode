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
      const parentId = cell.getAttribute('parent');
      let value = cell.getAttribute('value') || '';
      value = value.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/p>/gi, '\n')
                   .replace(/<\/?(?:b|i|u|span|font|div|p|strong|em|strike|s|sub|sup|h[1-6])(?:\s+[^>]*?)?>/gi, '')
                   .replace(/&nbsp;/gi, ' ')
                   .replace(/&gt;/gi, '>')
                   .replace(/&lt;/gi, '<')
                   .replace(/&amp;/gi, '&')
                   .trim();

      const style = cell.getAttribute('style') || '';
      const geo = cell.querySelector('mxGeometry');
      const x = geo ? parseFloat(geo.getAttribute('x') || 0) : 0;
      const y = geo ? parseFloat(geo.getAttribute('y') || 0) : 0;
      
      // ÚMYSLNĚ odstraněno načítání width a height, React Flow si to dopočítá samo dle obsahu!

      let type = 'ACTION';
      if (style.includes('ellipse') && style.includes('strokeColor=none') && style.includes('fillColor=none')) type = 'MERGE';
      else if (style.includes('ellipse')) type = 'START_END';
      else if (style.includes('rhombus') || style.includes('hexagon') || style.includes('CONDITION') || cell.getAttribute('type') === 'CONDITION') type = 'CONDITION';
      else if (style.includes('shape=parallelogram')) type = 'IO';
      const cellType = cell.getAttribute('type');
      if (cellType === 'FOR_CONTAINER' || style.includes('FOR_CONTAINER') || style.includes('forInit=') || cell.getAttribute('forInit')) {
          type = 'FOR_CONTAINER';
      } else if (style.includes('swimlane') || style.includes('LOOP_CONTAINER') || cellType === 'LOOP_CONTAINER' || style.includes('SWITCH_CONTAINER') || cellType === 'SWITCH_CONTAINER' || style.includes('CASE_CONTAINER') || cellType === 'CASE_CONTAINER') {
          if (style.includes('SWITCH_CONTAINER') || cellType === 'SWITCH_CONTAINER') type = 'SWITCH_CONTAINER';
          else if (style.includes('CASE_CONTAINER') || cellType === 'CASE_CONTAINER') type = 'CASE_CONTAINER';
          else type = 'LOOP_CONTAINER';
      }

      const modeMatch = style.match(/mode=([^;]+)/);
      const entityMatch = style.match(/entityType=([^;]+)/);
      const ioMatch = style.match(/ioType=([^;]+)/);
      const doWhileMatch = style.match(/doWhile=([^;]+)/);
      const doWhileAttr = cell.getAttribute('doWhile');

      const nodeObj = { 
          id, 
          type, 
          position: { x, y }, 
          data: { 
              label: value,
              mode: modeMatch ? modeMatch[1] : undefined,
              entityType: entityMatch ? entityMatch[1] : undefined,
              ioType: ioMatch ? ioMatch[1] : (type === 'IO' ? 'input' : undefined),
              doWhile: doWhileAttr ? doWhileAttr === 'true' : (doWhileMatch ? doWhileMatch[1] === 'true' : false),
              forInit: style.match(/forInit=([^;]+)/) ? decodeURIComponent(style.match(/forInit=([^;]+)/)[1]) : (cell.getAttribute('forInit') ? decodeURIComponent(cell.getAttribute('forInit')) : (type === 'FOR_CONTAINER' ? 'i = 0' : undefined)),
              forLimit: style.match(/forLimit=([^;]+)/) ? decodeURIComponent(style.match(/forLimit=([^;]+)/)[1]) : (cell.getAttribute('forLimit') ? decodeURIComponent(cell.getAttribute('forLimit')) : (type === 'FOR_CONTAINER' ? '10' : undefined)),
              forStep: style.match(/forStep=([^;]+)/) ? decodeURIComponent(style.match(/forStep=([^;]+)/)[1]) : (cell.getAttribute('forStep') ? decodeURIComponent(cell.getAttribute('forStep')) : (type === 'FOR_CONTAINER' ? '1' : undefined)),
              switchVar: style.match(/switchVar=([^;]+)/) ? decodeURIComponent(style.match(/switchVar=([^;]+)/)[1]) : undefined,
              caseVal: style.match(/caseVal=([^;]+)/) ? decodeURIComponent(style.match(/caseVal=([^;]+)/)[1]) : undefined,
              isDefault: style.match(/isDefault=([^;]+)/) ? style.match(/isDefault=([^;]+)/)[1] === 'true' : false,
              isSwapped: style.match(/isSwapped=([^;]+)/) ? style.match(/isSwapped=([^;]+)/)[1] === 'true' : false,
              switchId: style.match(/switchId=([^;]+)/) ? decodeURIComponent(style.match(/switchId=([^;]+)/)[1]) : undefined
          } 
      };
      
      if (parentId && parentId !== '0' && parentId !== '1') {
          nodeObj.parentId = parentId;
      }

      if (type === 'LOOP_CONTAINER' || type === 'FOR_CONTAINER' || type === 'GROUP_BG' || type === 'SWITCH_CONTAINER') {
          nodeObj.zIndex = -1;
      }
      if (type === 'CASE_CONTAINER') {
          nodeObj.zIndex = 5;
      }

      if (type === 'LOOP_CONTAINER' || type === 'FOR_CONTAINER' || type === 'GROUP_BG' || type === 'SWITCH_CONTAINER' || type === 'CASE_CONTAINER') {
          const w = geo ? parseFloat(geo.getAttribute('width') || 0) : 300;
          const h = geo ? parseFloat(geo.getAttribute('height') || 0) : 300;
          nodeObj.style = { width: w, height: h };
      }
      
      nodes.push(nodeObj);
    } else if (edge === '1') {
      const source = cell.getAttribute('source');
      const target = cell.getAttribute('target');
      let value = cell.getAttribute('value') || '';
      value = value.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/p>/gi, '\n')
                   .replace(/<\/?(?:b|i|u|span|font|div|p|strong|em|strike|s|sub|sup|h[1-6])(?:\s+[^>]*?)?>/gi, '')
                   .replace(/&nbsp;/gi, ' ')
                   .replace(/&gt;/gi, '>')
                   .replace(/&lt;/gi, '<')
                   .replace(/&amp;/gi, '&')
                   .trim();

      if (source && target) {
        const style = cell.getAttribute('style') || '';
        const shMatch = style.match(/sourceHandle=([^;]+)/);
        const thMatch = style.match(/targetHandle=([^;]+)/);

        const srcCell = cells.find(c => c.getAttribute('id') === source);
        const srcStyle = srcCell ? (srcCell.getAttribute('style') || '') : '';
        const isSrcCond = style.includes('isCondition=true') || srcStyle.includes('rhombus') || srcStyle.includes('hexagon') || srcStyle.includes('CONDITION') || srcCell?.getAttribute('type') === 'CONDITION';
        
        let labelVal = value;
        if (isSrcCond && !labelVal) {
            const isSwapped = srcStyle.includes('isSwapped=true');
            const handle = shMatch ? shMatch[1] : 's-bottom';
            labelVal = handle === 's-right' ? (isSwapped ? 'True' : 'False') : (isSwapped ? 'False' : 'True');
        }

        let edgeProps = { id, source, target, data: { label: labelVal, isCondition: isSrcCond }, type: 'customEdge' };
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
    IO: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;spacingLeft=35;spacingRight=30;",
    CONDITION: "rhombus;whiteSpace=wrap;html=1;",
    COMMENT: "shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;darkOpacity=0.05;fillColor=#fff2cc;strokeColor=#d6b656;",
    MERGE: "ellipse;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none;resizable=0;movable=0;rotatable=0;",
    LOOP_CONTAINER: "swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;",
    FOR_CONTAINER: "swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;strokeColor=#4f46e5;FOR_CONTAINER;",
    SWITCH_CONTAINER: "swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;strokeColor=#f97316;SWITCH_CONTAINER;",
    CASE_CONTAINER: "swimlane;whiteSpace=wrap;html=1;dashed=1;fillColor=none;strokeColor=#f97316;CASE_CONTAINER;",
    EDGE: "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
  };

  let xml = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">\n  <root>\n    <mxCell id="0" />\n    <mxCell id="1" parent="0" />\n`;

  nodes.forEach(n => {
    let w = 160, h = 50;
    if (n.type === 'CONDITION') { w = 160; h = 80; }
    if (n.type === 'START_END') { w = 180; h = 50; }
    if (n.type === 'COMMENT') { w = 160; h = 50; }
    if (n.type === 'MERGE') { w = 10; h = 10; }
    if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'GROUP_BG' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') {
        w = parseInt(n.style?.width) || 300;
        h = parseInt(n.style?.height) || 300;
    }

    const safeText = (n.data.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#xa;');
    
    let style = STYLES[n.type] || n.type;
    if (n.data?.mode) style += `mode=${n.data.mode};`;
    if (n.data?.entityType) style += `entityType=${n.data.entityType};`;
    if (n.data?.ioType) style += `ioType=${n.data.ioType};`;
    if (n.data?.doWhile !== undefined) style += `doWhile=${n.data.doWhile};`;
    if (n.type === 'FOR_CONTAINER') {
        const fInit = n.data?.forInit !== undefined ? n.data.forInit : 'i = 0';
        const fLimit = n.data?.forLimit !== undefined ? n.data.forLimit : '10';
        const fStep = n.data?.forStep !== undefined ? n.data.forStep : '1';
        style += `forInit=${encodeURIComponent(fInit)};forLimit=${encodeURIComponent(fLimit)};forStep=${encodeURIComponent(fStep)};`;
    } else {
        if (n.data?.forInit !== undefined) style += `forInit=${encodeURIComponent(n.data.forInit)};`;
        if (n.data?.forLimit !== undefined) style += `forLimit=${encodeURIComponent(n.data.forLimit)};`;
        if (n.data?.forStep !== undefined) style += `forStep=${encodeURIComponent(n.data.forStep)};`;
    }
    if (n.data?.switchVar !== undefined) style += `switchVar=${encodeURIComponent(n.data.switchVar)};`;
    if (n.data?.caseVal !== undefined) style += `caseVal=${encodeURIComponent(n.data.caseVal)};`;
    if (n.data?.isDefault !== undefined) style += `isDefault=${n.data.isDefault};`;
    if (n.data?.isSwapped !== undefined) style += `isSwapped=${n.data.isSwapped};`;
    if (n.data?.switchId !== undefined) style += `switchId=${encodeURIComponent(n.data.switchId)};`;

    const parentAttr = n.parentId ? n.parentId : '1';
    xml += `    <mxCell id="${n.id}" value="${safeText}" type="${n.type}" style="${style}" vertex="1" parent="${parentAttr}">\n`;
    xml += `      <mxGeometry x="${Math.round(n.position.x)}" y="${Math.round(n.position.y)}" width="${w}" height="${h}" as="geometry" />\n`;
    xml += `    </mxCell>\n`;
  });

  edges.forEach(e => {
    let finalLabel = e.data?.label || e.label || '';
    let style = STYLES.EDGE;
    const srcNode = nodes.find(n => n.id === e.source);
    const isCond = e.data?.isCondition || srcNode?.type === 'CONDITION' || ['ano', 'ne', 'yes', 'no', 'true', 'false', '+', '-'].includes((finalLabel || '').toLowerCase().trim());
    if (isCond) {
        style += 'isCondition=true;';
        if (!finalLabel) {
            const isSwapped = srcNode?.data?.isSwapped === true;
            const handle = e.sourceHandle || 's-bottom';
            finalLabel = handle === 's-right' ? (isSwapped ? 'True' : 'False') : (isSwapped ? 'False' : 'True');
        }
    }
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