const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';

(async () => {
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'registrar01', password: 'password123' })
  });
  const loginJson = await loginRes.json();
  const token = loginJson.token;
  if (!token) { console.error('LOGIN FAILED'); process.exit(1); }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars']
  });

  const client = await browser.createBrowserContext();
  const page = await client.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  // Force DARK mode by adding the .dark class on <html>
  await page.evaluateOnNewDocument((tok, role, uname) => {
    localStorage.setItem('hi5_portal_token', tok);
    localStorage.setItem('hi5_portal_session', JSON.stringify({ role, username: uname }));
    const onReady = () => {
      document.documentElement.classList.add('dark');
    };
    if (document.documentElement) onReady();
    else window.addEventListener('DOMContentLoaded', onReady);
  }, token, loginJson.user?.role, loginJson.user?.username);

  await page.goto(`${BASE}/registrar/forms/SF1`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  // Is dark mode applied? What are html/body backgrounds?
  const bg = await page.evaluate(() => ({
    htmlHasDark: document.documentElement.classList.contains('dark'),
    bodyHasDark: document.body.classList.contains('dark'),
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor
  }));
  console.log('Dark mode state:', JSON.stringify(bg, null, 2));

  const hasArea = await page.evaluate(() => !!document.getElementById('sf1-print-area'));
  if (hasArea) {
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /pdf/i.test(b.textContent || ''));
      if (!btn) return false;
      btn.click();
      return true;
    });
    console.log('PDF clicked:', clicked);
    await new Promise(r => setTimeout(r, 15000));
  }

  console.log('Console errors:', consoleErrors.length);
  consoleErrors.forEach(e => console.log('  -', e.slice(0, 300)));

  await browser.close();
})();
