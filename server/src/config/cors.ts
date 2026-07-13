import type { CorsOptions } from "cors";

const configuredOrigins = (process.env.CLIENT_URL ?? "")
  .split(",")
  .map(value => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://brain-arena-xi.vercel.app",
  ...configuredOrigins
]);

const brainArenaPreview = /^https:\/\/brain-arena(?:-[a-z0-9-]+)?\.vercel\.app$/;

export function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  return allowedOrigins.has(normalized) || brainArenaPreview.test(normalized);
}

export const corsOrigin: NonNullable<CorsOptions["origin"]> = (origin, callback) => {
  if (isAllowedOrigin(origin)) callback(null, true);
  else callback(new Error(`허용되지 않은 Origin입니다: ${origin}`));
};

export const corsOptions: CorsOptions = { origin: corsOrigin, credentials: true };
