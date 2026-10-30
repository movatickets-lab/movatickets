/**
 * Dados da empresa usados nos textos legais. PREENCHA os campos entre colchetes antes de publicar
 * (o servidor avisa no log se ainda houver pendências em produção).
 * Mude `TERMS_VERSION` sempre que alterar os textos: o aceite de cada pessoa guarda essa versão.
 */
export const TERMS_VERSION = "2026-10-30";
export const LEGAL = {
  companyName: "MOVA Produções (MOVA TICKETS)",
  companyDocument: "67.693.144/0001-41",
  companyAddress: "Teresina - PI, Brasil",
  contactEmail: "suporte.movatickets@gmail.com",
  dpoName: "Samantha Ariadne Savatore Alves da Costa",
  dpoEmail: "suporte.movatickets@gmail.com",
  forum: "Comarca de Teresina - PI",
  updatedAt: "30 de outubro de 2026",
} as const;

export const pendingLegalFields = () => Object.entries(LEGAL).filter(([, v]) => typeof v === "string" && v.startsWith("[")).map(([k]) => k);
