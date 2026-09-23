import Decimal from "decimal.js";

export function toDecimal(value: unknown, fallback = "0"): Decimal {
  const source = value === null || value === undefined ? fallback : String(value);
  const parsed = new Decimal(source);

  if (!parsed.isFinite()) {
    return new Decimal(fallback);
  }

  return parsed;
}

export function roundMoney(value: unknown, places = 2): number {
  return toDecimal(value)
    .toDecimalPlaces(places, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function computeNairaPayout(amount: number | string, rate: number | string): number {
  const payout = toDecimal(amount).mul(toDecimal(rate));

  if (payout.lte(0)) {
    return 0;
  }

  return payout
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}
