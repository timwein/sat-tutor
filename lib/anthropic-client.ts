import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { decryptSecret } from './crypto';
import type { Student } from './types';

/**
 * Per-student Anthropic clients (bring your own key).
 *
 * Every student stores their own API key (encrypted) on their students row.
 * AI features build a client from that key per request; there is no shared
 * house key. Routes turn key problems into a JSON error the UI understands:
 *   { error: string, code: ApiKeyErrorCode }
 */

export type ApiKeyErrorCode =
  | 'no_api_key'
  | 'invalid_api_key'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'anthropic_error';

export const API_KEY_MESSAGES: Record<ApiKeyErrorCode, string> = {
  no_api_key: 'Add your Anthropic API key in Settings to use AI features.',
  invalid_api_key: 'Your Anthropic API key was rejected. Check it in Settings.',
  insufficient_credits:
    'Your Anthropic account is out of credits. Add credits at console.anthropic.com, then try again.',
  rate_limited: 'Anthropic rate limit reached for your key. Wait a moment and try again.',
  anthropic_error: 'The AI service returned an error. Please try again.',
};

const STATUS_FOR_CODE: Record<ApiKeyErrorCode, number> = {
  no_api_key: 402,
  invalid_api_key: 402,
  insufficient_credits: 402,
  rate_limited: 429,
  anthropic_error: 502,
};

export class ApiKeyError extends Error {
  code: ApiKeyErrorCode;
  status: number;
  constructor(code: ApiKeyErrorCode, message?: string) {
    super(message ?? API_KEY_MESSAGES[code]);
    this.name = 'ApiKeyError';
    this.code = code;
    this.status = STATUS_FOR_CODE[code];
  }
}

export function hasAnthropicKey(student: Pick<Student, 'anthropic_key_ciphertext'>): boolean {
  return typeof student.anthropic_key_ciphertext === 'string' && student.anthropic_key_ciphertext.length > 0;
}

/**
 * Build a client from the student's stored key. Throws ApiKeyError('no_api_key')
 * when none is stored; routes should catch with anthropicErrorResponse().
 */
export function getAnthropicClient(student: Pick<Student, 'anthropic_key_ciphertext'>): Anthropic {
  if (!hasAnthropicKey(student)) throw new ApiKeyError('no_api_key');
  let apiKey: string;
  try {
    apiKey = decryptSecret(student.anthropic_key_ciphertext as string);
  } catch (err) {
    console.error('Failed to decrypt stored API key:', err);
    throw new ApiKeyError(
      'invalid_api_key',
      'Your stored API key could not be read. Please re-enter it in Settings.'
    );
  }
  return new Anthropic({ apiKey });
}

/** Same as getAnthropicClient but returns null instead of throwing when no key is stored. */
export function getOptionalAnthropicClient(
  student: Pick<Student, 'anthropic_key_ciphertext'>
): Anthropic | null {
  if (!hasAnthropicKey(student)) return null;
  try {
    return getAnthropicClient(student);
  } catch {
    return null;
  }
}

/**
 * Classify an error thrown by the SDK or by getAnthropicClient().
 * Returns null when it is not an Anthropic/key problem (let the route 500).
 */
export function describeAnthropicError(
  err: unknown
): { code: ApiKeyErrorCode; message: string; status: number } | null {
  if (err instanceof ApiKeyError) {
    return { code: err.code, message: err.message, status: err.status };
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { code: 'invalid_api_key', message: API_KEY_MESSAGES.invalid_api_key, status: 402 };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { code: 'rate_limited', message: API_KEY_MESSAGES.rate_limited, status: 429 };
  }
  if (err instanceof Anthropic.BadRequestError && /credit balance|billing|purchase credits/i.test(err.message)) {
    return { code: 'insufficient_credits', message: API_KEY_MESSAGES.insufficient_credits, status: 402 };
  }
  if (err instanceof Anthropic.APIError) {
    return { code: 'anthropic_error', message: API_KEY_MESSAGES.anthropic_error, status: 502 };
  }
  return null;
}

/** JSON response for a key/Anthropic error, or null if the error is something else. */
export function anthropicErrorResponse(err: unknown): NextResponse | null {
  const described = describeAnthropicError(err);
  if (!described) return null;
  return NextResponse.json(
    { error: described.message, code: described.code },
    { status: described.status }
  );
}

/** Cheap validation of a freshly entered key: list models (no tokens spent). */
export async function validateAnthropicApiKey(
  apiKey: string
): Promise<{ ok: true } | { ok: false; code: ApiKeyErrorCode; message: string }> {
  const trimmed = apiKey.trim();
  if (!/^sk-ant-/.test(trimmed)) {
    return {
      ok: false,
      code: 'invalid_api_key',
      message: 'That does not look like an Anthropic API key (they start with sk-ant-).',
    };
  }
  try {
    const client = new Anthropic({ apiKey: trimmed, maxRetries: 0 });
    await client.models.list({ limit: 1 });
    return { ok: true };
  } catch (err) {
    const described = describeAnthropicError(err);
    if (described) return { ok: false, code: described.code, message: described.message };
    return {
      ok: false,
      code: 'anthropic_error',
      message: 'Could not reach Anthropic to verify the key. Please try again.',
    };
  }
}
