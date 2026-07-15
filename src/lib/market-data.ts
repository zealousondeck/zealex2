// Static reference data for the Zealex marketing site (client-safe, no secrets).
// Rates are illustrative baselines; the live app will pull real rates from the backend.

export type CryptoAsset = {
  symbol: string;
  name: string;
  networks: string[];
  buyRate: number; // NGN per unit
  change24h: number; // percent
};

export const cryptoAssets: CryptoAsset[] = [
  { symbol: "BTC", name: "Bitcoin", networks: ["Bitcoin"], buyRate: 104_250_000, change24h: 2.41 },
  { symbol: "ETH", name: "Ethereum", networks: ["ERC20"], buyRate: 5_420_000, change24h: 1.12 },
  { symbol: "USDT", name: "Tether", networks: ["TRC20", "ERC20"], buyRate: 1_615, change24h: 0.05 },
  { symbol: "BNB", name: "BNB", networks: ["BEP20"], buyRate: 1_010_000, change24h: -0.83 },
  { symbol: "SOL", name: "Solana", networks: ["Solana"], buyRate: 235_000, change24h: 3.67 },
  { symbol: "LTC", name: "Litecoin", networks: ["Litecoin"], buyRate: 168_000, change24h: 0.94 },
  { symbol: "DOGE", name: "Dogecoin", networks: ["Dogecoin"], buyRate: 285, change24h: -1.24 },
];

export type GiftCard = {
  brand: string;
  category: string;
  currency: string;
  ratePerUnit: number; // NGN per 1 unit of card currency
  change24h: number;
};

export const giftCards: GiftCard[] = [
  { brand: "Amazon", category: "E-commerce", currency: "USD", ratePerUnit: 1_180, change24h: 0.6 },
  { brand: "Apple / iTunes", category: "Entertainment", currency: "USD", ratePerUnit: 1_240, change24h: 1.1 },
  { brand: "Steam", category: "Gaming", currency: "USD", ratePerUnit: 1_320, change24h: -0.4 },
  { brand: "Google Play", category: "Apps", currency: "USD", ratePerUnit: 1_090, change24h: 0.2 },
  { brand: "Sephora", category: "Retail", currency: "USD", ratePerUnit: 990, change24h: 0.0 },
  { brand: "Razer Gold", category: "Gaming", currency: "USD", ratePerUnit: 1_270, change24h: 0.8 },
  { brand: "Nordstrom", category: "Retail", currency: "USD", ratePerUnit: 1_050, change24h: -0.3 },
  { brand: "eBay", category: "E-commerce", currency: "USD", ratePerUnit: 1_010, change24h: 0.4 },
];

export const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export const faqs = [
  {
    q: "How fast are payouts on Zealex?",
    a: "Most gift card and crypto trades are reviewed and paid within 5–15 minutes during business hours. Verified users with a strong history are often paid in under 5 minutes.",
  },
  {
    q: "Which gift cards and cryptocurrencies do you support?",
    a: "We support 50+ gift card brands including Amazon, Apple, Steam, and Google Play, plus BTC, ETH, USDT (TRC20/ERC20), BNB, SOL, LTC, and DOGE.",
  },
  {
    q: "Is Zealex safe to use?",
    a: "Yes. We use bank-grade encryption, two-factor authentication, tiered KYC verification, and row-level data protection to keep every account and transaction secure.",
  },
  {
    q: "Do I need to complete KYC to trade?",
    a: "You can explore rates freely. To withdraw and to unlock higher limits you complete a quick KYC (BVN/NIN or a government ID plus a selfie).",
  },
  {
    q: "What fees does Zealex charge?",
    a: "The rate you see is the rate you get — there are no hidden fees. Withdrawals to Nigerian bank accounts are free.",
  },
];

export const testimonials = [
  {
    name: "Adebayo O.",
    role: "Gift card trader",
    quote:
      "Zealex pays faster than any platform I've used. I sold an Amazon card and had cash in my bank before I finished my coffee.",
    initials: "AO",
  },
  {
    name: "Chiamaka N.",
    role: "Crypto investor",
    quote:
      "The rates are genuinely the best I've found, and the dashboard makes tracking every trade effortless. This feels premium.",
    initials: "CN",
  },
  {
    name: "Ibrahim M.",
    role: "Freelancer",
    quote:
      "Verification took minutes and withdrawals hit instantly. Zealex is now the only exchange I trust with my earnings.",
    initials: "IM",
  },
];
