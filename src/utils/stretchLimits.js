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
    
    let totalNestedW = 0, totalNestedH = 0;
    let actionBlockCount = 0;
    let maxBlockW = 0, maxBlockH = 0;
    let sumBlockH = 0;

    ownedNodes.forEach(n => {
        let { w, h, isContainer } = getNodeDimensions(n);
        const nx = n.positionAbsolute?.x || n.position.x;
        const ny = n.positionAbsolute?.y || n.position.y;
        
        if (n.type === 'CONDITION' || n.type === 'IF') {
            hasIf = true;
        }

        sumBlockH += h;
        maxBlockW = Math.max(maxBlockW, w);
        maxBlockH = Math.max(maxBlockH, h);

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

    // 1. Natural base bounds (compact size required by structure)
    let naturalW = baseWidth;
    if (totalNestedW > 0) {
        naturalW = Math.max(baseWidth, requiredWidth);
    }
    // Check if stationary nodes are placed in multiple side-by-side columns (overlapping in Y)
    const hasSideBySideColumns = stationaryNodes.some((a, i) => {
        const aY = a.positionAbsolute?.y || a.position.y;
        const aH = a.measured?.height || a.height || 50;
        return stationaryNodes.slice(i + 1).some(b => {
            const bY = b.positionAbsolute?.y || b.position.y;
            const bH = b.measured?.height || b.height || 50;
            return (aY < bY + bH) && (aY + aH > bY);
        });
    });
    if (hasSideBySideColumns) {
        naturalW = Math.max(naturalW, requiredWidth);
    }

    let naturalH = baseHeight;
    const stackH = 60 + sumBlockH + ((ownedNodes.length - 1) * 60) + PADDING_BOTTOM;
    if (ownedNodes.length > 1) {
        naturalH = Math.max(baseHeight, Math.min(requiredHeight, stackH));
    }
    if (hasIf) {
        naturalH += 60;
    }
    if (totalNestedH > 0) {
        naturalH = Math.max(naturalH, requiredHeight);
    }

    // 2. Maximum Stretch Limit (SSL ceiling):
    // Allows container to stretch to overlap a block when dragged to the edge of natural bounds for the first time.
    // Once reached or dropped, container holds that size as the temporary okay stretch, but stops overlapping any further.
    const stretchAllowanceW = Math.max(maxBlockW + PADDING_SIDES * 2, 190);
    const stretchAllowanceH = Math.max(maxBlockH + PADDING_BOTTOM * 2, 120);

    const maxSSL_W = naturalW + (ownedNodes.length > 0 ? stretchAllowanceW : 0);
    const maxSSL_H = naturalH + (ownedNodes.length > 0 ? stretchAllowanceH : 0);

    const anyDragging = ownedNodes.some(n => n.dragging);

    let SSL_Width;
    let SSL_Height;

    if (anyDragging) {
        const targetW = Math.max(currentContainerWidth, requiredOwnedWidth);
        const targetH = Math.max(currentContainerHeight, requiredOwnedHeight);
        SSL_Width = Math.min(maxSSL_W, Math.max(naturalW, targetW));
        SSL_Height = Math.min(maxSSL_H, Math.max(naturalH, targetH));
    } else {
        SSL_Width = Math.min(maxSSL_W, Math.max(naturalW, currentContainerWidth));
        SSL_Height = Math.min(maxSSL_H, Math.max(naturalH, currentContainerHeight));
    }

    return { SSL_Width, SSL_Height, ASL_Width: SSL_Width, ASL_Height: SSL_Height };
}
