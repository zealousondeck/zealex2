import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Zealex Assistant — streaming chat endpoint.
 *
 * Sends only the current question text plus the admin-managed confirmed-facts
 * prompt to the model. Never sends user profile/account data, never persists
 * anything. Input is capped at 500 characters and answers are token-capped. A
 * best-effort in-memory rate limit allows ~10 requests/minute per IP.
 */

const MAX_INPUT_CHARS = 500;
const MAX_OUTPUT_TOKENS = 700;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const BASE_INSTRUCTIONS = `You are the Zealex Assistant. Only answer questions about Zealex's services and general help using the platform. Be concise, friendly and clear. Never give financial, legal or investment advice. Never claim to see a user's balance, orders or personal data, and never ask for passwords, card codes, seed phrases or private keys. For account-specific issues, tell the user to contact support. If you don't know something about Zealex, say so instead of guessing.

Never invent rates, fees, limits, or any other Zealex detail not listed in the confirmed facts below. Keep answers short (2-5 sentences unless the user asks for steps).

When your answer relies on one or more of the confirmed facts, end your reply with one final line in exactly this format (comma-separated bracketed ids only):
Sources: <fact_id>, <fact_id>
For example: Sources: payout_timing, support_email
Omit that line entirely if you used no confirmed fact. Never mention fact ids anywhere except that final line.`;

type AssistantFact = { id: string; label: string; body: string; active: boolean };

const DEFAULT_FACTS: AssistantFact[] = [
  { id: "payout_timing", label: "Payout timing", body: "Payouts are typically completed within about 5 minutes.", active: true },
  {
    id: "supported_countries",
    label: "Supported countries",
    body: "Zealex currently supports Nigeria, Ghana, and South Africa. Other African markets may be added later but are not confirmed yet.",
    active: true,
  },
  {
    id: "support_email",
    label: "Support contact",
    body: "For account-specific issues, contact support at Zealousreturn@gmail.com.",
    active: true,
  },
  {
    id: "fees",
    label: "Fees",
    body: "Fee details are not confirmed yet. Say you don't have fee details right now and suggest checking the app or contacting support.",
    active: true,
  },
  {
    id: "services",
    label: "Services",
    body: "Zealex supports selling gift cards for Naira and selling crypto (BTC, ETH, USDT, BNB, LTC, DOGE, SOL) with network selection, wallet address, QR code and confirmation tracking, KYC verification, Paystack instant deposits, withdrawals to saved bank accounts or crypto wallets, a referral program, and live exchange rates.",
    active: true,
  },
  {
    id: "exchange_tracking",
    label: "Exchange tracking",
    body: "Exchange transactions move through Submitted, Under Review, Approved, then Paid.",
    active: true,
  },
  {
    id: "buying_gift_cards",
    label: "Buying gift cards",
    body: "Buying gift cards is not available yet; it is coming soon.",
    active: true,
  },
];

const factSchema = z.object({
  id: z.string(),
  label: z.string(),
  body: z.string(),
  active: z.boolean().optional(),
});

/**
 * Loads the admin-managed confirmed facts from app_settings using the
 * publishable key (anon read is allowed by policy). Falls back to the
 * built-in default facts if the read fails, so the assistant keeps working.
 */
async function loadFacts(): Promise<AssistantFact[]> {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return DEFAULT_FACTS;
    const supabasePublic = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data, error } = await supabasePublic
      .from("app_settings")
      .select("value")
      .eq("key", "assistant_facts")
      .maybeSingle();
    if (error || !data?.value) return DEFAULT_FACTS;
    const parsed = z.array(factSchema).safeParse(data.value);
    if (!parsed.success) return DEFAULT_FACTS;
    const active = parsed.data
      .filter((f) => f.active !== false && f.body.trim().length > 0)
      .map((f) => ({ id: f.id, label: f.label, body: f.body, active: true }));
    return active.length > 0 ? active : DEFAULT_FACTS;
  } catch {
    return DEFAULT_FACTS;
  }
}

function buildPrompt(facts: AssistantFact[]): string {
  const list = facts.map((f) => `- [${f.id}] ${f.body}`).join("\n");
  return `${BASE_INSTRUCTIONS}

Confirmed Zealex facts you may state:
${list}`;
}

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.string(),
        parts: z
          .array(
            z.object({
              type: z.string(),
              text: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .min(1),
});

const rateBuckets = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateBuckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateBuckets.set(ip, recent);
  // Lazy prune so the map cannot grow without bound.
  if (rateBuckets.size > 10_000) {
    for (const [key, times] of rateBuckets) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(key);
    }
  }
  return false;
}

const friendly = (message: string, status: number) => Response.json({ error: message }, { status });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        if (isRateLimited(ip)) {
          return friendly(
            "You're sending messages a bit too quickly. Please wait a minute and try again.",
            429,
          );
        }

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return friendly(
            "That message couldn't be sent. Please try rephrasing your question.",
            400,
          );
        }

        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        const question = (
          lastUser?.parts
            ?.filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join(" ") ?? ""
        )
          .trim()
          .slice(0, MAX_INPUT_CHARS);

        if (!question) {
          return friendly("Please type a question about Zealex and try again.", 400);
        }

        // Provider is created per request so no state is shared between calls.
        const gateway = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: process.env.LOVABLE_API_KEY,
        });

        try {
          const facts = await loadFacts();
          const result = streamText({
            model: gateway.responses("openai/gpt-6-astra"),
            system: buildPrompt(facts),
            messages: [{ role: "user", content: question }],
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            abortSignal: request.signal,
            providerOptions: {
              openai: {
                forceReasoning: true,
                reasoningEffort: "medium",
                reasoningSummary: "auto",
                include: ["reasoning.encrypted_content"],
                store: false,
              },
            },
          });
          return result.toUIMessageStreamResponse();
        } catch {
          return friendly(
            "Zealex Assistant is unavailable right now. Please try again shortly.",
            503,
          );
        }
      },
    },
  },
});
