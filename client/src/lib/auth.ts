/** Aceita somente caminhos internos (evita redirecionamento para outro site). */
export const safeReturn = (p: string | null | undefined) => (p && /^\/(?![/\\])/.test(p) ? p : "/painel");
