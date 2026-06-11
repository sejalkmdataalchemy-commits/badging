async function loadDotenv() {
  try {
    const envFile = new URL("./.env", import.meta.url);
    const text = await Deno.readTextFile(envFile);
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) continue;
      const key = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim();
      if (!Deno.env.get(key)) {
        Deno.env.set(key, value.replace(/^"|"$/g, ""));
      }
    }
  } catch {
    // .env is optional; continue if not present.
  }
}

await loadDotenv();

const missing = [];
if (!Deno.env.get("SUPABASE_URL")) missing.push("SUPABASE_URL");
if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!Deno.env.get("SUPABASE_ANON_KEY")) missing.push("SUPABASE_ANON_KEY");
if (missing.length) {
  console.error("Missing required environment variables:", missing.join(", "));
  console.error("Set them in the terminal or in supabase/functions/calculate-platform-veteran-badge-support/.env");
  Deno.exit(1);
}

const { default: handler } = await import("../calculate-platform-veteran-badge/index.ts");

const rawArgs = Deno.args.length ? Deno.args.join(" ").trim() : "";
let payload = { worker_id: "" };
if (rawArgs) {
  if (rawArgs.startsWith("{") || rawArgs.startsWith("[")) {
    try {
      payload = JSON.parse(rawArgs);
    } catch (error) {
      console.error("Invalid JSON payload:", error.message);
      console.error("Received argument:", rawArgs);
      Deno.exit(1);
    }
  } else if (rawArgs.startsWith("--worker_id=")) {
    payload.worker_id = rawArgs.slice("--worker_id=".length);
  } else if (rawArgs.startsWith("worker_id=")) {
    payload.worker_id = rawArgs.slice("worker_id=".length);
  } else {
    payload.worker_id = rawArgs;
  }
}

const authToken = Deno.env.get("TEST_AUTH_TOKEN") ?? "test-token";
const apiKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "anon-key";

const request = new Request("http://localhost/functions/v1/calculate-platform-veteran-badge", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
    apikey: apiKey,
  },
  body: JSON.stringify(payload),
});

const response = await handler(request);
const text = await response.text();
console.log("HTTP", response.status);
console.log(text);
