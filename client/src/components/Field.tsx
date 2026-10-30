import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import type { InputHTMLAttributes } from "react";

/** Campo com rótulo visível e mensagem de erro ligada ao input (acessível). */
export function Field({ label, error, hint, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string | null; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-cocoa">{label}</label>
      <Input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} {...p} />
      {hint && !error && <p id={`${id}-h`} className="text-xs text-[#6B5A50]">{hint}</p>}
      {error && <p id={`${id}-e`} role="alert" className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
