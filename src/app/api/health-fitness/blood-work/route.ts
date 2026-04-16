import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const GET = withAuth(async () => {
  try {
    const { data: entries, error } = await supabase
      .from('blood_work')
      .select('marker_name, value, unit, reference_low, reference_high, test_date')
      .order('test_date', { ascending: false })
      .order('marker_name');

    if (error) throw error;

    const lastTestDate = entries && entries.length > 0 ? entries[0].test_date : null;

    return NextResponse.json({
      entries: entries ?? [],
      lastTestDate,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Blood work fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch blood work' },
      { status: 500 },
    );
  }
});
