/**
 * Sesión de administrador firmada con HMAC-SHA256 (Web Crypto).
 * Funciona tanto en el middleware (Edge) como en las rutas API (Node).
 */

export const SESSION_COOKIE_NAME = '__session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 5; // 5 días en segundos

const DEV_FALLBACK_PASSWORD = 'admin1234';

export interface AdminSessionPayload {
  email: string;
  exp: number; // timestamp en segundos
}

const encoder = new TextEncoder();

/** Contraseña de administrador configurada (usa ADMIN_PASSWORD o fallback admin1234 si no se definió). */
export function getAdminPassword(): string {
  const configured = (process.env.ADMIN_PASSWORD || '').trim();
  return configured || DEV_FALLBACK_PASSWORD;
}

/** Correo de administrador opcional. Si no está configurado, se acepta cualquier correo válido. */
export function getAdminEmail(): string | null {
  const configured = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return configured || null;
}

function getSessionSecret(): string {
  const explicit = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (explicit) return explicit;
  const password = getAdminPassword();
  if (password) return `caseritos-admin-session::${password}`;
  const projectSide =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'caseritos-default-secret';
  return `caseritos-admin-session::${projectSide}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return new Uint8Array(signature);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Compara dos textos en tiempo constante (evita ataques de tiempo). */
export async function safeCompare(a: string, b: string): Promise<boolean> {
  const salt = 'caseritos-compare';
  const [ha, hb] = await Promise.all([hmac(salt, a), hmac(salt, b)]);
  return constantTimeEqual(ha, hb);
}

export async function createSessionToken(email: string): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) throw new Error('ADMIN_PASSWORD no está configurada en el servidor.');

  const payload: AdminSessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = toBase64Url(await hmac(secret, encodedPayload));
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<AdminSessionPayload | null> {
  try {
    if (!token) return null;
    const secret = getSessionSecret();
    if (!secret) return null;

    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const expected = await hmac(secret, encodedPayload);
    if (!constantTimeEqual(expected, fromBase64Url(signature))) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload))
    ) as AdminSessionPayload;
    if (!payload?.email || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
