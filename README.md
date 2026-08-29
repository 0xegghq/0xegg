# 0xegg.com

Studio site plus **Wallet X-Ray**, a read-only cross-chain wallet profiler.

Astro 7, Cloudflare adapter, no runtime dependencies. The marketing pages are
prerendered static HTML; only `/api/xray` runs on the server.

```
src/
  lib/site.ts      site config — email, links, pricing, tool copy
  lib/xray.ts      chain list, Etherscan client, throttle, stats reduction
  layouts/         shared page shell
  pages/index.astro   landing page
  pages/x-ray.astro   the tool
  pages/api/xray.ts   scan endpoint
test/              stubbed-API tests, no key required
```

## Setup

Get a free key at <https://etherscan.io/apis>, then:

```bash
cp .dev.vars.example .dev.vars
```

Fill in `ETHERSCAN_API_KEY`. Run it:

```bash
npm run dev
```

## Tests

Stub the Etherscan API, so they need no key and hit no network:

```bash
npm test
```

## Deploy

```bash
npx wrangler deploy
```

The API key is a secret, not a var — set it once on the Worker:

```bash
npx wrangler secret put ETHERSCAN_API_KEY
```

## How the scanner works

One request fans out across the [Etherscan V2 multichain
API](https://docs.etherscan.io/), where a single key serves every chain via a
`chainid` parameter.

Per chain it makes **one** `txlist` call for up to 2,000 transactions and
reduces them server-side into counts, gas spent, distinct contracts called,
contracts deployed, and first/last activity. A `balance` call follows only for
chains that showed activity, so idle chains cost one request instead of two.
When a history is truncated, one extra descending call recovers the true
last-activity date — otherwise it would report the timestamp of the 2,000th
*oldest* transaction.

The free tier allows 3 requests/second, so every call is serialized through a
350ms throttle. A typical scan is 9–11 requests over about three seconds.

### Chain coverage

Free-tier chains are scanned by default: Ethereum, Arbitrum, Polygon, Unichain,
Linea, Berachain, Sonic, Gnosis.

Base, OP Mainnet, BNB Chain and Avalanche require a paid Etherscan plan — they
return `Free API access is not supported for this chain`. They are defined in
`CHAINS` with `paidOnly: true` and excluded unless you set:

```
ETHERSCAN_PAID_PLAN=true
```

Verify against your own key before enabling; plan tiers change.
