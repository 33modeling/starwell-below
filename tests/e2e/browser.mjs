// Playwright 불러오기: 설치하지 않고 PLAYWRIGHT_MODULE(예: 다른 레포의 node_modules/playwright/index.mjs)이나
// 이 레포의 node_modules 심링크를 쓴다. 없으면 시험을 건너뛴다. GPU 를 쓰지 않는다(--disable-gpu).
export async function loadChromium() {
  const spec = process.env.PLAYWRIGHT_MODULE || 'playwright';
  try {
    const mod = await import(spec);
    const pw = mod.chromium ? mod : mod.default;
    return pw.chromium;
  } catch {
    return null;
  }
}

export async function launch() {
  const chromium = await loadChromium();
  if (!chromium) return null;
  const browser = await chromium.launch({ ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), args: ['--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required', ...(process.env.BROWSER_EXECUTABLE ? ['--no-sandbox'] : [])] });
  return browser;
}

// 콘솔 오류·페이지 오류 모으기
export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}
