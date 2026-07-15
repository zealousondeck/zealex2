import { jsPDF } from "jspdf";

export type ReceiptRow = { label: string; value: string };

export type ReceiptInput = {
  title: string;
  reference: string;
  status: string;
  stage?: string;
  createdAt: string | Date;
  rows: ReceiptRow[];
  note?: string | null;
};

const BRAND = "Zealex Exchange";

function fmtDate(v: string | Date) {
  return new Date(v).toLocaleString();
}

export function downloadReceiptPdf(input: ReceiptInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(15, 15, 17);
  doc.rect(0, 0, w, 90, "F");
  doc.setTextColor(217, 164, 65);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(BRAND, 40, 45);
  doc.setTextColor(240, 240, 240);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Official transaction receipt", 40, 66);

  // Title
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(input.title, 40, 130);

  // Meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(`Reference: ${input.reference}`, 40, 150);
  doc.text(`Date: ${fmtDate(input.createdAt)}`, 40, 166);
  doc.text(`Status: ${input.status.toUpperCase()}`, 40, 182);
  if (input.stage) doc.text(`Stage: ${input.stage.replace(/_/g, " ").toUpperCase()}`, 40, 198);

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(40, 220, w - 40, 220);

  // Rows
  let y = 250;
  doc.setFontSize(12);
  input.rows.forEach((r) => {
    doc.setTextColor(120, 120, 120);
    doc.text(r.label, 40, y);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text(r.value, w - 40, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 22;
  });

  if (input.note) {
    y += 10;
    doc.setTextColor(120, 120, 120);
    doc.text("Note", 40, y);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(input.note, w - 80);
    doc.text(lines, 40, y + 16);
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `${BRAND} · This receipt was generated on ${new Date().toLocaleString()}`,
    40,
    doc.internal.pageSize.getHeight() - 30,
  );

  doc.save(`zealex-${input.reference}.pdf`);
}

export function downloadReceiptCsv(input: ReceiptInput) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["field", "value"];
  const rows: [string, string][] = [
    ["brand", BRAND],
    ["title", input.title],
    ["reference", input.reference],
    ["status", input.status],
    ["stage", input.stage ?? ""],
    ["created_at", new Date(input.createdAt).toISOString()],
    ...input.rows.map((r) => [r.label, r.value] as [string, string]),
    ["note", input.note ?? ""],
  ];
  const csv =
    header.map(esc).join(",") +
    "\n" +
    rows.map(([k, v]) => `${esc(k)},${esc(v)}`).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zealex-${input.reference}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
