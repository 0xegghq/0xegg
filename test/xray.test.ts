// Stubs the Etherscan API so the reduction logic can be verified without a key.
import { scan, FREE_CHAINS, isAddress } from "../src/lib/xray.ts";

const ME = "0xAAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";
const OTHER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TOKEN = "0xcccccccccccccccccccccccccccccccccccccccc";
const DEX = "0xdddddddddddddddddddddddddddddddddddddddd";

const GWEI = "1000000000";

// 5 txs on Ethereum: 3 sent (2 contract calls to distinct contracts, 1 deploy),
// 1 received, 1 failed send.
const ETH_TXS = [
  { timeStamp: "1600000000", from: OTHER, to: ME, gasUsed: "21000", gasPrice: GWEI, isError: "0", input: "0x", contractAddress: "" },
  { timeStamp: "1610000000", from: ME, to: TOKEN, gasUsed: "50000", gasPrice: GWEI, isError: "0", input: "0xa9059cbb", contractAddress: "" },
  { timeStamp: "1620000000", from: ME, to: DEX, gasUsed: "100000", gasPrice: GWEI, isError: "0", input: "0x38ed1739", contractAddress: "" },
  { timeStamp: "1630000000", from: ME, to: TOKEN, gasUsed: "40000", gasPrice: GWEI, isError: "1", input: "0xa9059cbb", contractAddress: "" },
  { timeStamp: "1640000000", from: ME, to: "", gasUsed: "800000", gasPrice: GWEI, isError: "0", input: "0x60806040", contractAddress: "0xdead00000000000000000000000000000000beef" },
];

const calls: string[] = [];
const times: number[] = [];

globalThis.fetch = (async (url: URL | string) => {
  const u = new URL(String(url));
  const chainid = u.searchParams.get("chainid")!;
  const action = u.searchParams.get("action")!;
  calls.push(`${chainid}:${action}`);
  times.push(Date.now());

  const body = (v: unknown, status = "1", message = "OK") =>
    new Response(JSON.stringify({ status, message, result: v }), {
      headers: { "content-type": "application/json" },
    });

  if (action === "txlist") {
    if (chainid === "1") return body(ETH_TXS);
    if (chainid === "137") return body("Max rate limit reached", "0", "NOTOK");
    return body("No transactions found", "0", "NOTOK");
  }
  if (action === "balance") return body("1500000000000000000"); // 1.5
  throw new Error(`unexpected action ${action}`);
}) as typeof fetch;

// --- assertions -------------------------------------------------------------
let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
}

check("isAddress accepts a valid address", isAddress(ME), true);
check("isAddress rejects short input", isAddress("0x1234"), false);
check("isAddress rejects non-hex", isAddress("0x" + "z".repeat(40)), false);

const started = Date.now();
const report = await scan(ME, "test-key");
const elapsed = Date.now() - started;

const eth = report.chains.find((c) => c.chain.id === 1)!;
check("ethereum active", eth.active, true);
check("tx count", eth.txCount, 5);
check("outgoing", eth.outgoing, 4);
check("incoming", eth.incoming, 1);
check("failed", eth.failed, 1);
// gas paid by ME only: (50000 + 100000 + 40000 + 800000) * 1 gwei = 0.00099 ETH
check("gas spent", eth.gasSpent, "0.0009");
check("distinct contracts called", eth.contractsUsed, 2);
check("contracts deployed", eth.contractsDeployed, 1);
check("first seen is oldest tx", eth.firstSeen, 1600000000);
check("last seen is newest tx", eth.lastSeen, 1640000000);
check("balance formatted", eth.balance, "1.5");
check("not truncated", eth.truncated, false);

const idle = report.chains.find((c) => c.chain.id === 59144)!;
check("no-activity chain is inactive", idle.active, false);
check("no-activity chain has no error", idle.error, null);
check("no-activity chain balance zero", idle.balance, "0");

const errored = report.chains.find((c) => c.chain.id === 137)!;
check("rate-limited chain surfaces error", errored.error, "Max rate limit reached");
check("rate-limited chain inactive", errored.active, false);

check("totals: active chains", report.totals.activeChains, 1);
check("totals: tx count", report.totals.txCount, 5);
check("totals: contracts used", report.totals.contractsUsed, 2);
check("totals: first seen", report.totals.firstSeen, 1600000000);

// Balance is only fetched for chains with activity: 8 txlist + 1 balance.
check("call count is minimal", calls.length, FREE_CHAINS.length + 1);
check("balance calls", calls.filter((c) => c.endsWith(":balance")), ["1:balance"]);

// Throttle: no two calls closer than ~350ms.
const gaps = times.slice(1).map((t, i) => t - times[i]);
const tooFast = gaps.filter((g) => g < 300).length;
check("throttle spaced all calls", tooFast, 0);
console.log(`      ${calls.length} calls in ${elapsed}ms, min gap ${Math.min(...gaps)}ms`);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
