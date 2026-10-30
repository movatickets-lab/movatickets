import { useEffect, useRef } from "react";
import { useParams, useSearch } from "wouter";
import { VoucherCard } from "@/components/VoucherCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function SuccessPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const p = new URLSearchParams(useSearch());
  const vt = p.get("vt") ?? "";
  const nsu = p.get("transaction_nsu"), slug = p.get("slug");
  const q = trpc.ticketing.orders.voucher.useQuery({ orderId, vt }, { enabled: vt.length >= 20, retry: false, refetchInterval: query => (query.state.data?.status === "PENDING" ? 4000 : false) });
  const confirm = trpc.ticketing.orders.confirm.useMutation({ onSuccess: () => { void q.refetch(); } });
  const asked = useRef(false);
  // Os parâmetros do retorno são só referência: o servidor confirma o pagamento direto na InfinitePay.
  useEffect(() => {
    if (q.data && q.data.status !== "APPROVED" && nsu && slug && !asked.current) { asked.current = true; confirm.mutate({ orderId, vt, transactionNsu: nsu, slug }); }
  }, [q.data, nsu, slug, orderId, vt, confirm]);

  if (vt.length < 20 || q.error) return <main className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-2xl font-bold">Voucher não encontrado</h1><p className="mt-2">Use o link completo recebido após a compra.</p></main>;
  if (!q.data) return <p className="p-10 text-center">Carregando seu pedido…</p>;
  const d = q.data;
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      {d.status === "APPROVED" && <><h1 className="text-3xl font-extrabold text-cocoa">Pagamento confirmado</h1><p>Guarde seus ingressos. Salve o endereço desta página: ele é o seu acesso ao voucher.</p>
        {d.tickets.map(t => <VoucherCard key={t.code} t={t} ev={d} />)}</>}
      {d.status === "PENDING" && (
        <section aria-live="polite" className="space-y-3 rounded-2xl border border-line bg-mist p-6">
          <h1 className="text-2xl font-bold text-cocoa">Aguardando a confirmação do pagamento</h1>
          <p>Assim que a InfinitePay confirmar, o voucher aparece aqui automaticamente. Não feche esta página.</p>
          {d.checkoutUrl && <a href={d.checkoutUrl}><Button>Voltar ao pagamento</Button></a>}
          <p className="text-xs text-[#6B5A50]">A reserva dura 15 minutos a partir da compra.</p>
        </section>
      )}
      {d.status === "CANCELLED" && <section role="alert" className="rounded-2xl border border-danger p-6"><h1 className="text-2xl font-bold text-danger">Pedido não concluído</h1><p>A reserva expirou ou o pagamento não foi confirmado. Se você pagou, fale com a produtora informando o seu e-mail.</p></section>}
    </main>
  );
}
