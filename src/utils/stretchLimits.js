/**
 * Simple Stretch Limit (SSL) and Advanced Stretch Limit (ASL) Calculator
 * 
 * SSL: The absolute mathematical maximum limit the container can stretch based purely on the number and type of blocks inside.
 * ASL: A smarter limit that looks at how compact the blocks currently are. It allows stretching up to a margin (STRETCH_MARGIN) around the current nodes, but never exceeding the SSL.
 * 
 * @param {Array} ownedNodes - All nodes currently considered inside the container
 * @param {Array} stationaryNodes - Nodes that are currently inside and NOT being dragged
 * @param {number} containerX - The X coordinate of the container
 * @param {number} containerY - The Y coordinate of the container
 * @param {number} baseWidth - The default width of the container
 * @param {number} baseHeight - The default height of the container
 * @returns {Object} { SSL_Width, SSL_Height, ASL_Width, ASL_Height }
 */
export function calculateStretchLimits(ownedNodes, stationaryNodes, containerX, containerY, baseWidth = 300, baseHeight = 150) {
    const PADDING_SIDES = 20;
    const PADDING_BOTTOM = 50;
    const EXTRA_W = 120; // max expected width of dragged blocks
    const EXTRA_H = 100; // max expected height of dragged blocks

    let maxStatX = containerX + baseWidth - PADDING_SIDES;
    let maxStatY = containerY + baseHeight - PADDING_BOTTOM;

    stationaryNodes.forEach(n => {
        let w = n.measured?.width || 120;
        let h = n.measured?.height || 50;
        if (n.type === 'COMMENT') {
            w = n.style?.width ? parseInt(n.style.width) : (n.measured?.width || 250);
            h = n.style?.height ? parseInt(n.style.height) : (n.measured?.height || 100);
        }
        
        if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER' || n.type === 'CASE_CONTAINER') {
            const defW = n.type === 'FOR_CONTAINER' ? 350 : (n.type === 'SWITCH_CONTAINER' ? 350 : 300);
            const defH = n.type === 'FOR_CONTAINER' ? 200 : (n.type === 'SWITCH_CONTAINER' ? 230 : 150);
            w = n.style?.width ? parseInt(n.style.width) : (n.measured?.width || defW);
            h = n.style?.height ? parseInt(n.style.height) : (n.measured?.height || defH);
        }
        
        const nx = n.positionAbsolute?.x || n.position.x;
        const ny = n.positionAbsolute?.y || n.position.y;
        
        if (nx + w > maxStatX) maxStatX = nx + w;
        if (ny + h > maxStatY) maxStatY = ny + h;
    });

    const requiredWidth = (maxStatX - containerX) + PADDING_SIDES;
    const requiredHeight = (maxStatY - containerY) + PADDING_BOTTOM;

    // SSL (Simple Stretch Limit) is now exactly the required bounding box + a generous drag margin
    const SSL_Width = Math.max(baseWidth, requiredWidth + EXTRA_W);
    const SSL_Height = Math.max(baseHeight, requiredHeight + EXTRA_H);

    // ASL is equivalent to SSL since SSL is now dynamically tight to the actual contents
    const ASL_Width = SSL_Width;
    const ASL_Height = SSL_Height;

    return { SSL_Width, SSL_Height, ASL_Width, ASL_Height };
}
