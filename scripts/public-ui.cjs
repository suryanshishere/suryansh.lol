const { chromium } = require('playwright');
const { expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');

(async () => {
  const cached = 'C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || (fs.existsSync(cached) ? cached : undefined) });
  const base = process.env.TEST_BASE_URL || 'http://localhost:8788';
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('I turn ideasinto thingspeople use.');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow, `No horizontal overflow at ${width}px`).toBe(false);
    const brokenImages = await page.locator('img').evaluateAll(images => images.filter(image => image.complete && image.naturalWidth === 0).map(image => image.src));
    expect(brokenImages).toEqual([]);
    if (width === 390) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page.getByRole('navigation').getByRole('link', { name: 'About', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    }
    console.log(`Responsive layout passed: ${width}px.`);
  }
  await page.locator('.project-details').first().locator('summary').click();
  await expect(page.locator('.project-details').first()).toHaveAttribute('open', '');
  await page.locator('.project-details').first().locator('summary').click();
  const submissions = [];
  let fail = true;
  await page.route('**/api/contact', route => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ status: fail ? 503 : 201, json: fail ? { error: 'Please try again.' } : { ok: true, notification: 'sent' } });
  });
  await page.getByLabel('Your name', { exact: true }).fill('Portfolio Test');
  await page.getByLabel('Your email', { exact: true }).fill('test@example.com');
  await page.getByLabel('A little about it', { exact: true }).fill('I would love to talk about a software engineering opportunity.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('status')).toHaveText('Please try again.');
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Portfolio Test');
  fail = false;
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('status')).toContainText('Your message is in my inbox.');
  expect(submissions[0].submissionId).toBe(submissions[1].submissionId);
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('');
  console.log('Contact success, failure recovery, and retry idempotency passed (mock API).');
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  fs.mkdirSync('.local', { recursive: true });
  fs.writeFileSync('.local/accessibility.json', JSON.stringify(accessibility.violations, null, 2));
  expect(accessibility.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`)).toEqual([]);
  const missing = await page.goto(`${base}/this-page-does-not-exist`);
  expect(missing.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page wandered off.');
  expect(errors).toEqual([]);
  await browser.close();
  console.log('Accessibility, custom 404, and browser error checks passed.');
})().catch(error => { console.error(error); process.exit(1); });
