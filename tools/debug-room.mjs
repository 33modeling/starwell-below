// 방 하나를 찍어 보고 능력별 도달 결과를 본다: node tools/debug-room.mjs 11,2 [시도번호]
import { ORDER, RoomSolver } from './solver.mjs';
const id = process.argv[2];
process.env.SW_DEBUG = id;
const m = await import('./build-world.mjs');
const def = m.debugMake(id, Number(process.argv[3] || 0));
for (let r = 0; r < 17; r++) console.log(String(r).padStart(2), def.tiles.slice(r * 30, r * 30 + 30));
console.log(JSON.stringify(def.doors), JSON.stringify(def.items));
const FULL = Object.fromEntries([...ORDER, 'key'].map((k) => [k, true]));
for (const drop of [null, ...ORDER]) {
  const ab = { ...FULL }; if (drop) delete ab[drop];
  const S = new RoomSolver(def, ab, { bossDone: () => true });
  const out = [];
  for (const s of Object.keys(def.doors)) { const r = S.reach(s); out.push(`${s}→[${[...r.exits]}] items[${[...r.items]}] st${r.states}`); }
  console.log('without', drop, out.join('  '));
}
