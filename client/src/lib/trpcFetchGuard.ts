type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function procedureNames(input: RequestInfo | URL): string[] {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(raw, "http://local").pathname.replace(/^\/api\/trpc\/?/, "");
    return decodeURIComponent(path).split(",").filter(Boolean);
  } catch { return []; }
}

/** Se a plataforma devolver HTML (404/502 de proxy) ou JSON inválido, transforma em erro tRPC legível em vez de "Unexpected token <". */
export function createTrpcFetchGuard(base: Fetch = (i, o) => fetch(i, o)): Fetch {
  return async (input, init) => {
    const res = await base(input, init);
    const isJson = (res.headers.get("content-type") ?? "").includes("json");
    if (isJson) { try { JSON.parse(await res.clone().text()); return res; } catch { /* cai no erro abaixo */ } }
    const names = procedureNames(input);
    const body = (names.length ? names : ["trpc"]).map(n => ({
      error: { json: { message: `O servidor devolveu resposta não JSON para ${n} (HTTP ${res.status}). Tente novamente em instantes.`, code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 502 } } },
    }));
    return new Response(JSON.stringify(body), { status: 502, headers: { "content-type": "application/json" } });
  };
}
