/**
 * Utility functions for checking and matching keyboard shortcuts and hotkeys.
 */

export function normalizeKeyStr(s) {
  if (!s || typeof s !== 'string') return '';
  return s.toLowerCase().replace(/\s+/g, '');
}

export const DEFAULT_HOTKEYS = {
  undo: ['Ctrl+Z', 'Alt+Z'],
  redo: ['Ctrl+Y', 'Ctrl+Shift+Z'],
  delete: ['Delete', 'Backspace'],
  copy: ['Ctrl+C'],
  paste: ['Ctrl+V'],
  selectAll: ['Ctrl+A'],
  rename: ['F2'],
  zoomIn: ['Ctrl++', 'Ctrl+='],
  zoomOut: ['Ctrl+-'],
  pan: ['Mouse 3'],
  contextMenu: ['Mouse 2'],
  multiSelect: ['Ctrl+Klik'],
  lassoSelect: ['Tažení', 'Shift+Tažení']
};

export function checkSingleHotkey(e, hotkeyStr) {
  if (!e || !hotkeyStr || typeof hotkeyStr !== 'string') return false;

  // Mouse buttons or non-keyboard descriptors are ignored by keyboard event checker
  const lowerStr = hotkeyStr.toLowerCase();
  if (lowerStr.startsWith('mouse') || lowerStr.includes('klik') || lowerStr.includes('tažení')) {
    return false;
  }

  let parts;
  let expectedKey;
  if (hotkeyStr.endsWith('++')) {
    parts = hotkeyStr.slice(0, -1).split('+');
    expectedKey = '+';
  } else {
    parts = hotkeyStr.split('+');
    expectedKey = parts[parts.length - 1].toLowerCase();
  }

  const needsCtrl = parts.includes('Ctrl');
  const needsShift = parts.includes('Shift');
  const needsAlt = parts.includes('Alt');

  const hasCtrl = Boolean(e.ctrlKey || e.metaKey);
  const hasShift = Boolean(e.shiftKey);
  const hasAlt = Boolean(e.altKey);

  if (needsCtrl !== hasCtrl || needsShift !== hasShift || needsAlt !== hasAlt) {
    return false;
  }

  let eventKey = e.key ? e.key.toLowerCase() : '';
  if (eventKey === ' ') eventKey = 'space';
  if (eventKey === '=' && (expectedKey === '+' || expectedKey === '=')) return true;

  // Direct key match
  if (eventKey === expectedKey) return true;

  // Key code fallback (e.g. 'KeyK' for 'k', 'Digit1' for '1')
  if (e.code && expectedKey.length === 1 && /^[a-z0-9]$/i.test(expectedKey)) {
    const codeLower = e.code.toLowerCase();
    if (codeLower === 'key' + expectedKey || codeLower === 'digit' + expectedKey) {
      return true;
    }
  }

  return false;
}

export function checkHotkey(e, hotkeyTarget) {
  if (!hotkeyTarget) return false;
  if (Array.isArray(hotkeyTarget)) {
    return hotkeyTarget.some(k => checkSingleHotkey(e, k));
  }
  return checkSingleHotkey(e, hotkeyTarget);
}

/**
 * Converts user-defined hotkey slot definitions (e.g. ['A'], ['Shift+Tažení'], ['Ctrl+A'])
 * into the format required by @xyflow/react's useKeyPress / selectionKeyCode.
 * Supports single keys, modifiers, digit codes, and Cartesian combinations.
 */
export function getReactFlowKeyCodes(slotsInput) {
  const slots = Array.isArray(slotsInput) ? slotsInput : (slotsInput ? [slotsInput] : []);
  const allCodes = [];

  slots.forEach(slot => {
    if (!slot || typeof slot !== 'string') return;
    
    let rawParts;
    if (slot.endsWith('++')) {
      rawParts = slot.slice(0, -1).split('+').map(p => p.trim()).filter(Boolean);
      rawParts.push('+');
    } else {
      rawParts = slot.split('+').map(p => p.trim()).filter(Boolean);
    }

    const keyParts = rawParts.filter(p => {
      const lp = p.toLowerCase();
      return lp !== 'tažení' && lp !== 'tazeni' && lp !== 'drag' && !lp.startsWith('mouse') && !lp.includes('klik');
    });

    if (keyParts.length === 0) return;

    const partVariants = keyParts.map(part => {
      const lower = part.toLowerCase();
      if (lower === 'ctrl' || lower === 'control') return ['Control', 'Meta'];
      if (lower === 'shift') return ['Shift'];
      if (lower === 'alt') return ['Alt'];
      if (lower === 'space' || lower === 'mezerník' || lower === 'mezernik' || part === ' ') return ['Space', ' '];
      if (part === '+') return ['+', 'Equal'];
      if (part === '-') return ['-', 'Minus'];
      if (part.length === 1 && /^[a-zA-Z]$/.test(part)) {
        const l = part.toLowerCase();
        const u = part.toUpperCase();
        return [l, u, `Key${u}`];
      }
      if (part.length === 1 && /^[0-9]$/.test(part)) {
        return [part, `Digit${part}`, `Numpad${part}`];
      }
      return [part, lower, part.toUpperCase()];
    });

    let product = partVariants[0];
    for (let i = 1; i < partVariants.length; i++) {
      const nextProduct = [];
      for (const p of product) {
        for (const v of partVariants[i]) {
          nextProduct.push(`${p}+${v}`);
        }
      }
      product = nextProduct;
    }

    allCodes.push(...product);
  });

  const unique = Array.from(new Set(allCodes));
  return unique.length > 0 ? unique : null;
}

/**
 * Checks if a keyboard event matches a lasso selection trigger.
 * Allows key-only lasso selection (e.g. holding 'a' or 'Shift' and moving the mouse across blocks)
 * without requiring the user to hold mouse1.
 */
export function isKeyLassoTrigger(e, lassoSelectSlots) {
  if (!e || !lassoSelectSlots) return false;
  const slots = Array.isArray(lassoSelectSlots) ? lassoSelectSlots : [lassoSelectSlots];

  return slots.some(slot => {
    if (!slot || typeof slot !== 'string') return false;

    // 1. Direct hotkey check (e.g. 'A', 'Shift+A')
    if (checkSingleHotkey(e, slot)) return true;

    // 2. Extract keyboard key parts from combinations with mouse/drag descriptors (e.g. 'Shift+Tažení')
    let rawParts;
    if (slot.endsWith('++')) {
      rawParts = slot.slice(0, -1).split('+').map(p => p.trim()).filter(Boolean);
      rawParts.push('+');
    } else {
      rawParts = slot.split('+').map(p => p.trim()).filter(Boolean);
    }

    const keyParts = rawParts.filter(p => {
      const lp = p.toLowerCase();
      return lp !== 'tažení' && lp !== 'tazeni' && lp !== 'drag' && !lp.startsWith('mouse') && !lp.includes('klik');
    });

    if (keyParts.length === 0) return false;

    // If keyParts is a bare modifier, e.g. ['Shift'], match if that modifier is active/pressed
    if (keyParts.length === 1) {
      const part = keyParts[0].toLowerCase();
      if (part === 'shift') return e.key === 'Shift' || e.shiftKey;
      if (part === 'ctrl' || part === 'control') return e.key === 'Control' || e.ctrlKey || e.metaKey;
      if (part === 'alt') return e.key === 'Alt' || e.altKey;
    }

    const hotkeyWithoutMouse = keyParts.join('+');
    return checkSingleHotkey(e, hotkeyWithoutMouse);
  });
}
