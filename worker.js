/**
 * Cloudflare Worker: secure Telegram relay for the Deriv Live scanner.
 * Secrets required in Cloudflare:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *   ALERT_KEY
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Alert-Key",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }
  });
}
function clean(value, max = 300) {
  return String(value ?? "").replace(/[<>]/g, "").slice(0, max);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "Deriv Live Telegram relay" });
    }
    if (request.method !== "POST" || url.pathname !== "/telegram") {
      return json({ ok: false, error: "Not found" }, 404);
    }
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.ALERT_KEY) {
      return json({ ok: false, error: "Worker secrets are not configured" }, 500);
    }
    const supplied = request.headers.get("X-Alert-Key") || "";
    if (supplied.length !== env.ALERT_KEY.length || supplied !== env.ALERT_KEY) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    let body;
    try { body = await request.json(); }
    catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

    const market = clean(body.market || body.symbol || "Market", 100);
    const direction = clean(body.direction || "", 12);
    const score = clean(body.score ?? "", 20);
    const entry = clean(body.entry || "Not confirmed", 100);
    const stop = clean(body.stop_loss || "Not confirmed", 100);
    const targets = Array.isArray(body.take_profits)
      ? body.take_profits.slice(0, 3).map((x, i) => `TP${i + 1}: ${clean(x, 100)}`).join("\n")
      : "";
    const zone = clean(body.zone || "Not specified", 160);
    const trigger = clean(body.trigger || "", 400);
    const stamp = clean(body.time || new Date().toISOString(), 50);
    const message = [
      "🟡 DERIV LIVE — READY SIGNAL",
      `Market: ${market}`,
      `Direction: ${direction}`,
      `Score: ${score}/10`,
      `Entry: ${entry}`,
      `Stop loss: ${stop}`,
      targets,
      `Zone: ${zone}`,
      trigger ? `Confirmation: ${trigger}` : "",
      `Time: ${stamp}`,
      "\nCheck the live chart and confirm manually before trading."
    ].filter(Boolean).join("\n");

    const telegram = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message, disable_web_page_preview: true })
    });
    const result = await telegram.json().catch(() => ({}));
    if (!telegram.ok || !result.ok) {
      return json({ ok: false, error: "Telegram rejected the message", details: result.description || "Unknown Telegram API error" }, 502);
    }
    return json({ ok: true, message_id: result.result?.message_id });
  }
};
