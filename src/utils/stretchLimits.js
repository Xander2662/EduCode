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
    const STRETCH_MARGIN = 120; // How much empty space users can pull into before popping out

    let numConditions = 0;
    ownedNodes.forEach(n => {
        if (n.type === 'CONDITION' || n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') numConditions++;
    });

    // 1. SSL: Simple Stretch Limit
    let SSL_Width = baseWidth;
    let SSL_Height = baseHeight;
    
    let hasNestedLoop = false;
    ownedNodes.forEach(n => {
        if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') hasNestedLoop = true;
    });

    if (ownedNodes.length > 1 || hasNestedLoop) {
        let totalChildHeight = 0;
        ownedNodes.forEach(n => {
            if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') {
                const defH = n.type === 'FOR_CONTAINER' ? 200 : 150;
                totalChildHeight += n.style?.height ? parseInt(n.style.height) : (n.measured?.height || defH);
            } else {
                totalChildHeight += 50;
            }
        });
        
        // Base padding (empty space) is 100px (since baseHeight is 150 and the first block takes 50, leaving 100 padding. 
        // We add 100 padding + total heights + 50 gap per block after the first).
        SSL_Height = (baseHeight - 50) + totalChildHeight + (ownedNodes.length - 1) * 50;
        
        // IF blocks expand horizontally. We treat loops like an IF block (+320).
        SSL_Width = baseWidth + (numConditions * 320);
        
        // Fallback: If a nested container is massively stretched horizontally, SSL_Width must mathematically allow for it!
        // We only look at its pure width, NOT its position. If we included position, dragging the block 
        // would push the boundary infinitely to the right!
        ownedNodes.forEach(n => {
            if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') {
                const defW = n.type === 'FOR_CONTAINER' ? 350 : 300;
                const w = n.style?.width ? parseInt(n.style.width) : (n.measured?.width || defW);
                if (w + 100 > SSL_Width) {
                    SSL_Width = w + 100;
                }
            }
        });
    }

    let maxStatY = containerY;
    let maxIfX = containerX;
    
    stationaryNodes.forEach(n => {
        let w = n.measured?.width || 120;
        let h = n.measured?.height || 50;
        
        if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') {
            const defW = n.type === 'FOR_CONTAINER' ? 350 : 300;
            const defH = n.type === 'FOR_CONTAINER' ? 200 : 150;
            w = n.style?.width ? parseInt(n.style.width) : (n.measured?.width || defW);
            h = n.style?.height ? parseInt(n.style.height) : (n.measured?.height || defH);
        }
        
        if (n.position.y + h > maxStatY) maxStatY = n.position.y + h;
        
        if (n.type === 'CONDITION' || n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') {
            if (n.position.x + w > maxIfX) maxIfX = n.position.x + w;
        }
    });

    const requiredHeight = (maxStatY - containerY) + PADDING_BOTTOM;
    const requiredIfWidth = (maxIfX - containerX) + PADDING_SIDES;

    let maxDraggedWidth = 0;
    let maxDraggedHeight = 0;
    
    ownedNodes.forEach(n => {
        if (!stationaryNodes.some(sn => sn.id === n.id)) {
            let w = n.measured?.width || 120;
            let h = n.measured?.height || 50;
            if (n.type === 'LOOP_CONTAINER' || n.type === 'FOR_CONTAINER') {
                const defW = n.type === 'FOR_CONTAINER' ? 350 : 300;
                const defH = n.type === 'FOR_CONTAINER' ? 200 : 150;
                w = n.style?.width ? parseInt(n.style.width) : (n.measured?.width || defW);
                h = n.style?.height ? parseInt(n.style.height) : (n.measured?.height || defH);
            }
            if (w > maxDraggedWidth) maxDraggedWidth = w;
            if (h > maxDraggedHeight) maxDraggedHeight = h;
        }
    });

    const dynamicStretchMarginWidth = Math.max(STRETCH_MARGIN, maxDraggedWidth + 20);
    const dynamicStretchMarginHeight = Math.max(STRETCH_MARGIN, maxDraggedHeight + 20);

    let ASL_Width = Math.min(SSL_Width, requiredIfWidth + dynamicStretchMarginWidth);
    let ASL_Height = Math.min(SSL_Height, requiredHeight + dynamicStretchMarginHeight);
    
    // Ensure ASL doesn't shrink below the base size
    ASL_Width = Math.max(baseWidth, ASL_Width);
    ASL_Height = Math.max(baseHeight, ASL_Height);

    return { SSL_Width, SSL_Height, ASL_Width, ASL_Height };
}
