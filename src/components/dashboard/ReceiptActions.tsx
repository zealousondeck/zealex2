import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadReceiptCsv, downloadReceiptPdf, type ReceiptInput } from "@/lib/receipts";

export function ReceiptActions({
  receipt,
  size = "sm",
}: {
  receipt: ReceiptInput;
  size?: "sm" | "xs";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={size === "xs" ? "h-7 px-2 text-xs" : ""}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Receipt
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => downloadReceiptPdf(receipt)}>
          <FileText className="mr-2 h-4 w-4" /> Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadReceiptCsv(receipt)}>
          <Download className="mr-2 h-4 w-4" /> Download CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
