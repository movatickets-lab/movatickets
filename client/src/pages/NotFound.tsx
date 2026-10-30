import { Link } from "wouter";
export default function NotFound() {
  return <main className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="text-3xl font-bold text-cocoa">Página não encontrada</h1><p className="mt-2">O endereço não existe ou foi movido.</p><Link href="/" className="mt-6 inline-block font-semibold text-brand underline">Voltar aos eventos</Link></main>;
}
