/**
 * Wallet X-Ray — cross-chain activity profile from the Etherscan V2 multichain API.
 *
 * One API key, one base URL, `chainid` selects the chain. The free tier allows
 * 3 calls/second, so every request goes through a serial throttle below.
 */

const API = "https://api.etherscan.io/v2/api";

/** Free tier is 3 calls/sec; 350ms spacing leaves headroom. */
const MIN_CALL_SPACING_MS = 350;

/** txlist returns at most 10k rows. We cap lower to bound the response size. */
const TX_PAGE_SIZE = 2000;

export type Chain = {
  id: number;
  name: string;
  symbol: string;
  explorer: string;
  /**
   * Etherscan gates some chains behind a paid plan. On a free key those return
   * "Free API access is not supported for this chain", so they are only scanned
   * when ETHERSCAN_PAID_PLAN is set.
   */
  paidOnly?: true;
};

export const CHAINS: Chain[] = [
  { id: 1, name: "Ethereum", symbol: "ETH", explorer: "https://etherscan.io" },
  { id: 42161, name: "Arbitrum", symbol: "ETH", explorer: "https://arbiscan.io" },
  { id: 137, name: "Polygon", symbol: "POL", explorer: "https://polygonscan.com" },
  { id: 130, name: "Unichain", symbol: "ETH", explorer: "https://uniscan.xyz" },
  { id: 59144, name: "Linea", symbol: "ETH", explorer: "https://lineascan.build" },
  { id: 80094, name: "Berachain", symbol: "BERA", explorer: "https://berascan.com" },
  { id: 146, name: "Sonic", symbol: "S", explorer: "https://sonicscan.org" },
  { id: 100, name: "Gnosis", symbol: "XDAI", explorer: "https://gnosisscan.io" },
  { id: 8453, name: "Base", symbol: "ETH", explorer: "https://basescan.org", paidOnly: true },
  { id: 10, name: "OP Mainnet", symbol: "ETH", explorer: "https://optimistic.etherscan.io", paidOnly: true },
  { id: 56, name: "BNB Chain", symbol: "BNB", explorer: "https://bscscan.com", paidOnly: true },
  { id: 43114, name: "Avalanche", symbol: "AVAX", explorer: "https://snowscan.xyz", paidOnly: true },
];

/** Chains the current plan can actually reach. */
export function chainsFor(paidPlan: boolean): Chain[] {
  return paidPlan ? CHAINS : CHAINS.filter((c) => !c.paidOnly);
}

export const FREE_CHAINS = chainsFor(false);

export type ChainReport = {
  chain: Chain;
  active: boolean;
  balance: string | null;
  txCount: number;
  truncated: boolean;
  firstSeen: number | null;
  lastSeen: number | null;
  outgoing: number;
  incoming: number;
  failed: number;
  gasSpent: string;
  contractsUsed: number;
  contractsDeployed: number;
  error: string | null;
};

export type Report = {
  address: string;
  scannedAt: number;
  chains: ChainReport[];
  totals: {
    activeChains: number;
    txCount: number;
    contractsUsed: number;
    contractsDeployed: number;
    firstSeen: number | null;
    lastSeen: number | null;
  };
};

type EtherscanTx = {
  timeStamp: string;
  from: string;
  to: string;
  gasUsed: string;
  gasPrice: string;
  isError: string;
  input: string;
  contractAddress: string;
};

export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

/**
 * Serial queue. Etherscan counts calls per key, not per chain, so firing chain
 * requests in parallel trips the rate limit — everything funnels through here.
 */
