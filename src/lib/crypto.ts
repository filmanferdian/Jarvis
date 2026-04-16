import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// AES-256-GCM application-layer encryption for sensitive DB columns.
// Ciphertext format: "enc:v1:<iv>:<tag>:<ciphertext>" (all base64url).
// Plaintext passthrough: if input does not start with "enc:v1:", it's returned as-is
// so legacy rows keep working and are transparently re-encrypted on next write.

const ENC_PREFIX = 'enc:v1:';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.CRYPTO_KEY;
  if (!raw) {
    throw new Error(
      'CRYPTO_KEY not configured. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  // Accept 32-byte base64, 64-char hex, or passphrase (SHA-256 derives 32 bytes)
  let key: Buffer;
  const b64 = Buffer.from(raw, 'base64');
  const hex = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : null;
  if (hex && hex.length === 32) {
    key = hex;
  } else if (b64.length === 32) {
    key = b64;
  } else {
    // Fallback: derive via SHA-256 (so any passphrase works, but shorter passphrases are less safe)
    key = createHash('sha256').update(raw, 'utf8').digest();
  }
  cachedKey = key;
  return key;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext; // already encrypted, idempotent
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${b64urlEncode(iv)}:${b64urlEncode(tag)}:${b64urlEncode(ct)}`;
}

export function decrypt(value: string | null | undefined): string {
  if (!value) return '';
  if (!value.startsWith(ENC_PREFIX)) return value; // legacy plaintext passthrough
  const rest = value.slice(ENC_PREFIX.length);
  const [ivB64, tagB64, ctB64] = rest.split(':');
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Corrupt ciphertext');
  }
  const iv = b64urlDecode(ivB64);
  const tag = b64urlDecode(tagB64);
  const ct = b64urlDecode(ctB64);
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error('Bad IV/tag length');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// Convenience for JSON payloads (e.g. raw_json columns)
export function encryptJson(obj: unknown): string {
  return encrypt(JSON.stringify(obj));
}

export function decryptJson<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    const plain = decrypt(value);
    return JSON.parse(plain) as T;
  } catch {
    return null;
  }
}

// For JSONB columns where legacy rows hold plain objects and we want to migrate
// transparently: writers wrap payloads as `{ enc: "enc:v1:..." }`; readers call
// unwrapJsonb() which decrypts when the marker is present, otherwise returns the
// object as-is. Old rows keep working; new rows are encrypted at rest.
export function wrapJsonb(obj: unknown): { enc: string } {
  return { enc: encryptJson(obj) };
}

export function unwrapJsonb<T = Record<string, unknown>>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.enc === 'string' && v.enc.startsWith('enc:v1:')) {
    return decryptJson<T>(v.enc);
  }
  return value as T;
}
