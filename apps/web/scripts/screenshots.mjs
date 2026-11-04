// Gera os prints do README em docs/screenshots (375px e 1440px).
// Requer API + web rodando. Uso: CHROME_PATH=/usr/bin/google-chrome npm run screenshots
// Com API_URL e CRON_SECRET definidos, reseta os dados da demo antes (prints sempre iguais).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bookingUntil, clickText, launch, login, newPage, settle, WEB_URL } from "./lib/browser.mjs";

const OUT = resolve("../../docs/screenshots");
mkdirSync(OUT, { recursive: true });

if (process.env.CRON_SECRET && process.env.API_URL) {
  const res = await fetch(`${process.env.API_URL}/internal/reset-demo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  console.log(res.ok ? "✔ Dados da demo resetados" : `⚠ Reset falhou (${res.status})`);
}

const VIEWPORTS = [
  { name: "mobile", width: 375, scale: 2 },
  { name: "desktop", width: 1440, scale: 1 },
];

/** Print da página inteira aumentando o viewport (evita artefatos de elementos sticky). */
async function shot(page, file, { full = true } = {}) {
  const vp = page.viewport();
  if (full) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ ...vp, height: Math.min(Math.max(height, 700), 6000) });
    await settle(page, 400);
  }
  await page.screenshot({ path: `${OUT}/${file}.png` });
  if (full) await page.setViewport({ ...vp, height: 900 });
  console.log(`  ✔ ${file}.png`);
}

const browser = await launch();
try {
  for (const vp of VIEWPORTS) {
    console.log(`\n${vp.name} (${vp.width}px)`);
    const page = await newPage(browser, vp);
    const suffix = `-${vp.width}`;

    await page.goto(`${WEB_URL}/`, { waitUntil: "networkidle0" });
    await settle(page);
    await shot(page, `01-negocio${suffix}`);

    for (const step of [1, 2, 3, 4, 5]) {
      await bookingUntil(page, step);
      await settle(page);
      await shot(page, `0${step + 1}-agendar-etapa-${step}${suffix}`);
    }
    await clickText(page, "button", "Confirmar agendamento");
    await page.waitForSelector("[data-testid=appointment-code]", { timeout: 15_000 });
    await settle(page, 1000);
    await shot(page, `07-sucesso${suffix}`);

    await page.deleteCookie(...(await page.cookies()));
    await page.goto(`${WEB_URL}/admin/login`, { waitUntil: "networkidle0" });
    await settle(page);
    await shot(page, `08-login${suffix}`, { full: false });

    await login(page, "demo@agendai.app");
    await shot(page, `09-dashboard${suffix}`);
    await page.goto(`${WEB_URL}/admin/agenda`, { waitUntil: "networkidle0" });
    await settle(page, 1000);
    await shot(page, `10-agenda-dia${suffix}`);
    await page.goto(`${WEB_URL}/admin/servicos`, { waitUntil: "networkidle0" });
    await settle(page, 800);
    await shot(page, `11-servicos${suffix}`);
    for (const [route, name] of [
      ["relatorios", "12-relatorios"],
      ["mensagens", "13-mensagens"],
      ["fila-de-espera", "14-fila-de-espera"],
      ["configuracoes", "15-configuracoes"],
    ]) {
      await page.goto(`${WEB_URL}/admin/${route}`, { waitUntil: "networkidle0" });
      await settle(page, 800);
      await shot(page, `${name}${suffix}`);
    }

    // Pix: ativa o sinal, agenda e mostra a tela de pagamento (modo simulado)
    await page.evaluate(() =>
      fetch("/api/admin/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMode: "DEPOSIT", depositPercent: 30 }),
      }),
    );
    await page.deleteCookie(...(await page.cookies()));
    await bookingUntil(page, 5, { name: "Paula Pix", whatsapp: "19981234567" });
    await clickText(page, "button", "Confirmar e pagar com Pix");
    await page.waitForSelector("#pix-title", { timeout: 15_000 });
    await settle(page, 800);
    await shot(page, `16-pix${suffix}`);
    await login(page, "demo@agendai.app");
    await page.evaluate(() =>
      fetch("/api/admin/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMode: "NONE" }),
      }),
    );

    // Cadastro self-service
    await page.deleteCookie(...(await page.cookies()));
    await page.goto(`${WEB_URL}/cadastro`, { waitUntil: "networkidle0" });
    await settle(page);
    await shot(page, `17-cadastro${suffix}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`\nPrints salvos em ${OUT}`);
