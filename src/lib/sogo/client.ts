export type SogoRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
  idempotencyKey?: string;
};

function getBaseUrl() {
  const raw = process.env.SOGO_BASE_URL ?? "https://sandbox.sogo.africa/v1";
  return raw.replace(/\/+$/, "");
}

function getSecretKey() {
  return (process.env.SOGO_SECRET_KEY ?? "").replace(/\s+/g, "");
}

function joinUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

function normalizeBody(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (value instanceof FormData) return value;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function buildQuery(params?: Record<string, string | number | undefined | null>) {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
  if (!entries.length) return "";
  const query = new URLSearchParams();
  for (const [key, value] of entries) {
    query.set(key, String(value));
  }
  return `?${query.toString()}`;
}

function parseSogoError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Sogo request failed.";
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) return nested.message;
  }
  if (Array.isArray(record.errors) && record.errors.length > 0) {
    const first = record.errors[0];
    if (first && typeof first === "object") {
      const message = (first as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  if (record.details && typeof record.details === "string") return record.details;
  return "Sogo request failed.";
}

export function getSogoConfig() {
  const baseUrl = getBaseUrl();
  const secret = getSecretKey();
  if (!baseUrl) throw new Error("SOGO_BASE_URL is not configured.");
  if (!secret) throw new Error("SOGO_SECRET_KEY is not configured.");
  return { baseUrl, secret };
}

export async function sogoRequest<T>(path: string, options: SogoRequestOptions = {}): Promise<T> {
  const { baseUrl, secret } = getSogoConfig();
  const method = options.method ?? "GET";
  const url = new URL(joinUrl(baseUrl, path));
  const query = buildQuery(options.params);
  url.search = query.replace(/^\?/, "");

  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${secret}`,
    ...(options.headers ?? {}),
  });
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);

  const body = normalizeBody(options.body);
  if (body !== undefined && method !== "GET" && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeout = 20000;
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const signal = options.signal ?? controller.signal;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal,
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(response.ok ? "Sogo returned an invalid response." : "Sogo request failed.");
      }
    }

    if (!response.ok) {
      throw new Error(parseSogoError(parsed));
    }

    if (parsed === null || parsed === undefined) return {} as T;

    if (parsed && typeof parsed === "object" && "data" in parsed && parsed.data !== undefined) {
      return parsed.data as T;
    }
    if (parsed && typeof parsed === "object" && "result" in parsed && parsed.result !== undefined) {
      return parsed.result as T;
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Sogo request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function extractSogoReference(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const candidates = [
    "providerReference",
    "provider_reference",
    "reference",
    "order_id",
    "orderId",
    "transaction_id",
    "transactionId",
    "id",
    "provider_transaction_id",
    "providerTransactionId",
    "external_reference",
    "externalReference",
  ];

  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  if (record.data && typeof record.data === "object") {
    return extractSogoReference(record.data);
  }

  if (record.result && typeof record.result === "object") {
    return extractSogoReference(record.result);
  }

  return undefined;
}

export function extractSogoStatus(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const candidates = ["status", "state", "provider_status", "providerStatus", "transaction_status", "transactionStatus"];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  if (record.data && typeof record.data === "object") return extractSogoStatus(record.data);
  if (record.result && typeof record.result === "object") return extractSogoStatus(record.result);
  return undefined;
}

