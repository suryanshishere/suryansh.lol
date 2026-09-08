/* Browser regression for the admin inbox. All API calls use local fixtures.
 * Start the built portfolio with Wrangler, then run:
 *   node scripts/admin-ui.cjs
 * Optional: ADMIN_TEST_BASE_URL, PLAYWRIGHT_BROWSER_EXECUTABLE.
 */
const { chromium } = require("playwright");
const { expect } = require("@playwright/test");
const { default: AxeBuilder } = require("@axe-core/playwright");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const cachedBrowser = "C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
  const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || (fs.existsSync(cachedBrowser) ? cachedBrowser : undefined);
  const baseUrl = process.env.ADMIN_TEST_BASE_URL || "http://localhost:8788";
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  const policyErrors = [];
  const horizontalOverflows = [];
  async function checkHorizontalOverflow() {
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
    if (dimensions.content > dimensions.viewport) horizontalOverflows.push(dimensions);
  }
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (/content security policy|violates.*directive/i.test(message.text())) policyErrors.push(message.text()); });
  fs.mkdirSync(path.join(process.cwd(), ".local"), { recursive: true });

  let authed = false;
  let unavailable = false;
  let contactsUnavailable = false;
  let unauthorized = false;
  let failMutation = false;
  let holdNextMutation = false;
  let releaseMutation;
  let retryStatus = "sent";
  const mutations = [];
  const contacts = [
    { id: "a1", name: "Aditi Kapoor", email: "aditi@example.com", subject: "Let’s build something useful", message: "Hi Suryansh,\n\nI’m looking for help with a fast web application and a data pipeline. I liked the way you approached Government Ninja.\n\nWould you be available for a conversation next week?\n\nThanks,\nAditi", status: "new", createdAt: "2026-09-08T08:30:00Z", updatedAt: "2026-09-08T08:30:00Z", notification: { status: "failed", attempts: 1 } },
    { id: "b2", name: "Rohan Mehta", email: "rohan@example.com", subject: "An engineering opportunity", message: "Your portfolio caught my eye. We’re building a small engineering team and would love to talk. <script>window.INJECTED=true</script>", status: "read", createdAt: "2026-09-07T09:00:00Z", updatedAt: "2026-09-07T09:00:00Z", notification: { status: "sent", attempts: 1 } },
    { id: "c3", name: "Long sender with unsafe address", email: "bad@example.com?bcc=intruder@example.com", subject: "A safely rendered message", message: "Hello", status: "archived", createdAt: "2026-09-06T09:00:00Z", updatedAt: "2026-09-06T09:00:00Z", notification: { status: "pending", attempts: 0 } },
  ];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (unavailable) return route.abort("internetdisconnected");
    if (url.pathname === "/api/auth/session") return route.fulfill({ json: authed ? { authenticated: true, user: { email: "heresuryanshsingh@gmail.com", name: "Suryansh Singh" }, csrfToken: "test-csrf" } : { authenticated: false } });
    if (url.pathname === "/api/auth/logout") {
      mutations.push({ path: url.pathname, csrf: request.headers()["x-csrf-token"] });
      authed = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (unauthorized) return route.fulfill({ status: 401, json: { error: "Unauthorized" } });
    if (request.method() === "PATCH" || request.method() === "POST") {
      mutations.push({ path: url.pathname, csrf: request.headers()["x-csrf-token"], body: request.postDataJSON() });
      if (failMutation) return route.fulfill({ status: 500, json: { error: "failed" } });
      if (holdNextMutation) {
        holdNextMutation = false;
        await new Promise((resolve) => { releaseMutation = resolve; });
      }
      const row = contacts.find((contact) => url.pathname.includes(contact.id));
      if (request.method() === "PATCH") row.status = request.postDataJSON().status;
      else row.notification.status = retryStatus;
      return route.fulfill({ json: { ok: true, notification: retryStatus } });
    }
    if (contactsUnavailable) return route.abort("internetdisconnected");
    let list = contacts;
    const query = url.searchParams.get("q");
    const status = url.searchParams.get("status");
    if (query) list = list.filter((contact) => (contact.name + contact.email + contact.subject + contact.message).toLowerCase().includes(query.toLowerCase()));
    if (status) list = list.filter((contact) => contact.status === status);
    const currentPage = Number(url.searchParams.get("page") || 1);
    const total = list.length;
    list = list.slice((currentPage - 1) * 2, currentPage * 2);
    return route.fulfill({ json: { contacts: list, pagination: { page: currentPage, limit: 2, total, pages: Math.ceil(total / 2) }, counts: { new: contacts.filter((contact) => contact.status === "new").length, read: contacts.filter((contact) => contact.status === "read").length, archived: contacts.filter((contact) => contact.status === "archived").length, total: contacts.length } } });
  });

  try {
    const response = await page.goto(`${baseUrl}/admin/`, { waitUntil: "networkidle" });
    expect(response.status()).toBe(200);
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.screenshot({ path: ".local/admin-signin.png", fullPage: true });
    const signInAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(signInAudit.violations).toEqual([]);
    console.log("PASS signed-out gateway and noindex");

    authed = true;
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Your inbox." })).toBeVisible();
    await page.getByRole("button", { name: /Aditi Kapoor/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Let’s build something useful" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reply by email" })).toHaveAttribute("href", /^mailto:aditi%40example.com\?subject=Re%3A/);
    await page.screenshot({ path: ".local/admin-desktop.png", fullPage: true });
    const inboxAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(inboxAudit.violations).toEqual([]);
    console.log("PASS authenticated inbox, keyboard selection, encoded reply");

    await page.getByRole("combobox", { name: "Message status" }).selectOption("read");
    await expect(page.getByRole("status")).toContainText("Message marked as read.");
    retryStatus = "failed";
    await page.getByRole("button", { name: "Retry email", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("could not be sent");
    retryStatus = "sent";
    await page.getByRole("button", { name: "Retry email", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Email notification sent");
    console.log("PASS status mutation, failed notification retry, successful retry");

    await page.getByRole("searchbox", { name: "Search messages" }).fill("not found");
    await expect(page.getByRole("heading", { name: "Nothing by that name." })).toBeVisible();
    await page.getByRole("button", { name: "Show all messages" }).click();
    await page.getByRole("button", { name: /Rohan Mehta/ }).click();
    await expect(page.locator(".admin-message-body")).toContainText("<script>window.INJECTED=true</script>");
    expect(await page.evaluate(() => window.INJECTED)).toBeUndefined();
    console.log("PASS search empty/reset and unsafe content rendered as text");

    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await page.getByRole("button", { name: /Long sender with unsafe address/ }).click();
    await expect(page.getByRole("link", { name: "Reply by email" })).toHaveCount(0);
    await page.getByRole("button", { name: "← Previous", exact: true }).click();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    console.log("PASS pagination and unsafe email cannot create a reply link");

    await page.getByRole("button", { name: /^New 0$/ }).click();
    await expect(page.getByRole("heading", { name: "No new messages." })).toBeVisible();
    await page.getByRole("button", { name: "Show all messages" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /Aditi Kapoor/ }).click();
    await expect(page.getByRole("heading", { name: "Let’s build something useful" })).toBeFocused();
    await checkHorizontalOverflow();
    await page.screenshot({ path: ".local/admin-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "All conversations" }).click();
    await expect(page.getByRole("button", { name: /Aditi Kapoor/ })).toBeFocused();
    await page.setViewportSize({ width: 320, height: 740 });
    await checkHorizontalOverflow();
    await page.getByRole("button", { name: /Aditi Kapoor/ }).click();
    await checkHorizontalOverflow();
    await page.setViewportSize({ width: 390, height: 844 });
    console.log("PASS status filtering and mobile detail focus");

    failMutation = true;
    await page.getByRole("combobox", { name: "Message status" }).selectOption("archived");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("could not be saved");
    expect(await page.getByRole("combobox", { name: "Message status" }).inputValue()).toBe("read");
    failMutation = false;
    console.log("PASS mutation failure retains original status");

    await page.setViewportSize({ width: 1440, height: 1050 });
    holdNextMutation = true;
    await page.getByRole("combobox", { name: "Message status" }).selectOption("archived");
    await expect.poll(() => typeof releaseMutation).toBe("function");
    await page.getByRole("button", { name: /^Archived 1$/ }).click();
    await expect(page.getByRole("button", { name: /Long sender with unsafe address/ })).toBeVisible();
    releaseMutation();
    await expect(page.getByRole("status")).toContainText("Message marked as archived.");
    await expect(page.getByRole("button", { name: /Aditi Kapoor/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Long sender with unsafe address/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Rohan Mehta/ })).toHaveCount(0);
    console.log("PASS changing filter during mutation keeps the latest filter results");

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    expect(mutations.every((mutation) => mutation.csrf === "test-csrf")).toBe(true);
    console.log("PASS logout and CSRF on every mutation");

    authed = true;
    unauthorized = true;
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("session has ended");
    console.log("PASS unauthorized inbox clears session");

    unauthorized = false;
    unavailable = true;
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("sign-in status could not be checked");
    unavailable = false;
    authed = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    console.log("PASS unavailable session API and retry recovery");

    authed = true;
    contactsUnavailable = true;
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("messages could not be loaded");
    contactsUnavailable = false;
    await page.getByRole("button", { name: "Reload messages", exact: true }).click();
    await expect(page.getByRole("button", { name: /Aditi Kapoor/ })).toBeVisible();
    console.log("PASS unavailable contacts API and reload recovery");

    authed = false;
    await page.goto(`${baseUrl}/admin/?error=access_denied`, { waitUntil: "networkidle" });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("authorized Google account");
    expect(errors).toEqual([]);
    expect(policyErrors).toEqual([]);
    expect(horizontalOverflows).toEqual([]);
    console.log("PASS OAuth denial message, no browser exceptions or CSP violations");
  } catch (error) {
    await page.screenshot({ path: ".local/admin-test-failure.png", fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
