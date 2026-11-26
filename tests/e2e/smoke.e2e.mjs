// 헤드리스 스모크: 첫 화면 → 새로 시작 → 진짜 키로 걷고 뛰어 옆 방으로 넘어가기 → 지도·멈춤 → 저장 확인 → 휴대폰 화면 규칙.
// ?manual=1 이면 판 시간은 advance(n) 로만 흐른다(늘 같은 결과).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { startServer } from './server.mjs';
import { launch, watchErrors } from './browser.mjs';

const SHOTS = new URL('../../shots/', import.meta.url).pathname;
const adv = (page, n) => page.evaluate((k) => window.__STARWELL__.advance(k), n);
const peek = (page) => page.evaluate(() => window.__STARWELL__.peek());
async function hold(page, key, frames) { await page.keyboard.down(key); await adv(page, frames); await page.keyboard.up(key); await adv(page, 1); }

test('첫 화면 → 새로 시작 → 키로 옆 방까지 → 지도·멈춤·저장', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  if (!browser) { t.skip('Playwright 없음(PLAYWRIGHT_MODULE 지정)'); return; }
  const srv = await startServer(0);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await page.goto(srv.url + '?manual=1');
    await page.waitForFunction(() => window.__STARWELL__ && window.__STARWELL__.scene === 'title');
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: SHOTS + 'title.png' });
    await page.click('#btn-new');
    assert.equal(await page.evaluate(() => window.__STARWELL__.scene), 'play');
    await adv(page, 30);
    let p = await peek(page);
    assert.equal(p.room, '2,3');
    assert.ok(p.onGround, '바닥에 섬');
    // 오른쪽으로 걸어 다음 방(3,3)으로. 길에 둔덕·가시가 있을 수 있어 가끔 점프
    await page.keyboard.down('ArrowRight');
    for (let i = 0; i < 80 && (await peek(page)).room === '2,3'; i++) {
      if (i % 6 === 0) { await page.keyboard.down('KeyZ'); await adv(page, 14); await page.keyboard.up('KeyZ'); }
      await adv(page, 6);
    }
    await page.keyboard.up('ArrowRight');
    p = await peek(page);
    assert.equal(p.room, '3,3', `방 넘기기 실패: ${JSON.stringify(p)}`);
    await adv(page, 20);
    await page.screenshot({ path: SHOTS + 'play.png' });
    // 쏘기
    await page.keyboard.down('KeyX'); await adv(page, 1); await page.keyboard.up('KeyX');
    assert.ok(await page.evaluate(() => window.__STARWELL__.game().shots.length >= 1));
    // 지도
    await page.keyboard.down('KeyM'); await adv(page, 2); await page.keyboard.up('KeyM'); await adv(page, 2);
    assert.equal(await page.evaluate(() => window.__STARWELL__.scene), 'map');
    await page.screenshot({ path: SHOTS + 'map.png' });
    await page.keyboard.down('KeyM'); await adv(page, 2); await page.keyboard.up('KeyM'); await adv(page, 2);
    assert.equal(await page.evaluate(() => window.__STARWELL__.scene), 'play');
    // 멈춤 메뉴
    await page.keyboard.down('Escape'); await adv(page, 2); await page.keyboard.up('Escape');
    assert.equal(await page.evaluate(() => window.__STARWELL__.scene), 'pause');
    assert.ok(await page.isVisible('#btn-warp'));
    await page.click('#btn-resume');
    // 저장: 방문 기록이 localStorage 에 남는다
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('starwell-below-save-v1')));
    assert.ok(saved.visited.includes('3,3'));
    // 다시 열면 이어하기
    await page.reload();
    await page.waitForFunction(() => window.__STARWELL__ && window.__STARWELL__.scene === 'title');
    assert.ok(await page.isVisible('#btn-continue'));
    await page.click('#btn-continue');
    assert.equal(await page.evaluate(() => window.__STARWELL__.room), '2,3');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await srv.close(); }
});

test('능력 문: 장갑을 얻으면 (2,3) 위 구멍으로 벽을 타고 올라간다, 보스 방에선 문이 닫힌다', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  if (!browser) { t.skip('Playwright 없음'); return; }
  const srv = await startServer(0);
  try {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 600 } })).newPage();
    const errors = watchErrors(page);
    await page.goto(srv.url + '?manual=1');
    await page.waitForFunction(() => window.__STARWELL__ && window.__STARWELL__.scene === 'title');
    await page.click('#btn-new');
    await page.evaluate(() => window.__STARWELL__.give('climb'));
    // 기둥(구멍 왼쪽 열) 바로 오른쪽에 서서 왼쪽+위로 벽 타기
    const col = await page.evaluate(() => window.__STARWELL__.game().def.doors.T.col);
    await page.evaluate((c) => { const g = window.__STARWELL__.game(); g.p.x = c * 16 + 1; g.p.y = 15 * 16 - 22.01; g.p.vx = 0; }, col);
    await adv(page, 2);
    await page.keyboard.down('KeyZ'); await adv(page, 8); await page.keyboard.up('KeyZ');
    await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowUp');
    for (let i = 0; i < 40 && (await peek(page)).room === '2,3'; i++) await adv(page, 10);
    await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
    assert.equal((await peek(page)).room, '2,2');
    // 보스 방 들어가기
    await page.evaluate(() => window.__STARWELL__.teleport('4,2', 'L'));
    await page.keyboard.down('ArrowRight'); await adv(page, 50); await page.keyboard.up('ArrowRight');
    const b = (await peek(page)).boss;
    assert.ok(b && b.locked && !b.dead, JSON.stringify(b));
    await adv(page, 60);
    await page.screenshot({ path: SHOTS + 'boss.png' });
    // 거의 쓰러뜨린 상태에서 쏘아 마무리 → 문이 열리고 보상이 나온다
    await page.evaluate(() => { const g = window.__STARWELL__.game(); g.boss.hp = 0.2; g.inv = 99; });
    for (let i = 0; i < 60 && !(await peek(page)).boss.dead; i++) {
      await page.evaluate(() => { const g = window.__STARWELL__.game(); g.p.facing = g.boss.x > g.p.x ? 1 : -1; g.p.y = Math.min(g.p.y, g.boss.y + g.boss.h / 2 - 9); });
      await page.keyboard.down('KeyX'); await adv(page, 1); await page.keyboard.up('KeyX'); await adv(page, 8);
    }
    assert.ok((await peek(page)).boss.dead, '보스 처치');
    const st = await page.evaluate(() => window.__STARWELL__.state());
    assert.ok(st.bosses.includes(1));
    assert.ok(await page.evaluate(() => window.__STARWELL__.game().items.some((i) => i.reward)), '보상 등장');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await srv.close(); }
});

