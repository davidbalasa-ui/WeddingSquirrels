"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createShoppingItem,
  deleteShoppingItem,
  saveShoppingItem,
  toggleShoppingPurchased,
} from "@/app/actions";
import { StarIcon } from "@/components/StarIcon";

export type ShoppingItemView = {
  id: string;
  name: string;
  quantity: string | null;
  note: string | null;
  purchased: boolean;
  ownerId: string | null;
  taskId: string | null;
  task: { id: string; title: string } | null;
  owner: { id: string; name: string } | null;
};

type TaskOption = { id: string; title: string };

const ownerChoices = [
  { id: "", label: "Both / unset" },
  { id: "david", label: "David" },
  { id: "haley", label: "Haley" },
];

function filterHref(pathname: string, who: string, showPurchased: boolean) {
  const params = new URLSearchParams();
  if (who !== "all") params.set("who", who);
  if (showPurchased) params.set("purchased", "1");
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

function ItemFields({
  item,
  tasks,
  autoFocus,
}: {
  item?: ShoppingItemView;
  tasks: TaskOption[];
  autoFocus?: boolean;
}) {
  const selectedOwner = item?.ownerId ?? "";
  return (
    <>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Item</span>
        <input
          name="name"
          required
          defaultValue={item?.name ?? ""}
          placeholder="What do we need to buy?"
          className="field-input"
          autoFocus={autoFocus}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Quantity</span>
          <input
            name="quantity"
            defaultValue={item?.quantity ?? ""}
            placeholder="e.g. 2 or 1 pack"
            className="field-input"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Who&apos;s buying</span>
          <select name="ownerId" defaultValue={selectedOwner} className="field-input">
            {ownerChoices.map((choice) => (
              <option key={choice.label} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Note (optional)</span>
        <textarea
          name="note"
          rows={2}
          defaultValue={item?.note ?? ""}
          placeholder="Store, brand, color…"
          className="field-input resize-y"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Related decision (optional)</span>
        <select name="taskId" defaultValue={item?.taskId ?? ""} className="field-input">
          <option value="">None</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
          {item?.task && !tasks.some((t) => t.id === item.task!.id) ? (
            <option value={item.task.id}>{item.task.title}</option>
          ) : null}
        </select>
      </label>
    </>
  );
}

function ShoppingItemCard({
  item,
  tasks,
}: {
  item: ShoppingItemView;
  tasks: TaskOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ownerLabel =
    item.owner?.name ||
    (item.ownerId === "david" ? "David" : item.ownerId === "haley" ? "Haley" : "Both");

  return (
    <article className={`card overflow-hidden ${item.purchased ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          aria-label={item.purchased ? "Mark not purchased" : "Mark purchased"}
          disabled={pending}
          onClick={() => startTransition(() => toggleShoppingPurchased(item.id))}
          className="step-check mt-0.5 shrink-0"
          style={{
            background: item.purchased ? "var(--accent)" : "transparent",
            color: item.purchased ? "white" : "var(--muted)",
          }}
        >
          {item.purchased ? "✓" : ""}
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <p className={`text-[15px] font-semibold leading-snug ${item.purchased ? "line-through" : ""}`}>
            {item.name}
            {item.quantity ? (
              <span className="ml-2 text-sm font-medium text-muted">× {item.quantity}</span>
            ) : null}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-semibold text-[var(--accent)]">
              {ownerLabel}
            </span>
            {item.task ? (
              <span className="font-semibold text-[var(--accent)]">{item.task.title}</span>
            ) : null}
          </div>
          {item.note ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{item.note}</p>
          ) : null}
        </button>

        <span className="mt-0.5 shrink-0 text-lg text-muted" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </div>

      {item.task && !open ? (
        <div className="border-t border-line px-4 py-2">
          <Link
            href={`/work/${item.task.id}`}
            className="text-sm font-semibold text-[var(--accent)]"
            onClick={(e) => e.stopPropagation()}
          >
            Open decision →
          </Link>
        </div>
      ) : null}

      {open ? (
        <form
          action={async (fd) => {
            await saveShoppingItem(fd);
            setOpen(false);
          }}
          className="flex flex-col gap-3 border-t border-line p-4"
        >
          <input type="hidden" name="id" value={item.id} />
          <ItemFields item={item} tasks={tasks} />
          <label className="flex min-h-[48px] items-center gap-3 rounded-xl border border-line px-3 py-3">
            <input
              type="checkbox"
              name="purchased"
              defaultChecked={item.purchased}
              className="h-6 w-6 accent-[var(--accent)]"
            />
            <span className="text-sm font-semibold">Purchased</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary">
              Save item
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => startTransition(() => deleteShoppingItem(item.id))}
            >
              Delete
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

export function ShoppingListBoard({
  items,
  tasks,
  who,
  showPurchased,
}: {
  items: ShoppingItemView[];
  tasks: TaskOption[];
  who: string;
  showPurchased: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const toBuy = items.filter((i) => !i.purchased);
  const purchased = items.filter((i) => i.purchased);
  const visible = showPurchased ? items : toBuy;

  const filters = [
    { id: "all", label: "All" },
    { id: "david", label: "David items" },
    { id: "haley", label: "Haley items" },
    { id: "both", label: "Both" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {toBuy.length} to buy · {purchased.length} purchased
        </p>
        <button
          type="button"
          className="filter-pill rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted"
          style={{
            background: showPurchased ? "var(--accent-soft)" : "var(--bg-elevated)",
            color: showPurchased ? "var(--accent)" : undefined,
          }}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            if (showPurchased) next.delete("purchased");
            else next.set("purchased", "1");
            const q = next.toString();
            router.push(q ? `${pathname}?${q}` : pathname);
          }}
        >
          {showPurchased ? "Hide purchased" : "Show purchased"}
        </button>
      </div>

      <section className="card mb-1 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Filter by owner
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => {
            const active = who === filter.id;
            return (
              <Link
                key={filter.id}
                href={filterHref(pathname, filter.id, showPurchased)}
                className="filter-pill shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--line)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--muted)",
                }}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          {who === "all"
            ? "Everything on the shopping list."
            : who === "both"
              ? "Items for both of you (no single owner)."
              : who === "david"
                ? "Items assigned to David only."
                : "Items assigned to Haley only."}
        </p>
      </section>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-[18px] border border-dashed border-line bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-4 py-4 text-sm font-semibold text-[var(--accent)]"
        >
          <StarIcon size={16} />
          Add shopping item
        </button>
      ) : (
        <article className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              New item
            </p>
            <button
              type="button"
              aria-label="Close"
              className="star-btn star-btn-active"
              onClick={() => setAdding(false)}
            >
              <StarIcon filled size={18} />
            </button>
          </div>
          <form
            action={async (fd) => {
              await createShoppingItem(fd);
              setAdding(false);
            }}
            className="flex flex-col gap-3"
          >
            <ItemFields tasks={tasks} autoFocus />
            <button type="submit" className="btn-primary">
              Add to list
            </button>
          </form>
        </article>
      )}

      <div className="flex flex-col gap-3">
        {visible.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">
            {showPurchased ? "No shopping items yet." : "Nothing to buy — add an item above."}
          </div>
        ) : (
          <>
            {toBuy.map((item) => (
              <ShoppingItemCard key={item.id} item={item} tasks={tasks} />
            ))}
            {showPurchased && purchased.length > 0 ? (
              <section className="mt-2 flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Purchased
                </p>
                {purchased.map((item) => (
                  <ShoppingItemCard key={item.id} item={item} tasks={tasks} />
                ))}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
