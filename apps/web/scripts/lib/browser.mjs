// Utilitários compartilhados pelos scripts de prints e E2E (puppeteer-core + Chrome local).
import puppeteer from "puppeteer-core";

export const WEB_URL = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function launch() {
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath) {
    console.error("✖ Defina CHROME_PATH com o caminho do Chrome/Chromium (ex.: /usr/bin/google-chrome).");
    process.exit(1);
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--lang=pt-BR", "--force-prefers-reduced-motion"],
  });
}

export async function newPage(browser, { width, height = 900, scale = 1 }) {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9" });
  await page.emulateTimezone("America/Sao_Paulo");
  await page.setViewport({ width, height, deviceScaleFactor: scale, isMobile: width < 500, hasTouch: width < 500 });
  page.on("pageerror", (e) => console.warn(`  ⚠ erro na página: ${e.message}`));
  return page;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Clica no primeiro elemento `selector` (habilitado) cujo texto contém `text`. */
export async function clickText(page, selector, text, timeout = 15_000) {
  await page.waitForFunction(
    (s, t) => [...document.querySelectorAll(s)].some((e) => e.textContent?.includes(t) && !e.disabled),
    { timeout },
    selector,
    text,
  );
  await page.evaluate(
    (s, t) => [...document.querySelectorAll(s)].find((e) => e.textContent?.includes(t) && !e.disabled).click(),
    selector,
    text,
  );
}

export async function settle(page, ms = 600) {
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 15_000 }).catch(() => undefined);
  await wait(ms);
}

/** Avança o fluxo de agendamento até a etapa pedida (1..5). */
export async function bookingUntil(page, step, customer = { name: "Marina Testes", whatsapp: "19987654321" }) {
  await page.goto(`${WEB_URL}/agendar`, { waitUntil: "networkidle0" });
  if (step === 1) return;
  await clickText(page, "button[role=radio]", "Corte + Barba");
  await settle(page);
  if (step === 2) return;
  await clickText(page, "button[role=radio]", "Qualquer profissional");
  await page.waitForSelector('[aria-label="Horários disponíveis"] button[role=radio]', { timeout: 15_000 });
  await settle(page, 300);
  const slots = await page.$$('[aria-label="Horários disponíveis"] button[role=radio]');
  await slots[Math.min(4, slots.length - 1)].click();
  await wait(300);
  if (step === 3) return;
  await clickText(page, "button", "Continuar");
  await page.waitForSelector("#name");
  await wait(300);
  await page.type("#name", customer.name);
  await page.type("#whatsapp", customer.whatsapp);
  if (step === 4) return;
  await clickText(page, "button", "Revisar");
  await wait(500);
}

export async function login(page, email, password = "demo1234") {
  await page.goto(`${WEB_URL}/admin/login`, { waitUntil: "networkidle0" });
  await page.type("#email", email);
  await page.type("#password", password);
  await page.click("button[type=submit]");
  await page.waitForFunction(() => location.pathname === "/admin", { timeout: 15_000 });
  await settle(page, 1000);
}
