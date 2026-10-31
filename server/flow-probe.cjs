const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on('console', m => console.log('[console]', m.type(), m.text().slice(0,180)));
  page.on('requestfailed', r => console.log('[reqfailed]', r.url().slice(0,110), r.failure()?.errorText));
  page.on('response', r => { if (r.url().includes('/api/pdf/render')) console.log('[render]', r.request().method(), r.status()); });
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0', timeout: 30000 });
  const u = await page.waitForSelector('input[placeholder=\"Enter your username or email\"]', { timeout: 20000 });
  await u.type('registrar01');
  const p = await page.waitForSelector('input[placeholder=\"Enter your password\"]');
  await p.type('password123');
  await (await page.waitForSelector('#agree-terms')).click();
  await Promise.all([page.waitForSelector('[data-nav-item]', { timeout: 30000 }), p.press('Enter')]);
  console.log('logged in:', page.url());
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('[data-nav-item]'));
    const hit = btns.find(b => b.textContent.includes('SF1'));
    if (hit) hit.click();
  });
  await page.waitForFunction(() => location.pathname.includes('/forms/sf1'), { timeout: 20000 });
  await page.waitForSelector('#sf1-print-area', { timeout: 25000 });
  console.log('sf1 loaded');
  await page.evaluate(() => {
    window.__pdfB64 = null;
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj) => {
      if (obj instanceof Blob) {
        obj.arrayBuffer().then(ab => {
          const bytes = new Uint8Array(ab); let bin = '';
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          window.__pdfB64 = btoa(bin);
        }).catch(e => console.log('arrayBuffer fail', e.message));
      }
      return orig(obj);
    };
  });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('PDF'));
    if (b) b.click(); else console.log('NO PDF BUTTON');
  });
  for (let i = 0; i < 24; i++) {
    const has = await page.evaluate(() => Array.from(document.querySelectorAll('button')).some(x => x.textContent.includes('Export PDF')));
    if (has) break;
    await new Promise(r => setTimeout(r, 500));
  }
  const modalState = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(x => x.textContent.includes('Export PDF'));
    return btns.map(b => ({ t: b.textContent.trim(), disabled: b.disabled }));
  });
  console.log('export buttons:', JSON.stringify(modalState));
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Export PDF'));
    if (b) b.click(); else console.log('NO EXPORT BUTTON');
  });
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await page.evaluate(() => !!window.__pdfB64)) { console.log('BLOB captured at', i + 's'); break; }
  }
  const b64 = await page.evaluate(() => window.__pdfB64);
  console.log('blob:', b64 ? b64.length + ' b64 chars' : 'NONE');
  console.log('url now:', page.url());
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
