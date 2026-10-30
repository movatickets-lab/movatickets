import { brPhoneE164 } from "./util";

const BASE = "https://api.checkout.infinitepay.io";

async function post<T>(path: string, body: unknown): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) throw new Error(`InfinitePay HTTP ${res.status} em ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export type CheckoutItem = { quantity: number; price: number; description: string };

/** Gera o link de pagamento NA CONTA da produtora (handle = InfiniteTag dela). price em centavos. */
export async function createCheckoutLink(o: {
  handle: string; orderNsu: string; items: CheckoutItem[]; redirectUrl: string; webhookUrl: string;
  customer?: { name: string; email: string; phone: string };
}): Promise<string> {
  const phone = o.customer ? brPhoneE164(o.customer.phone) : undefined;
  const out = await post<{ url?: string }>("/links", {
    handle: o.handle, order_nsu: o.orderNsu, items: o.items, redirect_url: o.redirectUrl, webhook_url: o.webhookUrl,
    ...(o.customer ? { customer: { name: o.customer.name, email: o.customer.email, ...(phone ? { phone_number: phone } : {}) } } : {}),
  });
  if (!out.url || !/^https:\/\//.test(out.url)) throw new Error("InfinitePay não retornou o link de checkout.");
  return out.url;
}

export type PaymentCheck = { success: boolean; paid: boolean; amount: number; paid_amount: number; installments: number; capture_method: string };

/** Consulta oficial do pagamento. Webhook e parâmetros de redirect NÃO são prova de pagamento. */
export const paymentCheck = (o: { handle: string; orderNsu: string; transactionNsu: string; slug: string }) =>
  post<PaymentCheck>("/payment_check", { handle: o.handle, order_nsu: o.orderNsu, transaction_nsu: o.transactionNsu, slug: o.slug });
