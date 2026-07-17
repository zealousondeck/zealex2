import { createFileRoute } from "@tanstack/react-router";
import { TradeConsole } from "./admin.exchange";

export const Route = createFileRoute("/_authenticated/admin/giftcards")({
  component: () => <TradeConsole category="giftcard" title="Gift Card Trades" />,
});
