import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const GET = withAuth(async () => {
  const age = 35;
  const lthr = 164;
  const maxHR = 220 - age;

  // Fetch 4-week average resting HR from Garmin
  let restingHR = 52; // fallback
  try {
    const { data } = await supabase
      .from('garmin_daily')
      .select('resting_hr')
      .not('resting_hr', 'is', null)
      .order('date', { ascending: false })
      .limit(28);
    if (data && data.length > 0) {
      const sum = data.reduce((acc, row) => acc + (row.resting_hr ?? 0), 0);
      restingHR = Math.round(sum / data.length);
    }
  } catch {
    // Use fallback
  }

  return NextResponse.json({ age, restingHR, lthr, maxHR });
});
