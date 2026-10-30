// Leitura lazy das variáveis de ambiente (permite configurar nos testes).
const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Variável de ambiente ausente: ${k}`);
  return v;
};
const opt = (k: string): string => process.env[k] ?? "";

export const env = {
  isProd: () => process.env.NODE_ENV === "production",
  databaseUrl: () => opt("DATABASE_URL"),
  origin: () => need("APP_PUBLIC_ORIGIN").replace(/\/+$/, ""),
  sessionSecret: () => {
    const s = need("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET deve ter 32+ caracteres.");
    return s;
  },
  encryptionKey: () => need("ENCRYPTION_KEY"),
  superAdminEmails: () => opt("SUPER_ADMIN_EMAILS").split(",").map(e => e.trim().toLowerCase()).filter(Boolean),
  googleClientId: () => opt("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => opt("GOOGLE_CLIENT_SECRET"),
  s3Endpoint: () => opt("S3_ENDPOINT"),
  s3Bucket: () => opt("S3_BUCKET"),
  s3KeyId: () => opt("S3_ACCESS_KEY_ID"),
  s3Secret: () => opt("S3_SECRET_ACCESS_KEY"),
  s3PublicBase: () => opt("S3_PUBLIC_BASE_URL").replace(/\/+$/, ""),
  brevoKey: () => opt("BREVO_API_KEY"),
  mailFromEmail: () => opt("MAIL_FROM_EMAIL"),
  mailFromName: () => opt("MAIL_FROM_NAME") || "MOVA TICKETS",
};
