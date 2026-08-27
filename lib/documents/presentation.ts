import type { DocumentSummary } from "@/lib/documents/types";

export function getDocumentStatusPresentation(document: DocumentSummary) {
  if (document.status === "failed") {
    return { label: "Failed", color: "#fca5a5", borderColor: "rgba(248,113,113,0.32)" };
  }
  if (document.status === "processing" || document.status === "uploaded") {
    return { label: "Processing", color: "#93c5fd", borderColor: "rgba(96,165,250,0.32)" };
  }
  if (document.financial_review_status === "pending") {
    return { label: "Review required", color: "#fde68a", borderColor: "rgba(250,204,21,0.32)" };
  }
  if (document.financial_review_status === "confirmed") {
    return { label: "User-confirmed", color: "#86efac", borderColor: "rgba(74,222,128,0.32)" };
  }
  if (document.financial_review_status === "legacy") {
    return { label: "Legacy · review recommended", color: "#fcd34d", borderColor: "rgba(251,191,36,0.32)" };
  }

  const scanned = Boolean(
    document.metadata &&
      typeof document.metadata === "object" &&
      Reflect.get(document.metadata, "scanned") === true,
  );
  if (document.file_type === "pdf" && !scanned) {
    return { label: "Ready for evidence", color: "#86efac", borderColor: "rgba(74,222,128,0.32)" };
  }
  return { label: "No metrics found", color: "#c4cbd4", borderColor: "rgba(196,203,212,0.28)" };
}
