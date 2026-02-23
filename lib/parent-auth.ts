import crypto from 'crypto';

// ============================================
// PIN hashing with Web Crypto API (PBKDF2)
// ============================================

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltHex = bufferToHex(salt.buffer as ArrayBuffer);
  const hashHex = bufferToHex(derivedBits);

  return `${saltHex}:${hashHex}`;
}

export async function verifyPin(
  pin: string,
  storedHash: string
): Promise<boolean> {
  const [saltHex, expectedHashHex] = storedHash.split(':');
  if (!saltHex || !expectedHashHex) return false;

  const salt = hexToBuffer(saltHex);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const derivedHex = bufferToHex(derivedBits);
  return derivedHex === expectedHashHex;
}

// ============================================
// Access token generation / verification
// ============================================

const SECRET =
  process.env.PARENT_ACCESS_SECRET ?? 'default-secret-change-me';

function hmacSign(payload: string): string {
  return crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');
}

export function generateAccessToken(studentId: string): string {
  const payload = JSON.stringify({
    studentId,
    exp: Date.now() + 30 * 60 * 1000, // 30 minutes
  });
  const encoded = Buffer.from(payload).toString('base64');
  const signature = hmacSign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyAccessToken(
  token: string
): { studentId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;
    const expectedSig = hmacSign(encoded);
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf-8')
    );

    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }

    if (typeof payload.studentId !== 'string') return null;

    return { studentId: payload.studentId };
  } catch {
    return null;
  }
}
