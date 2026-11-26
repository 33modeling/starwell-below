// 저장: localStorage(실패해도 게임은 돈다)
export const SAVE_KEY = 'starwell-below-save-v1';
export const OPT_KEY = 'starwell-below-options-v1';

export function newSave() {
  return {
    version: 1, room: '2,3', saveRoom: '2,3', ab: {}, key: false, bosses: [], got: [], maxHp: 4, shot: 0,
    visited: ['2,3'], broken: {}, time: 0, deaths: 0, cleared: false, seenGates: [],
  };
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return null;
    return Object.assign(newSave(), s);
  } catch { return null; }
}
export function writeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
export function loadOptions() {
  try { return Object.assign({ sound: true }, JSON.parse(localStorage.getItem(OPT_KEY) || '{}')); } catch { return { sound: true }; }
}
export function writeOptions(o) { try { localStorage.setItem(OPT_KEY, JSON.stringify(o)); } catch {} }
