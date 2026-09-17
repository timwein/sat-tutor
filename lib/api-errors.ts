/**
 * Shared (client-safe) helpers for the JSON error shape API routes return:
 *   { error: string, code?: string }
 * Key-related codes come from lib/anthropic-client.ts on the server.
 */

export type ApiErrorCode =
  | 'no_api_key'
  | 'invalid_api_key'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'anthropic_error'
  | 'unauthorized'
  | 'forbidden'
  | 'parent_pin_required';

export interface ApiErrorBody {
  error?: string;
  code?: string;
}

export const API_KEY_ERROR_CODES: ReadonlySet<string> = new Set([
  'no_api_key',
  'invalid_api_key',
  'insufficient_credits',
  'rate_limited',
]);

/** True when the failure is about the student's own Anthropic key (fix in Settings). */
export function isApiKeyError(body: ApiErrorBody | null | undefined): boolean {
  return !!body?.code && API_KEY_ERROR_CODES.has(body.code);
}

export function apiErrorMessage(body: ApiErrorBody | null | undefined, fallback: string): string {
  return body?.error && body.error.trim().length > 0 ? body.error : fallback;
}

/** Parse a failed fetch Response into the standard error body (never throws). */
export async function readApiError(response: Response): Promise<ApiErrorBody> {
  try {
    const data = (await response.json()) as ApiErrorBody;
    return data ?? {};
  } catch {
    return {};
  }
}
