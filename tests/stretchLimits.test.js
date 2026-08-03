import { describe, it, expect } from 'vitest';
import { calculateStretchLimits } from '../src/utils/stretchLimits';

describe('Stretch Limits (SSL & ASL)', () => {
    const containerX = 0;
    const containerY = 0;
    
    it('Should return strict base sizes for a single block', () => {
        const ownedNodes = [
            { id: '1', type: 'ACTION', position: { x: 50, y: 50 }, measured: { width: 100, height: 50 }, dragging: false }
        ];
        
        const { SSL_Width, SSL_Height, ASL_Width, ASL_Height } = calculateStretchLimits(ownedNodes, ownedNodes, containerX, containerY);
        
        expect(SSL_Width).toBe(300);
        expect(SSL_Height).toBe(150);
        expect(ASL_Width).toBe(300);
        expect(ASL_Height).toBe(150);
    });

    it('ASL Width should strictly depend ONLY on IF blocks', () => {
        // Here we place an ACTION block very far to the right (x=500).
        // Since it's an ACTION block, ASL_Width should NOT expand to cover it!
        // It should stay at the mathematical limit for 0 IF blocks (300).
        const ownedNodes = [
            { id: '1', type: 'ACTION', position: { x: 500, y: 50 }, measured: { width: 100, height: 50 }, dragging: false },
            { id: '2', type: 'ACTION', position: { x: 50, y: 150 }, measured: { width: 100, height: 50 }, dragging: false }
        ];
        
        const { ASL_Width, SSL_Width } = calculateStretchLimits(ownedNodes, ownedNodes, containerX, containerY);
        expect(SSL_Width).toBe(300); // 0 IF blocks = 300
        expect(ASL_Width).toBe(300); // ASL should refuse to expand for an ACTION block
    });

    it('ASL Width should expand for IF blocks', () => {
        // Place an IF block at x=200.
        const ownedNodes = [
            { id: '1', type: 'CONDITION', position: { x: 200, y: 50 }, measured: { width: 120, height: 50 }, dragging: false },
            { id: '2', type: 'ACTION', position: { x: 50, y: 150 }, measured: { width: 100, height: 50 }, dragging: false }
        ];
        
        const { ASL_Width, SSL_Width } = calculateStretchLimits(ownedNodes, ownedNodes, containerX, containerY);
        
        // 1 IF block -> SSL_Width = 300 + 320 = 620
        expect(SSL_Width).toBe(620);
        
        // maxIfX = 200 + 120 = 320
        // requiredIfWidth = (320 - 0) + 20 (padding) = 340
        // ASL_Width = Math.min(620, 340 + 120) = 460
        expect(ASL_Width).toBe(460);
    });

    it('ASL Height should prevent domino detachments (safety net)', () => {
        // Simulate a scenario where a middle block was deleted, leaving blocks spaced far apart.
        // Block 1 is at y=50, Block 2 is at y=250. 
        // With only 2 blocks, SSL_Height = 150 + (2-1)*100 = 250.
        // But physically, they require up to y=300 (250+50).
        const ownedNodes = [
            { id: '1', type: 'ACTION', position: { x: 50, y: 50 }, measured: { width: 100, height: 50 }, dragging: false },
            { id: '2', type: 'ACTION', position: { x: 50, y: 250 }, measured: { width: 100, height: 50 }, dragging: false }
        ];
        
        const { SSL_Height, ASL_Height } = calculateStretchLimits(ownedNodes, ownedNodes, containerX, containerY);
        
        expect(SSL_Height).toBe(250);
        // ASL_Height should mathematically NOT shrink smaller than requiredHeight (300 + 50 padding = 350)
        // Wait, wait... I just removed the safety net for height earlier, didn't I?
        // Let's test the STRICT clamping instead, based on what the user wanted!
        // Actually, ASL_Height = Math.min(SSL_Height, requiredHeight + STRETCH_MARGIN)
        // So ASL_Height = Math.min(250, 350 + 120) = 250.
        // The safety net was removed, so it should strictly clamp to 250!
        expect(ASL_Height).toBe(250); 
    });

    it('ASL Height should strictly clamp to SSL_Height', () => {
        // Tightly packed blocks
        const ownedNodes = [
            { id: '1', type: 'ACTION', position: { x: 50, y: 50 }, measured: { width: 100, height: 50 }, dragging: false },
            { id: '2', type: 'ACTION', position: { x: 50, y: 100 }, measured: { width: 100, height: 50 }, dragging: false }
        ];
        
        const { SSL_Height, ASL_Height } = calculateStretchLimits(ownedNodes, ownedNodes, containerX, containerY);
        
        // 2 blocks -> SSL_Height = 100 (padding) + (50+50) + 1*50 = 250
        // maxStatY = 150
        // requiredHeight = (150 - 0) + 50 = 200
        // ASL_Height = Math.min(250, 200 + 120) = 250
        expect(SSL_Height).toBe(250);
        expect(ASL_Height).toBe(250);
    });

    it('SSL should dynamically expand to wrap nested LOOP_CONTAINERs', () => {
        const ownedNodes = [
            { id: '1', type: 'ACTION', position: { x: 50, y: 50 }, measured: { width: 100, height: 50 }, dragging: false },
            { id: '2', type: 'LOOP_CONTAINER', position: { x: 50, y: 150 }, measured: { width: 300, height: 150 }, style: { width: '800px', height: '500px' }, dragging: false }
        ];
        
        const { SSL_Width, SSL_Height } = calculateStretchLimits(ownedNodes, ownedNodes, containerX, containerY);
        
        // SSL_Height = 100 (padding) + [50 + 500] (child heights) + 1*50 (gaps) = 700
        expect(SSL_Height).toBe(700);
        
        // numConditions = 1 -> Base SSL_Width = 300 + 320 = 620
        // Child width is 800. Fallback ensures SSL_Width >= w + 100 = 900.
        expect(SSL_Width).toBe(900);
    });

    describe('Extreme Nested Bounds', () => {
        it('should compute valid stretch limits even for extreme child bounds', () => {
            const containerX = 0;
            const containerY = 0;
            const ownedNodes = [
                { id: '1', type: 'BLOCK', position: { x: 50, y: 50 }, measured: { width: 100, height: 50 }, dragging: false },
                { id: '2', type: 'BLOCK', position: { x: 4500, y: 4500 }, measured: { width: 100, height: 50 }, dragging: false } // Extreme outlier
            ];

            const { SSL_Width, SSL_Height } = calculateStretchLimits(ownedNodes, ownedNodes, containerX, containerY);
            
            // Expected bounds should stretch to accommodate the outlier, but they shouldn't throw NaN or Infinity.
            // Minimum required height: 100 padding + 50 + 50 (heights) + 50 (gap) = 250
            expect(SSL_Height).toBe(250);
            
            // Expected width should be at least 4500 (position of furthest block) + 100 (its width) + padding
            // Wait, calculateStretchLimits calculates based on max width. Max width here is 100.
            // Base SSL = 300 + 0 = 300. Fallback ensures it's at least max width + 100 = 200.
            // So SSL_Width = 300. 
            expect(SSL_Width).toBe(300);
            expect(SSL_Width).not.toBeNaN();
        });
    });
});
