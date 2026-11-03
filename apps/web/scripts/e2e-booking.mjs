// E2E pelo navegador: agenda pelo site público e confere que o agendamento aparece no painel.
// Requer API + web rodando. Uso: CHROME_PATH=/usr/bin/google-chrome npm run e2e:browser
import { bookingUntil, clickText, launch, login, newPage, settle, WEB_URL } from "./lib/browser.mjs";

const customer = { name: `Cliente E2E ${Date.now().toString().slice(-5)}`, whatsapp: "19976543210" };
const browser = await launch();
let failed = false;
try {
  const page = await newPage(browser, { width: 1280 });

  // 1) Cliente agenda pelo site
  await bookingUntil(page, 5, customer);
  await clickText(page, "button", "Confirmar agendamento");
  await page.waitForSelector("[data-testid=appointment-code]", { timeout: 15_000 });
  const code = await page.$eval("[data-testid=appointment-code]", (e) => e.textContent.trim());
  const token = page.url().split("/").pop();
  const details = await (await fetch(`${WEB_URL}/api/appointments/manage/${token}`)).json();
  console.log(`✔ Agendado pelo site: código ${code} (${details.service.name} com ${details.professional.name}, ${details.startsAt})`);

  // 2) Dono entra no painel; a API do painel retorna o agendamento na data
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: details.business.timezone }).format(new Date(details.startsAt));
  await page.deleteCookie(...(await page.cookies()));
  await login(page, "demo@agendai.app");
  const agenda = await page.evaluate(async (d) => {
    const res = await fetch(`/api/admin/appointments?from=${d}&to=${d}`, { credentials: "include" });
    return res.json();
  }, date);
  const found = agenda.appointments.find((a) => a.code === code);
  if (!found) throw new Error(`Agendamento ${code} não encontrado na agenda de ${date}`);
  console.log(`✔ Painel retorna ${code} para "${found.customer.name}" (status ${found.status})`);

  // 3) E o bloco aparece visualmente na agenda (navega dia a dia até a data)
  await page.goto(`${WEB_URL}/admin/agenda`, { waitUntil: "networkidle0" });
  await settle(page);
  const isVisible = () => page.evaluate((n) => document.body.innerText.includes(n), customer.name);
  for (let i = 0; i < 40 && !(await isVisible()); i++) {
    await page.click('button[aria-label="Próximo dia"]');
    await settle(page, 400);
  }
  if (!(await isVisible())) throw new Error("O bloco do agendamento não apareceu na agenda do painel");
  console.log(`✔ Bloco "${customer.name}" visível na agenda do painel`);
} catch (error) {
  failed = true;
  console.error(`✖ ${error.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
