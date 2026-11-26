// 소리: WebAudio 로 짧은 효과음만 만든다(파일 없음)
let ctx = null;
let on = true;
export function setSound(v) { on = v; }
export function unlock() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}
function tone(type, f0, f1, dur, vol = 0.12, delay = 0) {
  if (!on || !ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  jump: () => tone('square', 330, 520, 0.09, 0.06),
  djump: () => tone('triangle', 520, 880, 0.12, 0.08),
  shoot: () => tone('square', 900, 500, 0.06, 0.04),
  fire: () => tone('sawtooth', 500, 200, 0.09, 0.05),
  hit: () => tone('sawtooth', 220, 80, 0.18, 0.1),
  enemy: () => tone('square', 300, 120, 0.08, 0.05),
  break: () => tone('sawtooth', 160, 50, 0.22, 0.1),
  dash: () => tone('triangle', 200, 700, 0.12, 0.07),
  pound: () => tone('sawtooth', 120, 40, 0.25, 0.12),
  pick: () => { tone('triangle', 660, 990, 0.1, 0.08); tone('triangle', 990, 1320, 0.14, 0.08, 0.09); },
  big: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f * 1.01, 0.2, 0.09, i * 0.11)); },
  save: () => { tone('sine', 440, 660, 0.2, 0.09); tone('sine', 660, 880, 0.25, 0.08, 0.15); },
  door: () => tone('triangle', 200, 300, 0.08, 0.04),
  boss: () => tone('square', 140, 70, 0.3, 0.1),
  bossHit: () => tone('square', 500, 300, 0.05, 0.04),
  die: () => { tone('sawtooth', 400, 60, 0.6, 0.12); },
  splash: () => tone('sine', 300, 120, 0.15, 0.06),
};
