import { notFound } from "next/navigation";
import { MoneyChapterHeader } from "@/components/MoneyChapterHeader";
import { MoneyContractEditor } from "@/components/MoneyContractEditor";
import { MoneyPaymentSchedule } from "@/components/MoneyPaymentSchedule";
import { moneyEditable } from "@/lib/access";
import { loadPersonNames, loadVisibleBudgetContract } from "@/lib/money-page";
import { requirePageSession } from "@/lib/session";

export default async function MoneyContractPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const { itemId } = await params;
  const [contract, personNames] = await Promise.all([
    loadVisibleBudgetContract(session, itemId),
    loadPersonNames(),
  ]);
  if (!contract) notFound();

  return (
    <>
      <MoneyChapterHeader title={contract.name} subtitle="Contract, payments, and history." />
      <MoneyContractEditor
        contract={contract}
        canEdit={moneyEditable(session)}
        personNames={personNames}
      />
      <MoneyPaymentSchedule contract={contract} canEdit={moneyEditable(session)} />
    </>
  );
}
