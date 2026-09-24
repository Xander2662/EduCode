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
const PADDING_SIDES = 35;
const PADDING_BOTTOM = 35;

function getNodeDimensions(n) {
    let w = n.measured?.width || 120;
    let h = n.measured?.height || 50;
    
    const isContainer = ['LOOP_CONTAINER', 'FOR_CONTAINER', 'SWITCH_CONTAINER', 'CASE_CONTAINER'].includes(n.type);
    
    if (n.type === 'COMMENT') {
        w = n.style?.width ? parseInt(n.style.width) : (n.measured?.width || 250);
        h = n.style?.height ? parseInt(n.style.height) : (n.measured?.height || 100);
    } else if (isContainer) {
        const defW = (n.type === 'FOR_CONTAINER' || n.type === 'SWITCH_CONTAINER') ? 350 : 300;
        const defH = n.type === 'FOR_CONTAINER' ? 200 : (n.type === 'SWITCH_CONTAINER' ? 230 : 150);
        w = n.style?.width ? parseInt(n.style.width) : (n.measured?.width || defW);
        h = n.style?.height ? parseInt(n.style.height) : (n.measured?.height || defH);
    } else if (n.type === 'CONDITION' || n.type === 'IF') {
        w = n.measured?.width || 160;
        h = n.measured?.height || 80;
    }
    
    return { w, h, isContainer };
}

export function calculateStretchLimits(ownedNodes, stationaryNodes, containerX, containerY, baseWidth = 300, baseHeight = 150, currentContainerWidth = 300, currentContainerHeight = 150) {
    // 1. Track structural properties and limits
    let maxStatX = containerX, maxStatY = containerY;
    let maxOwnedX = containerX, maxOwnedY = containerY;
    
    let rightmostIsContainer = false;
    let bottommostIsContainer = false;
    let hasIf = false;
    let maxIfX = 0;
    
    let totalNestedW = 0, totalNestedH = 0;
    let actionBlockCount = 0;
    let maxBlockW = 0, maxBlockH = 0;

    ownedNodes.forEach(n => {
        let { w, h, isContainer } = getNodeDimensions(n);
        const nx = n.positionAbsolute?.x || n.position.x;
        const ny = n.positionAbsolute?.y || n.position.y;
        
        if (n.type === 'CONDITION' || n.type === 'IF') {
            hasIf = true;
            maxIfX = Math.max(maxIfX, nx + w);
            h += 50;  // Extra vertical space
        }

        // Track maxOwned bounds (includes dragging nodes) for anti-collapse logic
        maxOwnedX = Math.max(maxOwnedX, nx + w);
        maxOwnedY = Math.max(maxOwnedY, ny + h);

        if (!n.dragging) {
            if (nx + w > maxStatX) {
                maxStatX = nx + w;
                rightmostIsContainer = isContainer;
            }
            if (ny + h > maxStatY) {
                maxStatY = ny + h;
                bottommostIsContainer = isContainer;
            }
            
            if (isContainer) {
                totalNestedW += w;
                totalNestedH += h;
            } else if (n.type === 'ACTION' || n.type === 'IO') {
                actionBlockCount++;
            }
            
            maxBlockW = Math.max(maxBlockW, w);
            maxBlockH = Math.max(maxBlockH, h);
        }
    });

    // 2. Calculate Required Bounding Boxes
    const requiredWidth = stationaryNodes.length ? (maxStatX - containerX) + PADDING_SIDES : 0;
    const requiredHeight = stationaryNodes.length ? (maxStatY - containerY) + PADDING_BOTTOM : 0;
    const requiredOwnedWidth = ownedNodes.length ? (maxOwnedX - containerX) + PADDING_SIDES : 0;
    const requiredOwnedHeight = ownedNodes.length ? (maxOwnedY - containerY) + PADDING_BOTTOM : 0;

    // 3. Apply Contextual Rules
    let EXTRA_W = 0; // Default: no base stretch on X for normal blocks
    let EXTRA_H = 0; // Default: no base stretch on Y

    if (rightmostIsContainer) EXTRA_W = 0;
    if (bottommostIsContainer) EXTRA_H = 0;
    if (ownedNodes.length <= 1) {
        EXTRA_W = 0;
        EXTRA_H = 0;
    }

    // 4. RESTORED BACK CATCH & ANTI-COLLAPSE LOGIC
    const baseInchwormW = ownedNodes.length <= 1 ? 0 : EXTRA_W;
    
    // The inchworm "brick wall" MUST be anchored to the actual size of the contents (requiredWidth),
    // otherwise it acts as a fixed wall at `baseWidth` and crushes the EXTRA_W gap to 0!
    const maxWithoutAddition = Math.max(baseWidth, requiredWidth + baseInchwormW + totalNestedW);

    // Condition blocks provide horizontal branch headroom (+320px) in hardMaxW without statically inflating resting runwayW.
    // For anti-infinite stretch when dragging the IF block itself, the IF position and its addition are bounded by maxWithoutAddition.
    const rawIfPos = maxIfX > 0 ? (maxIfX - containerX) + PADDING_SIDES : 0;
    const ifPosition = maxIfX > 0 ? Math.min(rawIfPos, maxWithoutAddition) : 0;
    const ifBranchLimit = maxIfX > 0 ? ifPosition + 320 : 0;
    const hardMaxW = Math.max(maxWithoutAddition, ifBranchLimit);
    
    // Y-axis stretching should allow just enough room to stack the next block vertically.
    // A standard vertical drag margin of 120px below the currently stationary blocks is perfect.
    const baseInchwormH = ownedNodes.length <= 1 ? 0 : 120;
    const hardMaxH = Math.max(baseHeight, requiredHeight + baseInchwormH);

    // Temporary max stretch allows a wrapped block to be moved freely INWARD,
    // but prevents stretching the container ANY FURTHER OUTWARD if it's beyond hard limits.
    const maxAllowedW = Math.max(hardMaxW, currentContainerWidth);
    const maxAllowedH = Math.max(hardMaxH, currentContainerHeight);

    // Runway uses requiredOwnedWidth so it DOES NOT automatically collapse when dragging starts
    const runwayW = Math.max(baseWidth, requiredOwnedWidth + EXTRA_W);
    const runwayH = Math.max(baseHeight, requiredOwnedHeight + EXTRA_H);

    const SSL_Width = Math.min(maxAllowedW, runwayW);
    const SSL_Height = Math.min(maxAllowedH, runwayH);

    return { SSL_Width, SSL_Height, ASL_Width: SSL_Width, ASL_Height: SSL_Height };
}