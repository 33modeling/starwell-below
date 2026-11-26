// 개발용 정적 서버: node scripts/serve.mjs [포트]  →  http://localhost:포트/
import { startServer } from '../tests/e2e/server.mjs';
const port = Number(process.argv[2] || 8650);
const srv = await startServer(port);
console.log(`별우물 아래: ${srv.url}`);
