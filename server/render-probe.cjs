const fs = require('fs');
(async () => {
  const login = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'registrar01', password: 'password123' }),
  });
  const { token } = await login.json();
  if (!token) { console.log('login failed', login.status); return; }
  const html = fs.readFileSync('sf1-serialized.html', 'utf8');
  const t0 = Date.now();
  try {
    const res = await fetch('http://localhost:3001/api/pdf/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ html, filename: 'sf1_probe.pdf' }),
    });
    const ms = Date.now() - t0;
    console.log('status:', res.status, 'in', (ms / 1000).toFixed(1) + 's');
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync('sf1-probe.pdf', buf);
      console.log('pdf bytes:', buf.length);
    } else {
      console.log('body:', (await res.text()).slice(0, 300));
    }
  } catch (e) {
    console.log('FAILED after', ((Date.now() - t0) / 1000).toFixed(1) + 's:', e.message);
  }
})();
