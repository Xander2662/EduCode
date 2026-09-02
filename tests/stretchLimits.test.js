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

    it('should dynamically expand limits based on actual physical overlap (simpler mathematical bounding)', () => {
        const ownedNodes = [
            { id: '1', type: 'PROCESS', position: { x: 500, y: 300 }, measured: { width: 100, height: 50 } }
        ];
        const stationaryNodes = [...ownedNodes];
        
        const result = calculateStretchLimits(ownedNodes, stationaryNodes, 0, 0);
        
        expect(result.SSL_Width).toBe(635);
        expect(result.SSL_Height).toBe(385);
    });
});
