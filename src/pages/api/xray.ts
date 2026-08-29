import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAddress, scan } from "../../lib/xray";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const GET: APIRoute = async ({ url }) => {
  const address = (url.searchParams.get("address") ?? "").trim();

  if (!isAddress(address)) {
    return json({ error: "Provide a valid 0x-prefixed EVM address." }, 400);
  }

  const apiKey = env.ETHERSCAN_API_KEY;
  const paidPlan = env.ETHERSCAN_PAID_PLAN === "true";

  if (!apiKey) {
    return json({ error: "Server is missing ETHERSCAN_API_KEY." }, 500);
  }

  try {
    return json(await scan(address, apiKey, paidPlan));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    return json({ error: message }, 502);
  }
};
