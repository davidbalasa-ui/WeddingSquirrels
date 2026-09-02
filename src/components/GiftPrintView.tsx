"use client";

import Link from "next/link";
import type { GiftPrintRow } from "@/lib/guest-gifts";

export function GiftPrintView({ rows }: { rows: GiftPrintRow[] }) {
  const withGifts = rows.filter((row) => row.gifts.length > 0).length;

  return (
    <div className="gift-print flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight">
            Thank-you gift list
          </h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} households · {withGifts} with gifts
          </p>
        </div>
        <div className="print-hide flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            Print
          </button>
          <Link href="/people?tab=guests" className="btn-secondary">
            Back
          </Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No guests yet.</p>
      ) : (
        <section className="print-section">
          <div className="overflow-x-auto">
            <table className="gift-print-table money-print-table w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-muted">
                  <th className="py-2 pr-3 font-semibold">Names &amp; address</th>
                  <th className="py-2 font-semibold">Gifts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line align-top">
                    <td className="py-2.5 pr-3">
                      {row.nameLines.map((line, index) => (
                        <p key={`${row.id}-name-${index}`} className="font-medium leading-5">
                          {line}
                        </p>
                      ))}
                      {row.addressLines.map((line, index) => (
                        <p key={`${row.id}-addr-${index}`} className="text-muted leading-5">
                          {line}
                        </p>
                      ))}
                      {row.addressLines.length === 0 ? (
                        <p className="text-muted leading-5">No address</p>
                      ) : null}
                    </td>
                    <td className="py-2.5">
                      {row.gifts.length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <ul className="m-0 list-none p-0">
                          {row.gifts.map((gift, index) => (
                            <li key={`${row.id}-gift-${index}`} className="leading-5">
                              {gift}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
