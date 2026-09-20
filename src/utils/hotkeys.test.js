import { describe, it, expect } from 'vitest';
import { getReactFlowKeyCodes, checkHotkey, checkSingleHotkey, isKeyLassoTrigger } from './hotkeys';

describe('getReactFlowKeyCodes', () => {
  it('should convert single letter key "A" to lowercase, uppercase, and KeyA code', () => {
    const res = getReactFlowKeyCodes(['A']);
    expect(res).toEqual(expect.arrayContaining(['a', 'A', 'KeyA']));
    expect(res?.length).toBe(3);
  });

  it('should convert lowercase letter key "a" to lowercase, uppercase, and KeyA code', () => {
    const res = getReactFlowKeyCodes(['a']);
    expect(res).toEqual(expect.arrayContaining(['a', 'A', 'KeyA']));
    expect(res?.length).toBe(3);
  });

  it('should handle Shift + letter key like "Shift + A"', () => {
    const res = getReactFlowKeyCodes(['Shift + A']);
    expect(res).toEqual(expect.arrayContaining([
      'Shift+a',
      'Shift+A',
      'Shift+KeyA'
    ]));
  });

  it('should translate Ctrl to Control and Meta for React Flow', () => {
    const res = getReactFlowKeyCodes(['Ctrl + A']);
    expect(res).toEqual(expect.arrayContaining([
      'Control+a',
      'Control+A',
      'Control+KeyA',
      'Meta+a',
      'Meta+A',
      'Meta+KeyA'
    ]));
  });

  it('should filter out pure drag strings like "Tažení" or "drag"', () => {
    expect(getReactFlowKeyCodes(['Tažení'])).toBeNull();
    expect(getReactFlowKeyCodes(['drag'])).toBeNull();
    expect(getReactFlowKeyCodes(['Mouse 1'])).toBeNull();
  });

  it('should extract key from modifier + drag combinations like "Shift+Tažení"', () => {
    const res = getReactFlowKeyCodes(['Shift+Tažení']);
    expect(res).toEqual(['Shift']);
  });

  it('should extract key from "Ctrl+Klik"', () => {
    const res = getReactFlowKeyCodes(['Ctrl+Klik']);
    expect(res).toEqual(['Control', 'Meta']);
  });

  it('should handle Space and Mezerník keys', () => {
    const res1 = getReactFlowKeyCodes(['Space']);
    expect(res1).toEqual(expect.arrayContaining(['Space', ' ']));

    const res2 = getReactFlowKeyCodes(['Mezerník']);
    expect(res2).toEqual(expect.arrayContaining(['Space', ' ']));
  });

  it('should handle multiple slots simultaneously', () => {
    const res = getReactFlowKeyCodes(['A', 'Shift+Tažení']);
    expect(res).toEqual(expect.arrayContaining(['a', 'A', 'KeyA', 'Shift']));

    const res2 = getReactFlowKeyCodes(['Tažení', 'Shift+Tažení']);
    expect(res2).toEqual(['Shift']);
  });

  it('should handle empty or invalid inputs gracefully', () => {
    expect(getReactFlowKeyCodes(null)).toBeNull();
    expect(getReactFlowKeyCodes([])).toBeNull();
    expect(getReactFlowKeyCodes([''])).toBeNull();
  });
});

describe('checkHotkey and checkSingleHotkey', () => {
  it('should match single letter hotkey without modifiers', () => {
    const eventA = { key: 'a', code: 'KeyA', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
    expect(checkHotkey(eventA, ['A'])).toBe(true);
    expect(checkHotkey(eventA, ['B'])).toBe(false);
  });

  it('should match combination hotkey with Ctrl', () => {
    const eventCtrlA = { key: 'a', code: 'KeyA', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
    expect(checkHotkey(eventCtrlA, ['Ctrl+A'])).toBe(true);
    expect(checkHotkey(eventCtrlA, ['A'])).toBe(false);
  });
});

describe('isKeyLassoTrigger', () => {
  it('should trigger for single letter key like "A" or "a"', () => {
    const eventA = { key: 'a', code: 'KeyA', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
    expect(isKeyLassoTrigger(eventA, ['A'])).toBe(true);
    expect(isKeyLassoTrigger(eventA, ['a'])).toBe(true);

    const eventB = { key: 'b', code: 'KeyB', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
    expect(isKeyLassoTrigger(eventB, ['A'])).toBe(false);
  });

  it('should not trigger for letter key when Ctrl is pressed (avoiding Select All conflict)', () => {
    const eventCtrlA = { key: 'a', code: 'KeyA', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
    expect(isKeyLassoTrigger(eventCtrlA, ['A'])).toBe(false);
  });

  it('should trigger for Shift when configured as Shift+Tažení', () => {
    const eventShift = { key: 'Shift', code: 'ShiftLeft', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false };
    expect(isKeyLassoTrigger(eventShift, ['Shift+Tažení'])).toBe(true);
    expect(isKeyLassoTrigger(eventShift, ['Tažení', 'Shift+Tažení'])).toBe(true);
  });

  it('should return false for pure mouse descriptors like "Tažení"', () => {
    const eventA = { key: 'a', code: 'KeyA', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
    expect(isKeyLassoTrigger(eventA, ['Tažení'])).toBe(false);
  });
});
