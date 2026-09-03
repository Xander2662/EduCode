/**
 * Utility functions for checking and matching keyboard shortcuts and hotkeys.
 */

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
