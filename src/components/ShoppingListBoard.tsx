/** @deprecated Stage B — Shop rows live on `/home`. File kept; do not delete. */
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

function ShoppingItemRow({
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
    <article className={item.purchased ? "opacity-70" : ""}>
      <div className="flex items-start gap-1.5 px-3 py-2">
        <button
          type="button"
          aria-label={item.purchased ? "Mark not purchased" : "Mark purchased"}
          disabled={pending}
          onClick={() => startTransition(() => toggleShoppingPurchased(item.id))}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-line text-[11px] leading-none"
          style={{
            background: item.purchased ? "var(--accent)" : "transparent",
            color: item.purchased ? "white" : "transparent",
            borderColor: item.purchased ? "var(--accent)" : undefined,
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
              <span className="ml-1 text-sm font-medium text-muted">× {item.quantity}</span>
            ) : null}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            <span className="font-semibold text-[var(--accent)]">{ownerLabel}</span>
            {item.task ? <span>{item.task.title}</span> : null}
          </div>
          {item.note && !open ? (
            <p className="mt-0.5 line-clamp-1 text-sm leading-snug text-muted">{item.note}</p>
          ) : null}
        </button>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {item.task && !open ? (
            <Link
              href={`/work/${item.task.id}`}
              className="text-sm text-muted"
              aria-label="Open decision"
              onClick={(e) => e.stopPropagation()}
            >
              ›
            </Link>
          ) : (
            <span className="text-sm text-muted" aria-hidden>
              {open ? "−" : "+"}
            </span>
          )}
        </div>
      </div>

      {open ? (
        <form
          action={async (fd) => {
            await saveShoppingItem(fd);
            setOpen(false);
          }}
          className="flex flex-col gap-3 border-t border-line px-3 pb-3 pt-2"
        >
          <input type="hidden" name="id" value={item.id} />
          <ItemFields item={item} tasks={tasks} />
          <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-line px-3 py-2">
            <input
              type="checkbox"
              name="purchased"
              defaultChecked={item.purchased}
              className="h-5 w-5 accent-[var(--accent)]"
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

  const filters = [
    { id: "all", label: "All" },
    { id: "david", label: "David items" },
    { id: "haley", label: "Haley items" },
    { id: "both", label: "Both" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
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

      <section className="card p-3">
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
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-3 py-2 text-sm font-semibold text-[var(--accent)]"
        >
          <StarIcon size={16} />
          Add shopping item
        </button>
      ) : (
        <section className="card overflow-hidden border border-line">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
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
            className="flex flex-col gap-3 px-3 py-3"
          >
            <ItemFields tasks={tasks} autoFocus />
            <button type="submit" className="btn-primary">
              Add to list
            </button>
          </form>
        </section>
      )}

      {toBuy.length === 0 && !showPurchased ? (
        <div className="card px-3 py-4 text-center text-sm text-muted">
          Nothing to buy — add an item above.
        </div>
      ) : toBuy.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            To buy · {toBuy.length}
          </p>
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {toBuy.map((item) => (
              <ShoppingItemRow key={item.id} item={item} tasks={tasks} />
            ))}
          </div>
        </section>
      ) : null}

      {showPurchased && purchased.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Purchased · {purchased.length}
          </p>
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {purchased.map((item) => (
              <ShoppingItemRow key={item.id} item={item} tasks={tasks} />
            ))}
          </div>
        </section>
      ) : showPurchased && toBuy.length === 0 && purchased.length === 0 ? (
        <div className="card px-3 py-4 text-center text-sm text-muted">No shopping items yet.</div>
      ) : null}
    </div>
  );
}
