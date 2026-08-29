// Verifies that a wallet with more history than one page still reports the
// real last-activity date, not the timestamp of the 2000th oldest transaction.
import { scan } from "../src/lib/xray.ts";

const ME = "0xAAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";
const OLDEST = 1500000000;
const PAGE_END = 1550000000; // timestamp of the 2000th oldest tx
const REAL_LAST = 1760000000; // the wallet's actual most recent tx

const page = Array.from({ length: 2000 }, (_, i) => ({
  timeStamp: String(i === 1999 ? PAGE_END : OLDEST + i),
  from: ME,
  to: "0xcccccccccccccccccccccccccccccccccccccccc",
  gasUsed: "21000",
  gasPrice: "1000000000",
  isError: "0",
  input: "0x",
  contractAddress: "",
}));

const calls: Array<{ chain: string; action: string; sort: string | null; offset: string | null }> = [];

globalThis.fetch = (async (url: URL | string) => {
  const u = new URL(String(url));
  const action = u.searchParams.get("action")!;
  const chainid = u.searchParams.get("chainid")!;
  const sort = u.searchParams.get("sort");
  const offset = u.searchParams.get("offset");
  calls.push({ chain: chainid, action, sort, offset });

  const body = (v: unknown, status = "1") =>
    new Response(JSON.stringify({ status, message: status === "1" ? "OK" : "NOTOK", result: v }), {
      headers: { "content-type": "application/json" },
    });

  if (action === "balance") return body("0");
  if (chainid !== "1") return body("No transactions found", "0");
  if (sort === "desc") {
    return body([{ ...page[0], timeStamp: String(REAL_LAST) }]);
  }
  return body(page);
}) as typeof fetch;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
}

const report = await scan(ME, "test-key");
const eth = report.chains.find((c) => c.chain.id === 1)!;

check("marked truncated", eth.truncated, true);
check("first seen is the oldest tx", eth.firstSeen, OLDEST);
check("last seen is the REAL latest, not the page end", eth.lastSeen, REAL_LAST);
check("counts are the page floor", eth.txCount, 2000);
check("totals use the corrected last seen", report.totals.lastSeen, REAL_LAST);

const descCalls = calls.filter((c) => c.sort === "desc");
check("exactly one descending lookup", descCalls.length, 1);
check("descending lookup asks for one row", descCalls[0]?.offset, "1");
check("descending lookup only on the truncated chain", descCalls[0]?.chain, "1");

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
