import { notFound } from "next/navigation";
import { MoneyChapterHeader } from "@/components/MoneyChapterHeader";
import { MoneyContractEditor } from "@/components/MoneyContractEditor";
import { MoneyPaymentSchedule } from "@/components/MoneyPaymentSchedule";
import { RelatedLinkList } from "@/components/RelatedLinkList";
import { moneyEditable } from "@/lib/access";
import { personProfileHref, taskHref } from "@/lib/entity-links";
import { personMoneyLabel } from "@/lib/money";
import { loadPersonNames, loadRelatedTasksForContract, loadVisibleBudgetContract } from "@/lib/money-page";
import { requirePageSession } from "@/lib/session";

export default async function MoneyContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
}) {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const { itemId } = await params;
  const query = await searchParams;
  const paymentParam = Array.isArray(query.payment) ? query.payment[0] : query.payment;
  const [contract, personNames, relatedTasks] = await Promise.all([
    loadVisibleBudgetContract(session, itemId),
    loadPersonNames(),
    loadRelatedTasksForContract(session, itemId),
  ]);
  if (!contract) notFound();

  const peopleLinks: { href: string; title: string; detail: string }[] = [];
  if (contract.ownerId && contract.paidById === contract.ownerId) {
    peopleLinks.push({
      href: personProfileHref(contract.ownerId),
      title: personMoneyLabel(contract.ownerId, personNames),
      detail: "Owner · Paid by",
    });
  } else {
    if (contract.ownerId) {
      peopleLinks.push({
        href: personProfileHref(contract.ownerId),
        title: personMoneyLabel(contract.ownerId, personNames),
        detail: "Owner",
      });
    }
    if (contract.paidById) {
      peopleLinks.push({
        href: personProfileHref(contract.paidById),
        title: personMoneyLabel(contract.paidById, personNames),
        detail: "Paid by",
      });
    }
  }

  return (
    <>
      <MoneyChapterHeader title={contract.name} subtitle="Contract, payments, and history." />
      <MoneyContractEditor
        contract={contract}
        canEdit={moneyEditable(session)}
        personNames={personNames}
      />
      <RelatedLinkList title="People" items={peopleLinks} />
      <RelatedLinkList
        title="Related work"
        items={relatedTasks.map((task) => ({
          href: taskHref(task.id),
          title: task.title,
        }))}
      />
      <MoneyPaymentSchedule
        contract={contract}
        canEdit={moneyEditable(session)}
        highlightPaymentId={paymentParam}
      />
    </>
  );
}
