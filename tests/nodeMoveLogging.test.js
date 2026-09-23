import { describe, it, expect, vi } from 'vitest';

/**
 * Pure simulation of the node movement logging logic implemented in diagramEditor.jsx
 */
function recordNodeMovements({
  dragStartMap,
  draggedNodes,
  activeNode,
  snappedPositions = new Map(),
  onLogAction,
  getNode = null
}) {
  if (!dragStartMap || !onLogAction) return;

  const movedNodes = [];
  draggedNodes.forEach(dn => {
    if (dn.type === 'GROUP_BG') return;
    const fromPos = dragStartMap.get(dn.id);
    if (!fromPos) return;

    let toX = dn.position.x;
    let toY = dn.position.y;
    if (snappedPositions.has(dn.id)) {
      const sp = snappedPositions.get(dn.id);
      toX = sp.x;
      toY = sp.y;
    } else if (dn.data?.morphOffset) {
      toX += dn.data.morphOffset.x;
      toY += dn.data.morphOffset.y;
    } else if (dn.id === activeNode?.id && activeNode?.position) {
      toX = activeNode.position.x;
      toY = activeNode.position.y;
    } else if (getNode) {
      const rfNode = getNode(dn.id);
      if (rfNode?.position) {
        toX = rfNode.position.x;
        toY = rfNode.position.y;
      }
    }

    const from = { x: Math.round(fromPos.x), y: Math.round(fromPos.y) };
    const to = { x: Math.round(toX), y: Math.round(toY) };

    if (from.x !== to.x || from.y !== to.y) {
      movedNodes.push({
        id: dn.id,
        type: dn.type,
        label: dn.data?.label || '',
        from,
        to
      });
    }
  });

  if (movedNodes.length === 1) {
    onLogAction('NODE_MOVED', {
      id: movedNodes[0].id,
      type: movedNodes[0].type,
      label: movedNodes[0].label,
      from: movedNodes[0].from,
      to: movedNodes[0].to
    });
  } else if (movedNodes.length > 1) {
    onLogAction('NODES_MOVED', {
      count: movedNodes.length,
      nodes: movedNodes
    });
  }
}

describe('Node Movement Action Logging', () => {
  it('logs NODE_MOVED when a single action block is moved to a new position', () => {
    const onLogAction = vi.fn();
    const dragStartMap = new Map([
      ['node_1', { x: 100, y: 150 }]
    ]);

    const activeNode = {
      id: 'node_1',
      type: 'ACTION',
      data: { label: 'x = x + 1' },
      position: { x: 220, y: 340 }
    };

    recordNodeMovements({
      dragStartMap,
      draggedNodes: [activeNode],
      activeNode,
      onLogAction
    });

    expect(onLogAction).toHaveBeenCalledTimes(1);
    expect(onLogAction).toHaveBeenCalledWith('NODE_MOVED', {
      id: 'node_1',
      type: 'ACTION',
      label: 'x = x + 1',
      from: { x: 100, y: 150 },
      to: { x: 220, y: 340 }
    });
  });

  it('does NOT log if node position has not changed (click without drag)', () => {
    const onLogAction = vi.fn();
    const dragStartMap = new Map([
      ['node_1', { x: 100, y: 150 }]
    ]);

    const activeNode = {
      id: 'node_1',
      type: 'ACTION',
      data: { label: 'Operace' },
      position: { x: 100, y: 150 }
    };

    recordNodeMovements({
      dragStartMap,
      draggedNodes: [activeNode],
      activeNode,
      onLogAction
    });

    expect(onLogAction).not.toHaveBeenCalled();
  });

  it('logs NODES_MOVED when multiple selected blocks are moved together', () => {
    const onLogAction = vi.fn();
    const dragStartMap = new Map([
      ['node_1', { x: 100, y: 100 }],
      ['node_2', { x: 100, y: 200 }]
    ]);

    const draggedNodes = [
      {
        id: 'node_1',
        type: 'CONDITION',
        data: { label: 'x > 0' },
        position: { x: 180, y: 120 }
      },
      {
        id: 'node_2',
        type: 'ACTION',
        data: { label: 'y = 1' },
        position: { x: 180, y: 220 }
      }
    ];

    recordNodeMovements({
      dragStartMap,
      draggedNodes,
      activeNode: draggedNodes[0],
      onLogAction
    });

    expect(onLogAction).toHaveBeenCalledTimes(1);
    expect(onLogAction).toHaveBeenCalledWith('NODES_MOVED', {
      count: 2,
      nodes: [
        {
          id: 'node_1',
          type: 'CONDITION',
          label: 'x > 0',
          from: { x: 100, y: 100 },
          to: { x: 180, y: 120 }
        },
        {
          id: 'node_2',
          type: 'ACTION',
          label: 'y = 1',
          from: { x: 100, y: 200 },
          to: { x: 180, y: 220 }
        }
      ]
    });
  });

  it('records snapped position as final position when a block snaps into a container', () => {
    const onLogAction = vi.fn();
    const dragStartMap = new Map([
      ['node_1', { x: 300, y: 300 }]
    ]);

    const activeNode = {
      id: 'node_1',
      type: 'IO',
      data: { label: 'Vstup x' },
      position: { x: 450, y: 550 }
    };

    const snappedPositions = new Map([
      ['node_1', { x: 400, y: 500 }]
    ]);

    recordNodeMovements({
      dragStartMap,
      draggedNodes: [activeNode],
      activeNode,
      snappedPositions,
      onLogAction
    });

    expect(onLogAction).toHaveBeenCalledTimes(1);
    expect(onLogAction).toHaveBeenCalledWith('NODE_MOVED', {
      id: 'node_1',
      type: 'IO',
      label: 'Vstup x',
      from: { x: 300, y: 300 },
      to: { x: 400, y: 500 }
    });
  });

  it('ignores GROUP_BG decorative nodes from being logged as moved blocks', () => {
    const onLogAction = vi.fn();
    const dragStartMap = new Map([
      ['bg_1', { x: 50, y: 50 }]
    ]);

    const bgNode = {
      id: 'bg_1',
      type: 'GROUP_BG',
      data: {},
      position: { x: 70, y: 70 }
    };

    recordNodeMovements({
      dragStartMap,
      draggedNodes: [bgNode],
      activeNode: bgNode,
      onLogAction
    });

    expect(onLogAction).not.toHaveBeenCalled();
  });
});
