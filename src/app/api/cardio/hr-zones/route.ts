import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const GET = withAuth(async () => {
  const age = 35;
  const lthr = 164;
  const maxHR = 220 - age;

  // Fetch latest resting HR from Garmin
  let restingHR = 52; // fallback
  try {
    const { data } = await supabase
      .from('garmin_daily')
      .select('resting_hr')
      .not('resting_hr', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .single();
    if (data?.resting_hr) restingHR = data.resting_hr;
  } catch {
    // Use fallback
  }

  return NextResponse.json({ age, restingHR, lthr, maxHR });
});
