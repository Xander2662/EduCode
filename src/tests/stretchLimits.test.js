import { calculateStretchLimits } from '../utils/stretchLimits';

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
        
        // Max Stat X = 200 + 100 = 300
        // Max Stat Y = 50 + 50 = 100
        // Required Width = (300 - 0) + 20 (PADDING) = 320
        // Required Height = (100 - 0) + 50 (PADDING) = 150
        
        // SSL Width = max(300, 320 + 120) = 440
        // SSL Height = max(150, 150 + 100) = 250
        
        expect(result.SSL_Width).toBe(440);
        expect(result.SSL_Height).toBe(250);
        expect(result.ASL_Width).toBe(440);
        expect(result.ASL_Height).toBe(250);
    });

    it('should dynamically expand limits based on actual physical overlap (simpler mathematical bounding)', () => {
        const ownedNodes = [
            { id: '1', type: 'PROCESS', position: { x: 500, y: 300 }, measured: { width: 100, height: 50 } }
        ];
        const stationaryNodes = [...ownedNodes];
        
        const result = calculateStretchLimits(ownedNodes, stationaryNodes, 0, 0);
        
        // Max X = 600
        // Max Y = 350
        // Req Width = 620
        // Req Height = 400
        // SSL W = 620 + 120 = 740
        // SSL H = 400 + 100 = 500
        
        expect(result.SSL_Width).toBe(740);
        expect(result.SSL_Height).toBe(500);
    });
});
