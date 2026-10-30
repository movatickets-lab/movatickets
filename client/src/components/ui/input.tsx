import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
const base = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base text-[#1C1613] placeholder:text-[#7A6A60] aria-[invalid=true]:border-danger";
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={cn(base, className)} {...p} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cn(base, "min-h-28", className)} {...p} />;
