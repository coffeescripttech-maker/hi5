const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => console.log('[console]', m.type(), m.text().slice(0,200)));
  page.on('requestfailed', r => console.log('[reqfailed]', r.url().slice(0,120), r.failure()?.errorText));
  page.on('response', r => { if (r.url().includes('/api/')) console.log('[api]', r.request().method(), r.url().slice(0,100), r.status()); });
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0', timeout: 30000 });
  const u = await page.waitForSelector('input[placeholder=\"Enter your username or email\"]', { timeout: 20000 });
  await u.type('registrar01');
  const p = await page.waitForSelector('input[placeholder=\"Enter your password\"]');
  await p.type('password123');
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => ({t: b.textContent.trim().slice(0,40), type: b.type, disabled: b.disabled})));
  console.log('buttons:', JSON.stringify(btns));
  await Promise.all([
    page.evaluate(() => new Promise(res => {
      const form = document.querySelector('form');
      if (form) form.addEventListener('submit', () => console.log('SUBMIT FIRED'), { once: true });
      res();
    })),
    page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.type === 'submit' || /log ?in/i.test(x.textContent)); if (b) b.click(); }),
  ]);
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const nav = await page.evaluate(() => !!document.querySelector('[data-nav-item]'));
    if (nav) { console.log('LOGGED IN at', page.url()); break; }
  }
  console.log('final url:', page.url());
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
