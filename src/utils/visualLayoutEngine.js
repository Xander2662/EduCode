export function calculateRestructuredLayout(draggedNodes, containerNode) {
    // 1. Sort nodes from top to bottom based on their original positions
    const sortedNodes = [...draggedNodes].sort((a, b) => a.position.y - b.position.y);
    
    // 2. Base coordinates (starting from the top-left of the container)
    // Note: If the container has absolute coordinates, these are relative to the container!
    // But React Flow nodes are absolute, so we calculate absolute positions.
    const startX = containerNode.position.x + 40;
    const startY = containerNode.position.y + 60;
    
    const nodeTargets = new Map();
    let currentY = startY;
    
    // Normalize X offsets to keep user's manual indentations but snapped to 150px
    const minX = Math.min(...sortedNodes.map(n => n.position.x));
    
    sortedNodes.forEach(n => {
        const userIndent = n.position.x - minX;
        const snappedIndent = Math.round(userIndent / 150) * 150;
        
        const targetX = startX + snappedIndent;
        const targetY = currentY;
        
        nodeTargets.set(n.id, { x: targetX, y: targetY });
        
        const h = n.type === 'CONDITION' ? 80 : 50;
        currentY += h + 30;
    });
    
    return nodeTargets;
}
