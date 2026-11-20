// Importa una receta desde un enlace: descarga la página y extrae los datos estructurados
// schema.org/Recipe (JSON-LD), que publican casi todas las webs de recetas.
// Si la página no los trae, devuelve el texto visible para que la persona se lo pase a su IA.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_BYTES = 3_000_000;

// Evita que la función se use para llegar a redes internas
function blockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(":")) return true; // IPv6 literal: no se admite
  return false;
}
async function resolvesPrivate(host: string): Promise<boolean> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return blockedHost(host);
  try {
    const ips = await Deno.resolveDns(host, "A");
    return ips.some(blockedHost);
  } catch {
    return false; // si no se puede resolver, fetch fallará por su cuenta
  }
}

async function fetchPage(raw: string): Promise<{ html: string; url: string }> {
  let url = new URL(raw);
  for (let hop = 0; hop < 5; hop++) {
    if (!/^https?:$/.test(url.protocol)) throw new Error("bad_url");
    if (blockedHost(url.hostname) || await resolvesPrivate(url.hostname)) throw new Error("blocked");
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PlannerRecetas/1.0)", "Accept": "text/html,application/xhtml+xml", "Accept-Language": "es,en;q=0.7" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error("http_" + res.status);
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { reader.cancel(); break; }
      chunks.push(value);
    }
    const buf = new Uint8Array(size > MAX_BYTES ? MAX_BYTES : size);
    let off = 0;
    for (const c of chunks) { if (off + c.length > buf.length) break; buf.set(c, off); off += c.length; }
    return { html: new TextDecoder().decode(buf.subarray(0, off)), url: url.toString() };
  }
  throw new Error("too_many_redirects");
}

const decode = (s: string) => s
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const clean = (s: unknown) => decode(String(s ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function isRecipe(o: any): boolean {
  const t = o && o["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
}
function findRecipe(node: any): any {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  if (isRecipe(node)) return node;
  for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    const r = findRecipe(node[k]); if (r) return r;
  }
  return null;
}
// ISO 8601 (PT1H30M) a minutos
function minutes(v: unknown): number {
  const m = String(v ?? "").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return 0;
  return (Number(m[1] || 0) * 1440) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}
function steps(ins: any): string[] {
  if (!ins) return [];
  if (typeof ins === "string") return ins.split(/\n+|(?<=\.)\s+(?=\d+[.)]\s)/).map(clean).filter(Boolean);
  if (Array.isArray(ins)) return ins.flatMap(steps);
  if (typeof ins === "object") {
    if (ins.itemListElement) return steps(ins.itemListElement);
    const t = clean(ins.text ?? ins.name);
    return t ? [t] : [];
  }
  return [];
}
const numOf = (v: unknown) => { const m = String(v ?? "").replace(",", ".").match(/[\d.]+/); return m ? Number(m[0]) : 0; };

function normalize(r: any, url: string) {
  const n = r.nutrition || {};
  const yieldRaw = Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield;
  const keywords = Array.isArray(r.keywords) ? r.keywords : String(r.keywords ?? "").split(",");
  const cat = [].concat(r.recipeCategory ?? []).map(clean).join(" ");
  return {
    name: clean(r.name),
    description: clean(r.description).slice(0, 400),
    servings: Math.round(numOf(yieldRaw)) || 2,
    prepMinutes: minutes(r.prepTime),
    cookMinutes: minutes(r.cookTime) || Math.max(0, minutes(r.totalTime) - minutes(r.prepTime)),
    category: cat,
    tags: keywords.map(clean).filter((x: string) => x && x.length < 30).slice(0, 6),
    ingredients: [].concat(r.recipeIngredient ?? r.ingredients ?? []).map(clean).filter(Boolean),
    steps: steps(r.recipeInstructions),
    nutrition: n && typeof n === "object" ? {
      kcal: numOf(n.calories), protein: numOf(n.proteinContent), carbs: numOf(n.carbohydrateContent),
      fat: numOf(n.fatContent), fiber: numOf(n.fiberContent),
    } : null,
    source: url,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const raw = String(body?.url ?? "").trim();
  if (!raw || raw.length > 2000) return json({ error: "bad_url" }, 400);
  let page;
  try { page = await fetchPage(raw); } catch (e) { return json({ error: (e as Error).message || "fetch_failed" }, 422); }
  const blocks = [...page.html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data;
    try { data = JSON.parse(b[1].trim()); } catch { try { data = JSON.parse(decode(b[1].trim())); } catch { continue; } }
    const r = findRecipe(data);
    if (r) {
      const out = normalize(r, page.url);
      if (out.name && (out.ingredients.length || out.steps.length)) return json({ recipe: out });
    }
  }
  // Sin datos estructurados: texto visible para pasarlo a la IA
  const text = clean(page.html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")).slice(0, 8000);
  const title = clean((page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  return json({ error: "no_recipe", title, text, url: page.url });
});
