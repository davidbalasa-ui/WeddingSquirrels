"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { unlockAction, type UnlockState } from "@/app/actions";

const initial: UnlockState = {};

export function PinPad() {
  const [pin, setPin] = useState("");
  const [state, formAction, pending] = useActionState(unlockAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) setPin("");
  }, [state.error]);

  function submit(value: string) {
    const fd = new FormData();
    fd.set("pin", value);
    startTransition(() => {
      formAction(fd);
    });
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="flex flex-col items-center gap-6 pt-10">
      <div className="text-center">
        <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-ink">
          WeddingSquirrels
        </p>
        <p className="mt-2 text-sm text-muted">Enter your PIN</p>
      </div>

      <div className="flex gap-2" aria-label="PIN length">
        {Array.from({ length: Math.max(4, pin.length || 4) }).map((_, i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full border border-line"
            style={{ background: i < pin.length ? "var(--accent)" : "transparent" }}
          />
        ))}
      </div>

      {state.error ? <p className="text-sm text-[var(--danger)]">{state.error}</p> : null}

      <form ref={formRef} action={formAction} className="hidden">
        <input name="pin" value={pin} readOnly />
      </form>

      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
        {keys.map((key, idx) => {
          if (key === "") return <div key={idx} />;
          if (key === "⌫") {
            return (
              <button
                key={key}
                type="button"
                className="pin-key"
                onClick={() => setPin((p) => p.slice(0, -1))}
                aria-label="Backspace"
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              className="pin-key"
              disabled={pending}
              onClick={() => {
                const next = pin + key;
                setPin(next);
                if (next.length === 4) submit(next);
              }}
            >
              {key}
            </button>
          );
        })}
      </div>

      {pin.length > 4 ? (
        <button
          type="button"
          onClick={() => submit(pin)}
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Unlocking…" : "Unlock"}
        </button>
      ) : (
        <p className="text-xs text-muted">{pending ? "Unlocking…" : " "}</p>
      )}
    </div>
  );
}
