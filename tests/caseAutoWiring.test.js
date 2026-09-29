import { describe, it, expect } from 'vitest';
import { syncCaseAutoWiring } from '../src/components/diagramEditor.jsx';

describe('syncCaseAutoWiring live registration during drag', () => {
  const switchNode = {
    id: 'switch_1',
    type: 'SWITCH_CONTAINER',
    position: { x: 100, y: 100 },
    measured: { width: 600, height: 300 },
    style: { width: 600, height: 300 }
  };

  const case1 = {
    id: 'case_1',
    type: 'CASE_CONTAINER',
    parentId: 'switch_1',
    position: { x: 15, y: 44 }, // abs: 115, 144
    measured: { width: 250, height: 166 },
    style: { width: 250, height: 166 }
  };

  const case2 = {
    id: 'case_2',
    type: 'CASE_CONTAINER',
    parentId: 'switch_1',
    position: { x: 280, y: 44 }, // abs: 380, 144
    measured: { width: 250, height: 166 },
    style: { width: 250, height: 166 }
  };

  it('wires Case 1 to block when block is inside Case 1 and not dragging', () => {
    const block = {
      id: 'block_1',
      type: 'ACTION',
      parentId: 'case_1',
      position: { x: 30, y: 60 },
      measured: { width: 100, height: 50 }
    };

    const allNodes = [switchNode, case1, case2, block];
    let edges = [];

    edges = syncCaseAutoWiring(case1, allNodes, edges, 'straight');
    expect(edges).toHaveLength(2);
    expect(edges.some(e => e.source === 'case_1' && e.target === 'block_1' && e.sourceHandle === 's-top')).toBe(true);
    expect(edges.some(e => e.source === 'block_1' && e.target === 'case_1' && e.targetHandle === 't-bottom')).toBe(true);

    // Case 2 should have no edges
    edges = syncCaseAutoWiring(case2, allNodes, edges, 'straight');
    expect(edges.filter(e => e.source === 'case_2' || e.target === 'case_2')).toHaveLength(0);
  });

  it('registers disconnect from Case 1 and connect to Case 2 while block is dragging into Case 2', () => {
    // Block still has parentId: 'case_1', but is actively dragged into Case 2 bounds (e.g. abs x: 420, y: 200)
    const draggingBlock = {
      id: 'block_1',
      type: 'ACTION',
      parentId: 'case_1', // Stale parentId while dragging
      dragging: true,
      positionAbsolute: { x: 420, y: 200 }, // Geometrically inside Case 2 (abs [380..630], [144..310])
      position: { x: 305, y: 56 },
      measured: { width: 100, height: 50 }
    };

    const allNodes = [switchNode, case1, case2, draggingBlock];
    let edges = [
      { id: 'old_e1', source: 'case_1', target: 'block_1', sourceHandle: 's-top', targetHandle: 't-top' },
      { id: 'old_e2', source: 'block_1', target: 'case_1', sourceHandle: 's-bottom', targetHandle: 't-bottom' }
    ];

    // Case 1 sync while block is dragging over Case 2
    edges = syncCaseAutoWiring(case1, allNodes, edges, 'straight');
    // Case 1 should have disconnected!
    expect(edges.filter(e => e.source === 'case_1' || e.target === 'case_1')).toHaveLength(0);

    // Case 2 sync while block is dragging over Case 2
    edges = syncCaseAutoWiring(case2, allNodes, edges, 'straight');
    // Case 2 should have connected!
    expect(edges.some(e => e.source === 'case_2' && e.target === 'block_1' && e.sourceHandle === 's-top')).toBe(true);
    expect(edges.some(e => e.source === 'block_1' && e.target === 'case_2' && e.targetHandle === 't-bottom')).toBe(true);
  });

  it('registers disconnect from Case 1 when dragging block into canvas space outside switch', () => {
    const draggingBlock = {
      id: 'block_1',
      type: 'ACTION',
      parentId: 'case_1',
      dragging: true,
      positionAbsolute: { x: 800, y: 500 }, // Far outside all switch cases
      position: { x: 685, y: 356 },
      measured: { width: 100, height: 50 }
    };

    const allNodes = [switchNode, case1, case2, draggingBlock];
    let edges = [
      { id: 'old_e1', source: 'case_1', target: 'block_1', sourceHandle: 's-top', targetHandle: 't-top' },
      { id: 'old_e2', source: 'block_1', target: 'case_1', sourceHandle: 's-bottom', targetHandle: 't-bottom' }
    ];

    edges = syncCaseAutoWiring(case1, allNodes, edges, 'straight');
    expect(edges.filter(e => e.source === 'case_1' || e.target === 'case_1')).toHaveLength(0);

    edges = syncCaseAutoWiring(case2, allNodes, edges, 'straight');
    expect(edges.filter(e => e.source === 'case_2' || e.target === 'case_2')).toHaveLength(0);
  });

  it('purges cross-case edges when a block moves into another case', () => {
    const draggingBlock = {
      id: 'block_1',
      type: 'ACTION',
      parentId: 'case_1',
      dragging: true,
      positionAbsolute: { x: 420, y: 200 },
      position: { x: 305, y: 56 },
      measured: { width: 100, height: 50 }
    };

    const case1StaticBlock = {
      id: 'block_c1',
      type: 'ACTION',
      parentId: 'case_1',
      position: { x: 30, y: 60 },
      measured: { width: 100, height: 50 }
    };

    const allNodes = [switchNode, case1, case2, draggingBlock, case1StaticBlock];
    let edges = [
      // A stale cross-case edge between block_c1 in Case 1 and draggingBlock now in Case 2
      { id: 'cross_edge', source: 'block_c1', target: 'block_1', sourceHandle: 's-bottom', targetHandle: 't-top' }
    ];

    edges = syncCaseAutoWiring(case2, allNodes, edges, 'straight');
    // cross_edge should be pruned because block_c1 belongs to case_1 and block_1 belongs to case_2
    expect(edges.some(e => e.id === 'cross_edge')).toBe(false);
  });

  it('supports CONDITION blocks with dual true/false exit edges to case lower handle', () => {
    const condBlock = {
      id: 'cond_1',
      type: 'CONDITION',
      parentId: 'case_1',
      position: { x: 30, y: 60 },
      measured: { width: 100, height: 50 },
      data: { isSwapped: false }
    };

    const allNodes = [switchNode, case1, condBlock];
    let edges = [];

    edges = syncCaseAutoWiring(case1, allNodes, edges, 'true-false');
    expect(edges.some(e => e.source === 'case_1' && e.target === 'cond_1' && e.sourceHandle === 's-top')).toBe(true);
    expect(edges.some(e => e.source === 'cond_1' && e.target === 'case_1' && e.sourceHandle === 's-bottom' && e.targetHandle === 't-bottom')).toBe(true);
    expect(edges.some(e => e.source === 'cond_1' && e.target === 'case_1' && e.sourceHandle === 's-right' && e.targetHandle === 't-bottom')).toBe(true);
  });
});
