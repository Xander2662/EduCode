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
 * @returns {Object} { SSL_Width, SSL_Height, ASL_Width, ASL_Height }
 */
export function calculateStretchLimits(ownedNodes, stationaryNodes, containerX, containerY) {
    const BASE_WIDTH = 300;
    const BASE_HEIGHT = 150;
    const PADDING_SIDES = 20;
    const PADDING_BOTTOM = 50;
    const STRETCH_MARGIN = 120; // How much empty space users can pull into before popping out

    let numConditions = 0;
    ownedNodes.forEach(n => {
        if (n.type === 'CONDITION' || n.type === 'LOOP_CONTAINER') numConditions++;
    });

    // 1. SSL: Simple Stretch Limit
    let SSL_Width = BASE_WIDTH;
    let SSL_Height = BASE_HEIGHT;
    
    // If only one block is present, no stretch margin is allowed (0 stretch).
    if (ownedNodes.length > 1) {
        // User requested +50 height, but blocks are 50px tall. We use +100 to allow 50px gap + 50px block.
        SSL_Height = BASE_HEIGHT + ((ownedNodes.length - 1) * 100);
        // User requested +170 width for IF blocks. A block is ~150px wide. We use +320 to allow 170px gap + 150px block.
        SSL_Width = BASE_WIDTH + (numConditions * 320);
    }

    let maxStatY = containerY;
    let maxIfX = containerX;
    
    stationaryNodes.forEach(n => {
        const w = n.measured?.width || 120;
        const h = n.measured?.height || 50;
        
        if (n.position.y + h > maxStatY) maxStatY = n.position.y + h;
        
        if (n.type === 'CONDITION' || n.type === 'LOOP_CONTAINER') {
            if (n.position.x + w > maxIfX) maxIfX = n.position.x + w;
        }
    });

    const requiredHeight = (maxStatY - containerY) + PADDING_BOTTOM;
    const requiredIfWidth = (maxIfX - containerX) + PADDING_SIDES;

    // ASL is simpler: it just manages width for IF blocks!
    let ASL_Width = Math.min(SSL_Width, requiredIfWidth + STRETCH_MARGIN);
    
    // We strictly enforce SSL for both width and height to prevent overlap when dropped on the edge.
    let ASL_Height = Math.min(SSL_Height, requiredHeight + STRETCH_MARGIN);
    
    // Ensure ASL doesn't shrink below the base size
    ASL_Width = Math.max(BASE_WIDTH, ASL_Width);
    ASL_Height = Math.max(BASE_HEIGHT, ASL_Height);

    return { SSL_Width, SSL_Height, ASL_Width, ASL_Height };
}
