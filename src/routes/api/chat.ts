import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";

/**
 * Zealex Assistant — streaming chat endpoint.
 *
 * Sends only the current question text plus a fixed confirmed-facts prompt to
 * the model. Never sends user profile/account data, never persists anything.
 * Input is capped at 500 characters and answers are token-capped. A
 * best-effort in-memory rate limit allows ~10 requests/minute per IP.
 */

const MAX_INPUT_CHARS = 500;
const MAX_OUTPUT_TOKENS = 700;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const SYSTEM_PROMPT = `You are the Zealex Assistant. Only answer questions about Zealex's services and general help using the platform. Be concise, friendly and clear. Never give financial, legal or investment advice. Never claim to see a user's balance, orders or personal data, and never ask for passwords, card codes, seed phrases or private keys. For account-specific issues, tell the user to contact support. If you don't know something about Zealex, say so instead of guessing. Buying gift cards is not available yet; it is coming soon.

Confirmed Zealex facts you may state:
- Payout timing: payouts are typically completed within about 5 minutes.
- Supported countries: Nigeria, Ghana, and South Africa. Other African countries may be supported later, but that is not confirmed yet.
- Support email: Zealousreturn@gmail.com — direct users here for anything account-specific.
- Fees: fee details are not confirmed yet. If asked, say you don't have fee details right now and suggest checking the app or contacting support.
- Services: selling gift cards for Naira; selling crypto (BTC, ETH, USDT, BNB, LTC, DOGE, SOL) with network selection, wallet address, QR code and confirmation tracking; KYC verification; Paystack instant deposits; withdrawals to saved bank accounts or crypto wallets; a referral program; live exchange rates.
- Exchange tracking: transactions move through Submitted, Under Review, Approved, then Paid.

Never invent rates, fees, limits, or any other Zealex detail not listed above. Keep answers short (2-5 sentences unless the user asks for steps).`;

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
            })
          )
          .optional(),
      })
    )
    .min(1),
});

const rateBuckets = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
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

const friendly = (message: string, status: number) =>
  Response.json({ error: message }, { status });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";
        if (isRateLimited(ip)) {
          return friendly(
            "You're sending messages a bit too quickly. Please wait a minute and try again.",
            429
          );
        }

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return friendly(
            "That message couldn't be sent. Please try rephrasing your question.",
            400
          );
        }

        const lastUser = [...body.messages]
          .reverse()
          .find((m) => m.role === "user");
        const question = (
          lastUser?.parts
            ?.filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join(" ") ?? ""
        )
          .trim()
          .slice(0, MAX_INPUT_CHARS);

        if (!question) {
          return friendly(
            "Please type a question about Zealex and try again.",
            400
          );
        }

        // Provider is created per request so no state is shared between calls.
        const gateway = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: process.env.LOVABLE_API_KEY,
        });

        try {
          const result = streamText({
            model: gateway.responses("openai/gpt-6-astra"),
            system: SYSTEM_PROMPT,
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
            503
          );
        }
      },
    },
  },
});
