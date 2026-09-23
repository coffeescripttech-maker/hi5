import fs from "node:fs";
import puppeteer from "puppeteer-core";

const DL = "C:/Users/ACER/AppData/Local/Temp/opencode/dl";
fs.mkdirSync(DL, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.PDF_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  userDataDir: DL + "/profile",
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page._client().send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: DL });

const byPlaceholder = async (ph, key) => {
  const h = await page.$(`input[placeholder$="${ph}"]`);
  if (!h) throw new Error("no input for " + ph);
  await h.click({ delay: 40 });
  await page.keyboard.type(key, { delay: 20 });
};

try {
  await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2", timeout: 30000 });
  if (/login/i.test(page.url())) {
    await byPlaceholder("username", "teacher01");
  } else {
    // already authed? navigate to login explicitly
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
    await byPlaceholder("username", "teacher01");
  }
  await byPlaceholder("password", "password123");
  const submit = await page.$("form button[type=submit], button:has-text('Sign in'), button:has-text('Log in')").catch(() => null);
  await page.keyboard.press("Enter");
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
  console.log("post-login url:", page.url());

  await page.goto("http://localhost:5173/teacher/upload", { waitUntil: "networkidle2", timeout: 30000 });
  console.log("upload url:", page.url());

  const selects = await page.$$("select");
  console.log("select count:", selects.length);
  for (const s of selects) {
    const opts = await s.$$("option");
    const texts = [];
    for (const o of opts) texts.push(await o.evaluate(el => el.textContent.trim()));
    console.log("- options:", JSON.stringify(texts));
  }

  // Pick the first real value in every select
  for (const s of selects) {
    const opts = await s.$$("option");
    if (opts.length > 1) {
      const val = await opts[1].evaluate(o => o.value);
      console.log("selecting", val);
      await s.select(val);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  await new Promise(r => setTimeout(r, 800));

  const btn = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find(b => /Download Excel Template/i.test(b.textContent || "")) || null
  );
  if ((await btn.evaluate(b => b === null)) ) {
    console.log("template button NOT FOUND");
  } else {
    console.log("button text:", await btn.evaluate(b => b.textContent.trim()));
    console.log("button disabled:", await btn.evaluate(b => b.disabled));
    if (await btn.evaluate(b => b.disabled)) {
      console.log("BUTTON DISABLED — a required dropdown is still empty");
    } else {
      await btn.asElement().click();
      console.log("clicked");
    }
  }

  await new Promise(r => setTimeout(r, 5000));
  const files = fs.readdirSync(DL).filter(f => f !== "profile");
  console.log("downloaded files:", JSON.stringify(files));
} catch (e) {
  console.error("ERR:", e.message);
}
await browser.close();