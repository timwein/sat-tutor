import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Symmetric encryption for secrets stored in the database (students' own
 * Anthropic API keys). AES-256-GCM with a key derived from
 * API_KEY_ENCRYPTION_SECRET. Rotating the secret invalidates stored keys.
 */

const VERSION = 'v1';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function isEncryptionConfigured(): boolean {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  return typeof secret === 'string' && secret.length >= 16;
}

function derivedKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'API_KEY_ENCRYPTION_SECRET is not set. Add a random string of at least 16 characters to the environment.'
    );
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', derivedKey(), iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split('.');
  if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Unrecognized encrypted payload format');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Unrecognized encrypted payload format');
  }
  const decipher = createDecipheriv('aes-256-gcm', derivedKey(), iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
