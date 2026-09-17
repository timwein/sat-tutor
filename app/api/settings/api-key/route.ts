import { NextRequest, NextResponse } from 'next/server';
import { requireApiStudent } from '@/lib/auth';
import { validateAnthropicApiKey } from '@/lib/anthropic-client';
import { encryptSecret, isEncryptionConfigured } from '@/lib/crypto';
import { createServerClient } from '@/lib/supabase';

/**
 * Manage the signed-in student's own Anthropic API key. The key arrives in
 * the JSON body only, is verified against Anthropic, then stored encrypted.
 * The plaintext key is never returned or logged.
 */

const ENCRYPTION_NOT_CONFIGURED =
  'Server is missing API_KEY_ENCRYPTION_SECRET; ask the admin to set it.';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiStudent();
    if (!auth.ok) return auth.response;
    const { student } = auth;

    if (!isEncryptionConfigured()) {
      return NextResponse.json({ error: ENCRYPTION_NOT_CONFIGURED }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    const apiKey = typeof body?.api_key === 'string' ? body.api_key.trim() : '';
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Paste your Anthropic API key first.', code: 'invalid_api_key' },
        { status: 400 }
      );
    }

    const validation = await validateAnthropicApiKey(apiKey);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.message, code: validation.code },
        { status: 400 }
      );
    }

    const last4 = apiKey.slice(-4);
    const addedAt = new Date().toISOString();
    const supabase = createServerClient();

    const { error } = await supabase
      .from('students')
      .update({
        anthropic_key_ciphertext: encryptSecret(apiKey),
        anthropic_key_last4: last4,
        anthropic_key_added_at: addedAt,
      })
      .eq('id', student.id);

    if (error) {
      console.error('API key save failed:', error.message);
      return NextResponse.json(
        { error: 'Failed to save your API key. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, last4, added_at: addedAt });
  } catch (error) {
    console.error('API key save error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const auth = await requireApiStudent();
    if (!auth.ok) return auth.response;
    const { student } = auth;

    const supabase = createServerClient();
    const { error } = await supabase
      .from('students')
      .update({
        anthropic_key_ciphertext: null,
        anthropic_key_last4: null,
        anthropic_key_added_at: null,
      })
      .eq('id', student.id);

    if (error) {
      console.error('API key removal failed:', error.message);
      return NextResponse.json(
        { error: 'Failed to remove your API key. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API key removal error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
