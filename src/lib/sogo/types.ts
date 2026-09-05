export type SogoApiErrorShape = {
  message?: string;
  error?: string;
  errors?: Record<string, unknown> | Array<Record<string, unknown>> | string;
  status?: number;
  code?: string;
  details?: unknown;
};

export type SogoEnvelope<T> = {
  data?: T;
  result?: T;
  status?: string;
  message?: string;
  error?: string | { message?: string };
  errors?: unknown;
  [key: string]: unknown;
};

export type GiftCardCatalogItem = {
  id?: string;
  brand?: string;
  name?: string;
  code?: string;
  slug?: string;
  countries?: string[];
  card_types?: string[];
  category?: string;
  currency?: string;
  card_type?: string;
  rate?: number;
  min_amount?: number;
  max_amount?: number;
  min_deposit_usd?: number;
  is_active?: boolean;
  [key: string]: unknown;
};

export type GiftCardRateItem = {
  id?: string;
  brand?: string;
  name?: string;
  code?: string;
  slug?: string;
  rates?: unknown;
  category?: string;
  currency?: string;
  card_type?: string;
  rate?: number;
  buy_rate?: number;
  sell_rate?: number;
  payout?: number;
  min_amount?: number;
  is_active?: boolean;
  [key: string]: unknown;
};

export type CryptoAssetItem = {
  id?: string;
  symbol?: string;
  asset?: string;
  name?: string;
  network?: string;
  networks?: string[];
  currency?: string;
  rate?: number;
  buy_rate?: number;
  sell_rate?: number;
  is_active?: boolean;
  min_deposit_usd?: number;
  fee_tiers?: unknown[];
  [key: string]: unknown;
};

export type ProviderReferenceResult = {
  providerReference?: string;
  providerTransactionId?: string;
  providerStatus?: string;
};
