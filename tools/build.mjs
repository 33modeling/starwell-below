// 빌드: 방 데이터가 설계와 같은지 확인하고 web/ 을 dist/ 로 복사한다(번들러 없음).
import { cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = new URL('..', import.meta.url).pathname;
execFileSync(process.execPath, ['tools/build-world.mjs', '--check'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
rmSync(root + 'dist', { recursive: true, force: true });
cpSync(root + 'web', root + 'dist', { recursive: true });
let n = 0, bytes = 0;
const walk = (d) => { for (const f of readdirSync(d)) { const p = d + '/' + f; const s = statSync(p); if (s.isDirectory()) walk(p); else { n++; bytes += s.size; } } };
walk(root + 'dist');
console.log(`dist/ 에 파일 ${n}개 (${(bytes / 1024).toFixed(0)} KB)`);