function createThrottle(spacingMs: number) {
  let chain: Promise<unknown> = Promise.resolve();
  return function throttle<T>(task: () => Promise<T>): Promise<T> {
    const result = chain.then(task);
    chain = result.then(
      () => sleep(spacingMs),
      () => sleep(spacingMs),
    );
    return result;
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function call(
  params: Record<string, string>,
  apiKey: string,
): Promise<{ status: string; message: string; result: unknown }> {
  const url = new URL(API);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Etherscan returned HTTP ${res.status}`);
  }
  return (await res.json()) as { status: string; message: string; result: unknown };
}

/** Wei to a short decimal string, without pulling in a bignum library. */
function formatUnits(wei: bigint, decimals = 18, places = 4): string {
  const base = 10n ** BigInt(decimals);
  const whole = wei / base;
  const fraction = wei % base;
  if (fraction === 0n) return whole.toString();
  const padded = fraction.toString().padStart(decimals, "0").slice(0, places);
  const trimmed = padded.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

type Stats = Omit<ChainReport, "chain" | "balance" | "error" | "active">;

function summarize(address: string, txs: EtherscanTx[]): Stats {
  const me = address.toLowerCase();
  const contracts = new Set<string>();
  let outgoing = 0;
  let incoming = 0;
  let failed = 0;
  let deployed = 0;
  let gas = 0n;

  for (const tx of txs) {
    const from = tx.from?.toLowerCase() ?? "";
    const to = tx.to?.toLowerCase() ?? "";
    const sentByMe = from === me;

    if (sentByMe) {
      outgoing++;
      // Only the sender pays gas.
      gas += BigInt(tx.gasUsed || "0") * BigInt(tx.gasPrice || "0");
      if (tx.contractAddress) deployed++;
      // A non-empty calldata field means this was a contract call, not a transfer.
      if (to && tx.input && tx.input !== "0x") contracts.add(to);
    } else {
      incoming++;
    }

    if (tx.isError === "1") failed++;
  }

  // txs arrive ascending, so the ends of the array are the first and last activity.
  const first = txs[0];
  const last = txs[txs.length - 1];

  return {
    txCount: txs.length,
    truncated: txs.length >= TX_PAGE_SIZE,
    firstSeen: first ? Number(first.timeStamp) : null,
    lastSeen: last ? Number(last.timeStamp) : null,
    outgoing,
    incoming,
    failed,
    gasSpent: formatUnits(gas),
    contractsUsed: contracts.size,
    contractsDeployed: deployed,
  };
}

const EMPTY = {
  txCount: 0,
  truncated: false,
  firstSeen: null,
  lastSeen: null,
  outgoing: 0,
  incoming: 0,
  failed: 0,
  gasSpent: "0",
  contractsUsed: 0,
  contractsDeployed: 0,
};

export async function scan(
  address: string,
  apiKey: string,
  paidPlan = false,
): Promise<Report> {
  const throttle = createThrottle(MIN_CALL_SPACING_MS);

  const chains = await Promise.all(
    chainsFor(paidPlan).map(async (chain): Promise<ChainReport> => {
      try {
        const txRes = await throttle(() =>
          call(
            {
              chainid: String(chain.id),
              module: "account",
              action: "txlist",
              address,
              startblock: "0",
              endblock: "99999999",
              page: "1",
              offset: String(TX_PAGE_SIZE),
              sort: "asc",
            },
            apiKey,
          ),
        );

        // status "0" with an array result means no transactions, which is a
        // valid answer rather than a failure.
        const txs = Array.isArray(txRes.result) ? (txRes.result as EtherscanTx[]) : [];
        if (txRes.status !== "1" && txs.length === 0) {
          const note = typeof txRes.result === "string" ? txRes.result : txRes.message;
          const noData = /no transactions found/i.test(note ?? "");
          if (!noData) {
            return { chain, active: false, balance: null, error: note || "Lookup failed", ...EMPTY };
          }
        }

        if (txs.length === 0) {
          return { chain, active: false, balance: "0", error: null, ...EMPTY };
        }

        // Only worth a second call once we know the address has touched this chain.
        const balRes = await throttle(() =>
          call(
            {
              chainid: String(chain.id),
              module: "account",
              action: "balance",
              address,
              tag: "latest",
            },
            apiKey,
          ),
        );
        const balance =
          balRes.status === "1" && typeof balRes.result === "string"
            ? formatUnits(BigInt(balRes.result))
            : null;

        const stats = summarize(address, txs);

        // The page above is the OLDEST TX_PAGE_SIZE transactions, so on a
        // truncated history its last entry is not the wallet's last activity.
        // One descending row gives the real answer.
        if (stats.truncated) {
          const latest = await throttle(() =>
            call(
              {
                chainid: String(chain.id),
                module: "account",
                action: "txlist",
                address,
                startblock: "0",
                endblock: "99999999",
                page: "1",
                offset: "1",
                sort: "desc",
              },
              apiKey,
            ),
          );
          const rows = Array.isArray(latest.result) ? (latest.result as EtherscanTx[]) : [];
          if (rows[0]) stats.lastSeen = Number(rows[0].timeStamp);
        }

        return { chain, active: true, balance, error: null, ...stats };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Lookup failed";
        return { chain, active: false, balance: null, error: message, ...EMPTY };
      }
    }),
  );

  const active = chains.filter((c) => c.active);
  const firstSeens = active.map((c) => c.firstSeen).filter((t): t is number => t !== null);
  const lastSeens = active.map((c) => c.lastSeen).filter((t): t is number => t !== null);

  return {
    address,
    scannedAt: Math.floor(Date.now() / 1000),
    chains,
    totals: {
      activeChains: active.length,
      txCount: active.reduce((sum, c) => sum + c.txCount, 0),
      contractsUsed: active.reduce((sum, c) => sum + c.contractsUsed, 0),
      contractsDeployed: active.reduce((sum, c) => sum + c.contractsDeployed, 0),
      firstSeen: firstSeens.length ? Math.min(...firstSeens) : null,
      lastSeen: lastSeens.length ? Math.max(...lastSeens) : null,
    },
  };
}
