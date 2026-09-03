import { describe, it, expect } from 'vitest';
import { checkSingleHotkey, checkHotkey } from '../src/utils/hotkeys';

describe('Hotkeys utility - checkSingleHotkey & checkHotkey', () => {
  it('correctly matches single-letter shortcuts like "K"', () => {
    const eventK = { key: 'k', code: 'KeyK', ctrlKey: false, shiftKey: false, altKey: false };
    expect(checkSingleHotkey(eventK, 'K')).toBe(true);
    expect(checkSingleHotkey(eventK, 'k')).toBe(true);

    const eventX = { key: 'x', code: 'KeyX', ctrlKey: false, shiftKey: false, altKey: false };
    expect(checkSingleHotkey(eventX, 'K')).toBe(false);
  });

  it('correctly matches multi-slot arrays such as contextMenu ["Mouse 2", "K"]', () => {
    const eventK = { key: 'k', code: 'KeyK', ctrlKey: false, shiftKey: false, altKey: false };
    expect(checkHotkey(eventK, ['Mouse 2', 'K'])).toBe(true);

    const eventOther = { key: 'j', code: 'KeyJ', ctrlKey: false, shiftKey: false, altKey: false };
    expect(checkHotkey(eventOther, ['Mouse 2', 'K'])).toBe(false);
  });

  it('safely ignores mouse gestures during keyboard event evaluation', () => {
    const eventK = { key: 'k', code: 'KeyK', ctrlKey: false, shiftKey: false, altKey: false };
    expect(checkSingleHotkey(eventK, 'Mouse 2')).toBe(false);
    expect(checkSingleHotkey(eventK, 'Mouse 3')).toBe(false);
    expect(checkSingleHotkey(eventK, 'Ctrl+Klik')).toBe(false);
    expect(checkSingleHotkey(eventK, 'Shift+Tažení')).toBe(false);
  });

  it('correctly matches undo & redo shortcuts', () => {
    const ctrlZ = { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: false, altKey: false };
    const altZ = { key: 'z', code: 'KeyZ', ctrlKey: false, shiftKey: false, altKey: true };
    const ctrlY = { key: 'y', code: 'KeyY', ctrlKey: true, shiftKey: false, altKey: false };
    const ctrlShiftZ = { key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true, altKey: false };

    expect(checkHotkey(ctrlZ, ['Ctrl+Z', 'Alt+Z'])).toBe(true);
    expect(checkHotkey(altZ, ['Ctrl+Z', 'Alt+Z'])).toBe(true);
    expect(checkHotkey(ctrlY, ['Ctrl+Y', 'Ctrl+Shift+Z'])).toBe(true);
    expect(checkHotkey(ctrlShiftZ, ['Ctrl+Y', 'Ctrl+Shift+Z'])).toBe(true);
  });

  it('correctly matches rename "F2"', () => {
    const eventF2 = { key: 'F2', code: 'F2', ctrlKey: false, shiftKey: false, altKey: false };
    expect(checkHotkey(eventF2, 'F2')).toBe(true);
    expect(checkHotkey(eventF2, ['F2'])).toBe(true);
  });

  it('correctly matches delete ["Delete", "Backspace"]', () => {
    const delEvent = { key: 'Delete', code: 'Delete', ctrlKey: false, shiftKey: false, altKey: false };
    const backEvent = { key: 'Backspace', code: 'Backspace', ctrlKey: false, shiftKey: false, altKey: false };

    expect(checkHotkey(delEvent, ['Delete', 'Backspace'])).toBe(true);
    expect(checkHotkey(backEvent, ['Delete', 'Backspace'])).toBe(true);
  });

  it('correctly matches Zoom In ("Ctrl++", "Ctrl+=") and Zoom Out ("Ctrl+-")', () => {
    const zoomInPlus = { key: '+', code: 'Equal', ctrlKey: true, shiftKey: false, altKey: false };
    const zoomInEqual = { key: '=', code: 'Equal', ctrlKey: true, shiftKey: false, altKey: false };
    const zoomOutMinus = { key: '-', code: 'Minus', ctrlKey: true, shiftKey: false, altKey: false };

    expect(checkHotkey(zoomInPlus, ['Ctrl++', 'Ctrl+='])).toBe(true);
    expect(checkHotkey(zoomInEqual, ['Ctrl++', 'Ctrl+='])).toBe(true);
    expect(checkHotkey(zoomOutMinus, ['Ctrl+-'])).toBe(true);
  });

  it('supports Czech keyboard layout code fallback', () => {
    // On Czech layout, pressing K might have key: 'k', but code is always 'KeyK'
    const eventCzechK = { key: 'k', code: 'KeyK', ctrlKey: false, shiftKey: false, altKey: false };
    expect(checkHotkey(eventCzechK, 'K')).toBe(true);
  });

  it('correctly matches selectAll, copy, and paste', () => {
    const ctrlA = { key: 'a', code: 'KeyA', ctrlKey: true, shiftKey: false, altKey: false };
    const ctrlC = { key: 'c', code: 'KeyC', ctrlKey: true, shiftKey: false, altKey: false };
    const ctrlV = { key: 'v', code: 'KeyV', ctrlKey: true, shiftKey: false, altKey: false };

    expect(checkHotkey(ctrlA, ['Ctrl+A'])).toBe(true);
    expect(checkHotkey(ctrlC, ['Ctrl+C'])).toBe(true);
    expect(checkHotkey(ctrlV, ['Ctrl+V'])).toBe(true);
  });

  it('correctly matches Space key for pan or custom actions', () => {
    const spaceEvent = { key: ' ', code: 'Space', ctrlKey: false, shiftKey: false, altKey: false };
    expect(checkHotkey(spaceEvent, ['Space'])).toBe(true);
  });
});
