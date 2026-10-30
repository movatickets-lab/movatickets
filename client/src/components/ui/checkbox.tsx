import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
/** API compatível com shadcn: onCheckedChange(boolean). */
export function Checkbox({ className, checked, onCheckedChange, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "checked"> & { checked?: boolean; onCheckedChange?: (v: boolean) => void }) {
  return <input type="checkbox" checked={!!checked} onChange={e => onCheckedChange?.(e.target.checked)} className={cn("mt-0.5 size-5 shrink-0 accent-[#BF4A15]", className)} {...p} />;
}
