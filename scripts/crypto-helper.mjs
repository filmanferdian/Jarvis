import { createCipheriv, createHash, randomBytes } from 'node:crypto';

const ENC_PREFIX = 'enc:v1:';
const IV_LEN = 12;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;

  const raw = process.env.CRYPTO_KEY;
  if (!raw) {
    throw new Error(
      'CRYPTO_KEY not configured. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }

  const hex = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : null;
  const b64 = Buffer.from(raw, 'base64');
  if (hex && hex.length === 32) {
    cachedKey = hex;
  } else if (b64.length === 32) {
    cachedKey = b64;
  } else {
    cachedKey = createHash('sha256').update(raw, 'utf8').digest();
  }

  return cachedKey;
}

function b64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${b64urlEncode(iv)}:${b64urlEncode(tag)}:${b64urlEncode(ct)}`;
}

export function encryptJson(obj) {
  return encrypt(JSON.stringify(obj));
}

export function wrapJsonb(obj) {
  return { enc: encryptJson(obj) };
}
