const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const font = fs.readFileSync('public/fonts/bricolage.woff2').toString('base64');
  const doodle = fs.readFileSync('public/images/coder-doodle.webp').toString('base64');
  await page.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:Display;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400 800}
    *{box-sizing:border-box}body{margin:0;background:#faf8f2;color:#252523;font-family:Display,sans-serif;width:1200px;height:630px;padding:55px 65px;position:relative;overflow:hidden}
    .brand{font-size:28px;font-weight:700;letter-spacing:-1px}.brand span{color:#ee4935}h1{font-size:77px;font-weight:650;line-height:1.03;letter-spacing:-3px;margin:55px 0 23px;width:650px}p{font-size:23px;margin:0;color:#66655e}.line{width:432px;height:4px;background:#ee4935;transform:rotate(-1deg);margin-top:-17px;margin-bottom:30px}img{position:absolute;width:540px;right:12px;top:80px;mix-blend-mode:multiply;transform:rotate(-2deg)}.bottom{position:absolute;bottom:39px;font-size:15px;letter-spacing:.5px}
    </style></head><body><div class="brand">suryansh.lol<span> ●</span></div><h1>I turn ideas<br>into things<br>people use.</h1><div class="line"></div><p>Suryansh Singh · Software & Data Engineer</p><img src="data:image/webp;base64,${doodle}" alt=""><div class="bottom">Curious by nature. Building by choice.</div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'public/og-image.png' });
  await browser.close();
  console.log('Saved public/og-image.png (1200 × 630).');
})();
