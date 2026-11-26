// 능력 잠금 그래프 검사: 게임과 같은 물리로 동작 묶음을 흉내 내어
// (1) 시작 방에서 능력 순서대로 지도 전체·모든 물건·모든 보스에 닿고,
// (2) 능력 문은 그 능력 없이 못 지나고(방마다), (3) 어디서든 별돌 방으로 돌아갈 수 있는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, ROOM_BY_ID } from '../web/js/world.js';
import { progress, canReachSave, RoomSolver, ORDER } from '../tools/solver.mjs';
import { checkRoom } from '../tools/build-world.mjs';
import { BOSSES } from '../web/js/worldspec.js';

const rewards = Object.fromEntries(BOSSES.filter(Boolean).map((b) => [b.id, b.reward.item || (b.reward.kind === 'hp' ? `hp:boss${b.id}` : 'ending')]));
const R = progress(ROOMS, { bossRewards: rewards });
const phaseOf = (id) => R.phases.findIndex((p) => p.got.includes(id));

test('지도 전체(66방)와 모든 물건에 닿는다', () => {
  const missRooms = ROOMS.filter((r) => !R.visited.has(r.id)).map((r) => r.id);
  assert.deepEqual(missRooms, []);
  const missItems = ROOMS.flatMap((r) => r.items.map((i) => i.id)).filter((i) => !R.got.has(i));
  assert.deepEqual(missItems, []);
  for (const b of BOSSES.filter(Boolean)) assert.ok(R.bosses.has(b.id), `보스 ${b.id}`);
});

test('능력·보스는 설계한 순서대로만 열린다(건너뛰기 없음)', () => {
  const seq = ['climb', 'boss1', 'dash', 'boss2', 'swim', 'boss3', 'fire', 'boss4', 'boss5', 'boss6'];
  const ph = seq.map(phaseOf);
  for (let i = 0; i < seq.length; i++) assert.ok(ph[i] >= 0, `${seq[i]} 못 얻음`);
  for (let i = 1; i < seq.length; i++) assert.ok(ph[i] > ph[i - 1], `${seq[i - 1]}(${ph[i - 1]}) 다음에 ${seq[i]}(${ph[i]})`);
  // 보스 보상 능력은 보스와 같은 단계
  assert.equal(phaseOf('double'), phaseOf('boss2'));
  assert.equal(phaseOf('pound'), phaseOf('boss3'));
  assert.equal(phaseOf('key'), phaseOf('boss5'));
});

test('방마다 문 잠금·숨은 강화 잠금·들어온 문에서 나머지 문 닿기', () => {
  const bad = [];
  for (const def of ROOMS) {
    const pr = checkRoom(def, null);
    if (pr.length) bad.push(`${def.id}: ${pr.join('; ')}`);
  }
  assert.deepEqual(bad, []);
});

test('능력이 하나도 없으면 첫 지역 밖으로 못 나간다', () => {
  const zones = new Set();
  for (const p of R.phases.slice(0, 1)) for (const g of p.got) zones.add(g);
  const first = ROOMS.filter((r) => R.nodePhase.get(r.id + '|S') === 0 || [...R.nodePhase].some(([k, v]) => v === 0 && k.startsWith(r.id + '|')));
  assert.ok(first.every((r) => r.zone === 1), first.filter((r) => r.zone !== 1).map((r) => r.id).join(','));
});

test('갇힘 없음: 닿은 모든 자리에서 그때 능력만으로 별돌 방에 갈 수 있다', () => {
  const stuck = [];
  for (const [node, ph] of R.nodePhase) {
    const prev = ph > 0 ? R.phases[ph - 1] : { ab: {}, bosses: [] };
    if (!canReachSave(ROOMS, node, prev.ab, prev.bosses)) stuck.push(`${node}@${ph}`);
  }
  assert.deepEqual(stuck, []);
});
