// Gera os tipos TypeScript da API a partir do OpenAPI (openapi-typescript).
// Uso: npm run gen:api [-- <url-ou-arquivo>]
// Padrão: $OPENAPI_URL ou http://localhost:3001/openapi.json; se a API não estiver
// rodando, usa ../api/openapi.json (gerado com `npm run openapi` na API).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";

const OUT = resolve("src/lib/api/schema.d.ts");
const explicit = process.argv[2] ?? process.env.OPENAPI_URL;
const candidates = explicit ? [explicit] : ["http://localhost:3001/openapi.json", "../api/openapi.json"];

async function load(source) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`${source} respondeu ${res.status}`);
    return res.json();
  }
  const path = resolve(source);
  if (!existsSync(path)) throw new Error(`Arquivo não encontrado: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

let schema;
let used;
for (const source of candidates) {
  try {
    schema = await load(source);
    used = source;
    break;
  } catch (error) {
    console.warn(`⚠ Não foi possível ler ${source}: ${error.message}`);
  }
}
if (!schema) {
  console.error("✖ Nenhuma fonte de OpenAPI disponível.");
  process.exit(1);
}

const ast = await openapiTS(schema, { exportType: true, alphabetize: true });
const banner = `/**\n * ARQUIVO GERADO — não edite manualmente.\n * Fonte: ${used.startsWith("http") ? "API /openapi.json" : "apps/api/openapi.json"}\n * Comando: npm run gen:api\n */\n\n`;
writeFileSync(OUT, banner + astToString(ast));
console.log(`✔ Tipos da API gerados em src/lib/api/schema.d.ts (fonte: ${used})`);
