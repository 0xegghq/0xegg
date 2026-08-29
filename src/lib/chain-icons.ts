import avalanche from "@web3icons/core/svgs/networks/branded/avalanche.svg.js";
import arbitrum from "@web3icons/core/svgs/networks/branded/arbitrum-one.svg.js";
import base from "@web3icons/core/svgs/networks/background/base.svg.js";
import berachain from "@web3icons/core/svgs/networks/branded/berachain.svg.js";
import bnb from "@web3icons/core/svgs/networks/branded/binance-smart-chain.svg.js";
import ethereum from "@web3icons/core/svgs/networks/branded/ethereum.svg.js";
import gnosis from "@web3icons/core/svgs/networks/branded/gnosis.svg.js";
import linea from "@web3icons/core/svgs/networks/background/linea.svg.js";
import optimism from "@web3icons/core/svgs/networks/branded/optimism.svg.js";
import polygon from "@web3icons/core/svgs/networks/branded/polygon.svg.js";
import sonic from "@web3icons/core/svgs/networks/background/sonic.svg.js";
import unichain from "@web3icons/core/svgs/networks/branded/unichain.svg.js";

export type ChainIcon = {
  src: string;
  color: string;
};

function asDataUrl(svg: string, color: string): ChainIcon {
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    color,
  };
}

/**
 * Branded network marks used by the X-Ray page. The colors are the accent
 * colors used for each network's hover state, not replacements for the marks.
 */
export const CHAIN_ICONS: Record<number, ChainIcon> = {
  1: asDataUrl(ethereum, "#627eea"),
  42161: asDataUrl(arbitrum, "#12aaff"),
  137: asDataUrl(polygon, "#8247e5"),
  130: asDataUrl(unichain, "#f50db4"),
  59144: asDataUrl(linea, "#61dfff"),
  80094: asDataUrl(berachain, "#fb9942"),
  146: asDataUrl(sonic, "#ffffff"),
  100: asDataUrl(gnosis, "#3e6957"),
  8453: asDataUrl(base, "#0052ff"),
  10: asDataUrl(optimism, "#fe0420"),
  56: asDataUrl(bnb, "#f0b90b"),
  43114: asDataUrl(avalanche, "#e84142"),
};
