import { describe, it, expect } from 'vitest';
import { calculateStretchLimits } from '../src/utils/stretchLimits';

describe('calculateStretchLimits', () => {
    it('should correctly calculate bounds for stationary nodes without dragging nodes', () => {
        const ownedNodes = [
            { id: '1', type: 'PROCESS', position: { x: 50, y: 50 }, measured: { width: 100, height: 50 } },
            { id: '2', type: 'PROCESS', position: { x: 200, y: 50 }, measured: { width: 100, height: 50 } }
        ];
        // Both are stationary
        const stationaryNodes = [...ownedNodes];
        
        const containerX = 0;
        const containerY = 0;
        
        const result = calculateStretchLimits(ownedNodes, stationaryNodes, containerX, containerY);
        
        expect(result.SSL_Width).toBe(335);
        expect(result.SSL_Height).toBe(150);
        expect(result.ASL_Width).toBe(335);
        expect(result.ASL_Height).toBe(150);
    });

    // DO NOT EDIT THIS TEST - IT IS MANDATORY TO PASS
    it('should calculate while group size when moving while group to the left with an action block at right edge', () => {
        const baseW = 350;
        const baseH = 200;
        const initialContainerX = 100;
        const initialContainerY = 100;

        // Create while group and action block at the most right edge of while group
        const actionBlock = {
            id: 'action1',
            type: 'ACTION',
            position: { x: 295, y: 150 },
            measured: { width: 120, height: 50 }
        };
        const ownedNodes = [actionBlock];
        const stationaryNodes = [actionBlock];

        // Initially at containerX = 100: (295 + 120 - 100) + 35 = 350
        const initialResult = calculateStretchLimits(ownedNodes, stationaryNodes, initialContainerX, initialContainerY, baseW, baseH, baseW, baseH);
        expect(initialResult.SSL_Width).toBe(350);
        expect(initialResult.ASL_Width).toBe(350);

        // Move while group to the left (e.g. to x = 50): (295 + 120 - 50) + 35 = 400
        const movedContainerX = 50;
        const movedResult = calculateStretchLimits(ownedNodes, stationaryNodes, movedContainerX, initialContainerY, baseW, baseH, baseW, baseH);

        expect(movedResult.SSL_Width).toBe(400);
        expect(movedResult.ASL_Width).toBe(400);
    });

    it('should calculate while group size when moving action block to the right edge within while group', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 100;
        const containerY = 100;

        // Create while group and action block at the most right edge of while group
        const actionBlock = {
            id: 'action1',
            type: 'ACTION',
            position: { x: 295, y: 150 },
            measured: { width: 120, height: 50 }
        };
        const ownedNodes = [actionBlock];
        const stationaryNodes = [actionBlock];

        // Initially at containerX = 100: (295 + 120 - 100) + 35 = 350
        const initialResult = calculateStretchLimits(ownedNodes, stationaryNodes, containerX, containerY, baseW, baseH, baseW, baseH);
        expect(initialResult.SSL_Width).toBe(350);
        expect(initialResult.ASL_Width).toBe(350);

        // Move the action block to the right (e.g. to x = 345): (345 + 120 - 100) + 35 = 400
        const movedActionBlock = {
            ...actionBlock,
            position: { x: 345, y: 150 }
        };
        const movedOwnedNodes = [movedActionBlock];
        const movedStationaryNodes = [movedActionBlock];

        const movedResult = calculateStretchLimits(movedOwnedNodes, movedStationaryNodes, containerX, containerY, baseW, baseH, baseW, baseH);

        expect(movedResult.SSL_Width).toBe(400);
        expect(movedResult.ASL_Width).toBe(400);
    });

    it('should not double-count nested container width in hardMaxW', () => {
        // Container inside container: stationary inner container at x=20, width=350
        const ownedNodes = [
            { id: 'inner', type: 'FOR_CONTAINER', position: { x: 20, y: 50 }, measured: { width: 350, height: 200 } }
        ];
        const stationaryNodes = [...ownedNodes];
        
        const result = calculateStretchLimits(ownedNodes, stationaryNodes, 0, 0, 350, 200);
        
        // 20 + 350 + 35 padding = 405. It should NOT be 405 + 350 = 755
        expect(result.SSL_Width).toBe(405);
    });

    it('should calculate size for action blocks inside FOR container based on requiredWidth', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 515;
        const containerY = 438;

        const block1 = {
            id: 'node_d7kn8',
            type: 'ACTION',
            position: { x: 609, y: 486 },
            measured: { width: 160, height: 50 }
        };
        const block2 = {
            id: 'node_2nbct',
            type: 'ACTION',
            position: { x: 776, y: 568 },
            measured: { width: 160, height: 50 }
        };

        const ownedNodes = [block1, block2];
        const stationaryNodes = [block1, block2];

        const result = calculateStretchLimits(ownedNodes, stationaryNodes, containerX, containerY, baseW, baseH, baseW, baseH);

        // Required width is (776 + 160 - 515) + 35 = 456
        expect(result.SSL_Width).toBe(456);
        expect(result.ASL_Width).toBe(456);
    });

    it('should calculate while group size when moving while group up with an action block at bottom edge', () => {
        const baseW = 350;
        const baseH = 200;
        const initialContainerX = 100;
        const initialContainerY = 100;

        // Create while group and action block at the bottom edge of while group
        const actionBlock = {
            id: 'action1',
            type: 'ACTION',
            position: { x: 150, y: 220 },
            measured: { width: 120, height: 50 }
        };
        const ownedNodes = [actionBlock];
        const stationaryNodes = [actionBlock];

        // Initially at containerY = 100: (220 + 50 - 100) + 35 = 205
        const initialResult = calculateStretchLimits(ownedNodes, stationaryNodes, initialContainerX, initialContainerY, baseW, baseH, baseW, baseH);
        expect(initialResult.SSL_Height).toBe(205);
        expect(initialResult.ASL_Height).toBe(205);

        // Move while group up (e.g. to y = 50): (220 + 50 - 50) + 35 = 255
        const movedContainerY = 50;
        const movedResult = calculateStretchLimits(ownedNodes, stationaryNodes, initialContainerX, movedContainerY, baseW, baseH, baseW, baseH);

        expect(movedResult.SSL_Height).toBe(255);
        expect(movedResult.ASL_Height).toBe(255);
    });

    it('should calculate while group size when moving action block to the bottom edge within while group', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 100;
        const containerY = 100;

        // Create while group and action block at bottom area of while group
        const actionBlock = {
            id: 'action1',
            type: 'ACTION',
            position: { x: 150, y: 220 },
            measured: { width: 120, height: 50 }
        };
        const ownedNodes = [actionBlock];
        const stationaryNodes = [actionBlock];

        // Initially at containerY = 100: (220 + 50 - 100) + 35 = 205
        const initialResult = calculateStretchLimits(ownedNodes, stationaryNodes, containerX, containerY, baseW, baseH, baseW, baseH);
        expect(initialResult.SSL_Height).toBe(205);
        expect(initialResult.ASL_Height).toBe(205);

        // Move the action block down (e.g. to y = 260): (260 + 50 - 100) + 35 = 245
        const movedActionBlock = {
            ...actionBlock,
            position: { x: 150, y: 260 }
        };
        const movedOwnedNodes = [movedActionBlock];
        const movedStationaryNodes = [movedActionBlock];

        const movedResult = calculateStretchLimits(movedOwnedNodes, movedStationaryNodes, containerX, containerY, baseW, baseH, baseW, baseH);

        expect(movedResult.SSL_Height).toBe(245);
        expect(movedResult.ASL_Height).toBe(245);
    });

    it('should cap vertical stretch to hardMaxH when blocks are dragged far down', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 100;
        const containerY = 100;

        const block1 = {
            id: 'b1',
            type: 'ACTION',
            position: { x: 150, y: 150 },
            measured: { width: 120, height: 50 }
        };
        const block2 = {
            id: 'b2',
            type: 'ACTION',
            position: { x: 150, y: 800 }, // Far below
            measured: { width: 120, height: 50 },
            dragging: true
        };
        const ownedNodes = [block1, block2];
        const stationaryNodes = [block1]; // block2 is being dragged

        const result = calculateStretchLimits(ownedNodes, stationaryNodes, containerX, containerY, baseW, baseH, baseW, baseH);

        // hardMaxH: Math.max(200, 135 + 120) = 255
        expect(result.SSL_Height).toBe(255);
        expect(result.ASL_Height).toBe(255);
    });

    it('should include condition block layout demand (+320px) in container width', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 593;
        const containerY = 475;

        const condBlock = {
            id: 'cond1',
            type: 'CONDITION',
            position: { x: 613, y: 505 },
            measured: { width: 160, height: 80 }
        };
        const actionBlock = {
            id: 'act1',
            type: 'ACTION',
            position: { x: 613, y: 600 },
            measured: { width: 160, height: 50 }
        };

        const ownedNodes = [condBlock, actionBlock];
        const stationaryNodes = [condBlock, actionBlock];

        const result = calculateStretchLimits(ownedNodes, stationaryNodes, containerX, containerY, baseW, baseH, baseW, baseH);

        // Condition block demands +320px: (613 + 160 + 320 - 593) + 35 = 535
        expect(result.SSL_Width).toBe(535);
        expect(result.ASL_Width).toBe(535);
    });

    it('should constrain dragging block within maxAllowedW when single node is dragged', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 100;
        const containerY = 100;

        const draggingBlock = {
            id: 'act1',
            type: 'ACTION',
            position: { x: 345, y: 150 },
            measured: { width: 120, height: 50 },
            dragging: true
        };

        // When currentContainerWidth is baseW (350), hardMaxW is 350
        const result = calculateStretchLimits([draggingBlock], [], containerX, containerY, baseW, baseH, baseW, baseH);
        expect(result.SSL_Width).toBe(350);
        expect(result.ASL_Width).toBe(350);

        // When currentContainerWidth is 400, maxAllowedW is 400
        const resultWithStretch = calculateStretchLimits([draggingBlock], [], containerX, containerY, baseW, baseH, 400, baseH);
        expect(resultWithStretch.SSL_Width).toBe(400);
        expect(resultWithStretch.ASL_Width).toBe(400);
    });

    it('should hold temporary okay stretch on drop so it does not aggressively snap', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 100;
        const containerY = 100;

        const droppedBlock = {
            id: 'act1',
            type: 'ACTION',
            position: { x: 345, y: 150 },
            measured: { width: 120, height: 50 },
            dragging: false
        };

        // Container was stretched to 400 during drag and is now committed at 400
        const result = calculateStretchLimits([droppedBlock], [droppedBlock], containerX, containerY, baseW, baseH, 400, baseH);

        // It must hold 400 as the okay stretch size, not aggressively snapping back to 350
        expect(result.SSL_Width).toBe(400);
        expect(result.ASL_Width).toBe(400);
    });

    it('should shrink runway to requiredOwnedWidth when block moves inward', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 100;
        const containerY = 100;

        // Block moved inward to x = 150 inside a 400px container
        const inwardBlock = {
            id: 'act1',
            type: 'ACTION',
            position: { x: 150, y: 150 },
            measured: { width: 120, height: 50 },
            dragging: true
        };

        const result = calculateStretchLimits([inwardBlock], [], containerX, containerY, baseW, baseH, 400, baseH);

        // runwayW is Math.max(350, (150 + 120 - 100) + 35) = 350
        expect(result.SSL_Width).toBe(350);
        expect(result.ASL_Width).toBe(350);
    });

    it('should stop overlapping when block is dragged past maximum stretch limit (maxAllowedW)', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 100;
        const containerY = 100;

        // Block dragged far to the right (x = 800)
        const farBlock = {
            id: 'act1',
            type: 'ACTION',
            position: { x: 800, y: 150 },
            measured: { width: 120, height: 50 },
            dragging: true
        };

        const result = calculateStretchLimits([farBlock], [], containerX, containerY, baseW, baseH, 400, baseH);

        // maxAllowedW is 400. It caps at 400
        expect(result.SSL_Width).toBe(400);
        expect(result.ASL_Width).toBe(400);
    });

    it('should NOT overlap anymore after drop and drag again at maximum stretch (anti-infinite stretch)', () => {
        const baseW = 350;
        const baseH = 200;
        const containerX = 100;
        const containerY = 100;

        // Block was dropped at max stretch (540)
        const droppedAtMax = {
            id: 'act1',
            type: 'ACTION',
            position: { x: 485, y: 150 },
            measured: { width: 120, height: 50 },
            dragging: false
        };
        const dropResult = calculateStretchLimits([droppedAtMax], [droppedAtMax], containerX, containerY, baseW, baseH, 540, baseH);
        expect(dropResult.SSL_Width).toBe(540);

        // User picks it up and drags it further to x = 800
        const draggedAgain = {
            ...droppedAtMax,
            position: { x: 800, y: 150 },
            dragging: true
        };
        const dragAgainResult = calculateStretchLimits([draggedAgain], [], containerX, containerY, baseW, baseH, 540, baseH);

        // It must NOT overlap any further. It stays capped at 540!
        expect(dragAgainResult.SSL_Width).toBe(540);
        expect(dragAgainResult.ASL_Width).toBe(540);
    });
});


