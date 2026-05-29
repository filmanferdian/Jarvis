import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { CareerStatusSchema } from '@/lib/validation';
import { safeError } from '@/lib/errors';

export const PATCH = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CareerStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { id, status } = parsed.data;
    const { error } = await supabase
      .from('career_job_watch')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return safeError('Career status update failed', err);
  }
});
