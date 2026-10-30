import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { env } from "./env";

let client: S3Client | null = null;
const s3 = () => (client ??= new S3Client({ region: "auto", endpoint: env.s3Endpoint(), forcePathStyle: true, credentials: { accessKeyId: env.s3KeyId(), secretAccessKey: env.s3Secret() } }));

const SIGNATURES: Array<{ ext: string; type: string; test: (b: Buffer) => boolean }> = [
  { ext: "png", type: "image/png", test: b => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  { ext: "jpg", type: "image/jpeg", test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "webp", type: "image/webp", test: b => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
];

/** Descobre o tipo REAL pela assinatura dos bytes (ignora o Content-Type enviado pelo cliente). */
export const detectImage = (b: Buffer) => SIGNATURES.find(s => s.test(b)) ?? null;

export async function putPublicImage(prefix: string, body: Buffer, ext: string, contentType: string): Promise<string> {
  const key = `${prefix}/${randomUUID()}.${ext}`;
  await s3().send(new PutObjectCommand({ Bucket: env.s3Bucket(), Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
  return `${env.s3PublicBase()}/${key}`;
}
