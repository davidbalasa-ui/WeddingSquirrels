import { PrintCenter } from "@/components/PrintCenter";
import { loadPrintCenterDocument } from "@/lib/print-center-data";
import { requirePageSession } from "@/lib/session";

export default async function PrintCenterPage() {
  const session = await requirePageSession();
  const document = await loadPrintCenterDocument(session);
  return <PrintCenter document={document} />;
}
