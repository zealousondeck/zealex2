import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useState } from "react";
import { X, Minus, MessageCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ZealexCoin } from "@/components/site/Logo";
import { cn } from "@/lib/utils";

const MAX_INPUT_CHARS = 500;

const STARTERS = [
  "How do I sell a gift card?",
  "Which crypto do you support?",
  "How does KYC work?",
];

const messageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

export function ZealexAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const lastIsEmpty = lastMessage?.role === "assistant" && messageText(lastMessage).length === 0;

  const handleSubmit = (message: { text?: string }) => {
    const text = (message.text ?? "").trim().slice(0, MAX_INPUT_CHARS);
    if (!text || busy) return;
    sendMessage({ text });
  };

  return (
    <div className="pointer-events-none fixed right-4 bottom-24 z-[80] md:right-5 md:bottom-5">
      {/* Launcher */}
      <button
        type="button"
        aria-label={open ? "Close Zealex Assistant" : "Ask Zealex AI"}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setMinimized(false);
        }}
        className={cn(
          "pointer-events-auto group relative flex size-14 cursor-pointer items-center justify-center rounded-full",
          "bg-gradient-gold text-gold-foreground shadow-gold transition-transform duration-200",
          "hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          open && "opacity-0 pointer-events-none",
        )}
      >
        <MessageCircle className="size-6" />
        <span className="pointer-events-none absolute right-full mr-3 hidden items-center rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background opacity-0 shadow transition-opacity group-hover:opacity-100 md:flex">
          Ask Zealex AI
        </span>
      </button>

      {/* Chat panel */}
      {open && !minimized && (
        <div
          role="dialog"
          aria-label="Zealex Assistant"
          className={cn(
            "pointer-events-auto fixed inset-0 flex flex-col overflow-hidden border border-border bg-background shadow-gold",
            "md:inset-auto md:bottom-5 md:right-5 md:h-[520px] md:w-[380px] md:rounded-2xl",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 bg-gradient-gold px-4 py-3 text-gold-foreground">
            <ZealexCoin className="size-7 shrink-0" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-semibold">Zealex Assistant</p>
              <p className="truncate text-xs opacity-80">Answers about Zealex services</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Minimize chat"
              className="text-gold-foreground hover:bg-black/10 hover:text-gold-foreground"
              onClick={() => setMinimized(true)}
            >
              <Minus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close chat"
              className="text-gold-foreground hover:bg-black/10 hover:text-gold-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Transcript */}
          <Conversation className="min-h-0 flex-1 bg-background">
            <ConversationContent className="gap-4 p-4">
              {messages.length === 0 && !error ? (
                <ConversationEmptyState
                  className="justify-start"
                  title="Hi, I'm the Zealex Assistant"
                  description="Ask me about selling gift cards or crypto, KYC, deposits, withdrawals, referrals, rates, or troubleshooting."
                  icon={<ZealexCoin className="size-10" />}
                >
                  <div className="mt-2 flex flex-col gap-2">
                    {STARTERS.map((starter) => (
                      <Button
                        key={starter}
                        variant="goldOutline"
                        size="sm"
                        className="justify-start rounded-full"
                        onClick={() => sendMessage({ text: starter })}
                      >
                        {starter}
                      </Button>
                    ))}
                  </div>
                </ConversationEmptyState>
              ) : (
                <>
                  {messages.map((message) => {
                    const text = messageText(message);
                    if (!text) return null;
                    return (
                      <Message key={message.id} from={message.role}>
                        <MessageContent
                          className={cn(
                            "rounded-2xl",
                            message.role === "user" &&
                              "group-[.is-user]:bg-gold group-[.is-user]:text-gold-foreground",
                          )}
                        >
                          <MessageResponse>{text}</MessageResponse>
                        </MessageContent>
                      </Message>
                    );
                  })}
                  {error ? (
                    <div className="flex w-full max-w-[95%] flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      <p>Something went wrong on our end. Please try again in a moment.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        onClick={() => regenerate()}
                      >
                        <RotateCcw className="size-4" />
                        Try again
                      </Button>
                    </div>
                  ) : status === "submitted" || lastIsEmpty ? (
                    <Message from="assistant">
                      <MessageContent>
                        <Shimmer className="text-sm" duration={1.4}>
                          Thinking…
                        </Shimmer>
                      </MessageContent>
                    </Message>
                  ) : null}
                </>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Composer */}
          <div className="border-t border-border bg-background p-3">
            <PromptInput
              onSubmit={handleSubmit}
              className="rounded-xl border-input bg-background shadow-sm"
            >
              <PromptInputTextarea
                placeholder="Ask about Zealex…"
                maxLength={MAX_INPUT_CHARS}
                rows={1}
                className="max-h-28 min-h-10"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} onStop={stop} variant="gold" disabled={false} />
              </PromptInputFooter>
            </PromptInput>
            <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
              For account-specific issues, contact support.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