const audit = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
  const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, smallText: [], smallTap: [] };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || !vis(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16 && !el.closest('h1,h2')) out.smallText.push(`${el.tagName}:${fs}:${n.textContent.trim().slice(0, 16)}`);
  }
  for (const el of document.querySelectorAll('button')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) out.smallTap.push(`${el.id || el.dataset.key}:${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return out;
};
for (const [w, h] of [[390, 844], [844, 390], [320, 640]]) {
  test(`휴대폰 ${w}×${h}: 가로 넘침 없음, 글자 16px, 누름 44px(첫 화면·플레이·멈춤)`, { timeout: 60000 }, async (t) => {
    const browser = await launch();
    if (!browser) { t.skip('Playwright 없음'); return; }
    const srv = await startServer(0);
    try {
      const page = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })).newPage();
      const errors = watchErrors(page);
      await page.goto(srv.url + '?manual=1&touch=1');
      await page.waitForFunction(() => window.__STARWELL__ && window.__STARWELL__.scene === 'title');
      const chk = async (name) => { const a = await page.evaluate(audit); assert.ok(a.overflow <= 0, `${name} 넘침 ${a.overflow}`); assert.deepEqual(a.smallText, [], name); assert.deepEqual(a.smallTap, [], name); };
      await chk('첫 화면');
      await page.tap('#btn-new');
      await page.evaluate(() => window.__STARWELL__.advance(10));
      await chk('플레이');
      if (w === 844) await page.screenshot({ path: SHOTS + 'mobile-landscape.png' });
      if (w === 390) await page.screenshot({ path: SHOTS + 'mobile-portrait.png' });
      // 터치 단추로 오른쪽 걷기
      const x0 = (await peek(page)).x;
      const box = await page.locator('[data-key=right]').boundingBox();
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      await page.evaluate(() => window.__STARWELL__.advance(30));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.ok((await peek(page)).x > x0 + 20, '터치로 이동');
      await page.tap('#btn-pause-touch');
      await chk('멈춤');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); await srv.close(); }
  });
}

test('보스 6마리가 모두 움직이고 오류 없이 10초를 버틴다, 다 밝힌 지도', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  if (!browser) { t.skip('Playwright 없음'); return; }
  const srv = await startServer(0);
  try {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 544 } })).newPage();
    const errors = watchErrors(page);
    await page.goto(srv.url + '?manual=1');
    await page.waitForFunction(() => window.__STARWELL__ && window.__STARWELL__.scene === 'title');
    await page.click('#btn-new');
    await page.evaluate(() => window.__STARWELL__.give('climb', 'dash', 'double', 'swim', 'pound', 'fire', 'key'));
    const bossRooms = await page.evaluate(() => [['4,2', 'L'], ['3,6', 'L'], ['8,6', 'L'], ['9,3', 'L'], ['10,0', 'L'], ['4,1', 'T']]);
    for (const [id, side] of bossRooms) {
      await page.evaluate(([i, s]) => window.__STARWELL__.teleport(i, s), [id, side]);
      await page.evaluate(() => { const g = window.__STARWELL__.game(); g.p.x = 200; g.p.y = 15 * 16 - 22.01; });
      await adv(page, 5);
      const moved = [];
      for (let k = 0; k < 6; k++) {
        await page.evaluate(() => { const g = window.__STARWELL__.game(); g.inv = 99; g.hp = 99; });
        await adv(page, 100);
        moved.push(await page.evaluate(() => { const b = window.__STARWELL__.game().boss; return `${Math.round(b.x)},${Math.round(b.y)}`; }));
      }
      assert.ok(new Set(moved).size > 2, `${id} 보스가 움직임 ${moved}`);
      if (id === '4,1') await page.screenshot({ path: SHOTS + 'final-boss.png' });
    }
    await page.evaluate(async () => { const m = await import('./js/world.js'); const save = JSON.parse(localStorage.getItem('starwell-below-save-v1')); save.visited = m.ROOMS.map((r) => r.id); localStorage.setItem('starwell-below-save-v1', JSON.stringify(save)); });
    await page.reload();
    await page.waitForFunction(() => window.__STARWELL__ && window.__STARWELL__.scene === 'title');
    await page.click('#btn-continue');
    await page.keyboard.down('KeyM'); await adv(page, 2); await page.keyboard.up('KeyM'); await adv(page, 2);
    await page.screenshot({ path: SHOTS + 'map-full.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await srv.close(); }
});
