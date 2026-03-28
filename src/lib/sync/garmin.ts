import { GarminConnect } from 'garmin-connect';
import { supabase } from '@/lib/supabase';

// --- Rate limiting constants ---
const GARMIN_DAILY_CALL_BUDGET = 50;
const GARMIN_COOLDOWN_DEFAULT_MS = 6 * 60 * 60 * 1000; // 6h default
const GARMIN_MAX_BACKFILL_PER_RUN = 0;    // disabled — building data forward from Mar 16
const GARMIN_BACKFILL_DELAY_MS = 5000;    // was 2000
const GARMIN_MAX_CONSECUTIVE_FAILURES = 3;
const GARMIN_LOGIN_RETRIES = 1;           // was 3

export interface GarminSyncResult {
  date: string;
  metrics: Record<string, unknown>;
  activitiesSynced: number;
  historicalSynced: number;
  timestamp: string;
  skipped?: boolean;
  skipReason?: string;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getWibToday(): string {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffset);
  return formatDate(wibDate);
}

// --- Garmin session caching in Supabase ---
// Avoids re-login on every sync (Garmin aggressively rate-limits logins)

interface GarminTokens {
  oauth1: { oauth_token: string; oauth_token_secret: string };
  oauth2: Record<string, unknown>;
}

async function loadCachedTokens(): Promise<GarminTokens | null> {
  const { data } = await supabase
    .from('sync_status')
    .select('last_error')
    .eq('sync_type', 'garmin-tokens')
    .single();

  if (!data?.last_error) return null;

  try {
    const tokens = JSON.parse(data.last_error) as GarminTokens;
    // Check if OAuth2 token is expired (with 5 min buffer)
    // Token may be expired, but garmin-connect auto-refreshes using oauth1 + refresh_token
    // So we always return cached tokens and let the library handle refresh
    return tokens;
  } catch {
    return null;
  }
}

async function saveCachedTokens(client: GarminConnect): Promise<void> {
  try {
    const tokens = client.exportToken();
    // Store tokens in sync_status.last_error field (reusing existing table, no migration needed)
    await supabase.from('sync_status').upsert(
      {
        sync_type: 'garmin-tokens',
        last_synced_at: new Date().toISOString(),
        last_result: 'success',
        last_error: JSON.stringify(tokens),
      },
      { onConflict: 'sync_type' },
    );
  } catch (err) {
    console.error('Failed to cache Garmin tokens:', err);
  }
}

// --- Circuit breaker ---
// Stores block state in sync_status with sync_type = 'garmin-circuit-breaker'

interface CircuitBreakerState {
  blocked_until: string;
  reason: string;
  set_at: string;
  failure_count: number;
}

export async function isGarminBlocked(): Promise<{ blocked: boolean; reason: string; blockedUntil: string | null; failureCount: number }> {
  const { data } = await supabase
    .from('sync_status')
    .select('last_result, last_error')
    .eq('sync_type', 'garmin-circuit-breaker')
    .single();

  if (!data || data.last_result !== 'blocked') {
    return { blocked: false, reason: '', blockedUntil: null, failureCount: 0 };
  }

  try {
    const state = JSON.parse(data.last_error) as CircuitBreakerState;
    const blockedUntil = new Date(state.blocked_until);
    if (blockedUntil > new Date()) {
      return { blocked: true, reason: state.reason, blockedUntil: state.blocked_until, failureCount: state.failure_count ?? 1 };
    }
    // Expired — don't clear failure count yet, only clear on successful sync
    await supabase.from('sync_status').upsert(
      { sync_type: 'garmin-circuit-breaker', last_synced_at: new Date().toISOString(), last_result: 'clear', last_error: JSON.stringify({ failure_count: state.failure_count ?? 0 }) },
      { onConflict: 'sync_type' },
    );
    return { blocked: false, reason: '', blockedUntil: null, failureCount: state.failure_count ?? 0 };
  } catch {
    return { blocked: false, reason: '', blockedUntil: null, failureCount: 0 };
  }
}

async function setGarminBlocked(reason: string, cooldownMs?: number): Promise<void> {
  // Read previous failure count for exponential backoff
  let previousFailures = 0;
  try {
    const { data: existing } = await supabase
      .from('sync_status')
      .select('last_error')
      .eq('sync_type', 'garmin-circuit-breaker')
      .single();
    if (existing?.last_error) {
      const prev = JSON.parse(existing.last_error) as CircuitBreakerState;
      previousFailures = prev.failure_count ?? 0;
    }
  } catch { /* first time — no previous state */ }

  const failureCount = previousFailures + 1;
  // Exponential backoff: 6h, 12h, 24h, 48h (capped)
  const baseCooldown = cooldownMs ?? GARMIN_COOLDOWN_DEFAULT_MS;
  const escalatedCooldown = Math.min(baseCooldown * Math.pow(2, previousFailures), 48 * 60 * 60 * 1000);
  const blockedUntil = new Date(Date.now() + escalatedCooldown).toISOString();
  const state: CircuitBreakerState = {
    blocked_until: blockedUntil,
    reason,
    set_at: new Date().toISOString(),
    failure_count: failureCount,
  };
  await supabase.from('sync_status').upsert(
    {
      sync_type: 'garmin-circuit-breaker',
      last_synced_at: new Date().toISOString(),
      last_result: 'blocked',
      last_error: JSON.stringify(state),
    },
    { onConflict: 'sync_type' },
  );
  console.log(`[garmin] Circuit breaker OPEN: blocked until ${blockedUntil} (reason: ${reason}, failure #${failureCount}, cooldown: ${Math.round(escalatedCooldown / 3600000)}h)`);
}

export async function clearGarminBlock(): Promise<void> {
  await supabase.from('sync_status').upsert(
    {
      sync_type: 'garmin-circuit-breaker',
      last_synced_at: new Date().toISOString(),
      last_result: 'clear',
      last_error: null,
    },
    { onConflict: 'sync_type' },
  );
  console.log('[garmin] Circuit breaker CLEARED');
}

// --- 429 / Cloudflare error detection ---

function isRateLimitError(error: unknown): { isRateLimit: boolean; retryAfterMs: number | null } {
  const msg = error instanceof Error ? error.message : String(error);
  const patterns = [/429/i, /too many requests/i, /rate.?limit/i, /cloudflare/i, /blocked/i, /forbidden.*garmin/i];
  const isRateLimit = patterns.some((p) => p.test(msg));

  let retryAfterMs: number | null = null;
  // Try to extract Retry-After from error if available
  if (isRateLimit && error && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { headers?: { get?: (k: string) => string | null } } }).response;
    const retryAfter = resp?.headers?.get?.('retry-after');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        retryAfterMs = seconds * 1000;
      } else {
        const date = new Date(retryAfter);
        if (!isNaN(date.getTime())) {
          retryAfterMs = Math.max(0, date.getTime() - Date.now());
        }
      }
    }
  }

  return { isRateLimit, retryAfterMs };
}

// --- Daily API call budget ---

async function getGarminDailyCallCount(): Promise<number> {
  const today = getWibToday();
  const { data } = await supabase
    .from('api_usage_v2')
    .select('call_count')
    .eq('date', today)
    .eq('service', 'garmin')
    .single();
  return data?.call_count ?? 0;
}

async function trackGarminCalls(count: number): Promise<void> {
  try {
    const { trackServiceUsage } = await import('@/lib/rateLimit');
    for (let i = 0; i < count; i++) {
      await trackServiceUsage('garmin');
    }
  } catch { /* non-critical */ }
}

async function checkBudgetOrBlock(): Promise<void> {
  const calls = await getGarminDailyCallCount();
  if (calls >= GARMIN_DAILY_CALL_BUDGET) {
    // Calculate ms until midnight WIB
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffset);
    const wibMidnight = new Date(wibNow);
    wibMidnight.setUTCHours(24, 0, 0, 0);
    const msUntilMidnight = wibMidnight.getTime() - wibNow.getTime();
    await setGarminBlocked('daily-budget-exceeded', Math.max(msUntilMidnight, 60000));
    throw new Error(`Garmin daily API budget exceeded (${calls}/${GARMIN_DAILY_CALL_BUDGET} calls)`);
  }
}

export async function createGarminClient(retries = GARMIN_LOGIN_RETRIES): Promise<GarminConnect> {
  // Check circuit breaker before any API contact
  const blockStatus = await isGarminBlocked();
  if (blockStatus.blocked) {
    throw new Error(`Garmin API blocked until ${blockStatus.blockedUntil} (${blockStatus.reason})`);
  }

  // Check daily budget
  await checkBudgetOrBlock();

  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('GARMIN_EMAIL and GARMIN_PASSWORD must be configured');
  }

  const client = new GarminConnect({ username: email, password });

  // Try cached session first
  const cached = await loadCachedTokens();
  if (cached) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.loadToken(cached.oauth1, cached.oauth2 as any);
      // Verify the session works with a lightweight API call
      await client.getUserProfile();
      console.log('Garmin: restored session from cache');
      return client;
    } catch (err) {
      // Check if the verification call was rate-limited
      const { isRateLimit, retryAfterMs } = isRateLimitError(err);
      if (isRateLimit) {
        await setGarminBlocked('token-verify-blocked', retryAfterMs ?? GARMIN_COOLDOWN_DEFAULT_MS);
        throw new Error(`Garmin API rate-limited during token verify, blocked until cooldown`);
      }
      console.log('Garmin: cached session expired, will re-login:', (err as Error).message);
    }
  }

  // Fresh login with retries (reduced from 3 to 1)
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await client.login();
      console.log(`Garmin: fresh login succeeded${attempt > 1 ? ` on attempt ${attempt}` : ''}`);
      await saveCachedTokens(client);
      return client;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`Garmin login attempt ${attempt}/${retries} failed:`, lastError.message);

      // If rate-limited, trip circuit breaker immediately — do NOT retry
      const { isRateLimit, retryAfterMs } = isRateLimitError(err);
      if (isRateLimit) {
        await setGarminBlocked('login-blocked', retryAfterMs ?? GARMIN_COOLDOWN_DEFAULT_MS);
        throw new Error(`Garmin login rate-limited, blocked until cooldown`);
      }

      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Garmin login failed after ${retries} attempts: ${lastError?.message}`);
}

// Expected keys in raw_json when all endpoints are fetched
const COMPLETE_RAW_KEYS = ['summary', 'bodyBattery', 'stress', 'hrv', 'trainingReadiness', 'trainingStatus', 'heartRate', 'sleep'];

interface RawData {
  summary: Record<string, unknown>;
  bodyBattery: unknown[];
  stress: Record<string, unknown>;
  hrv: Record<string, unknown>;
  trainingReadiness: Record<string, unknown>[];
  trainingStatus: Record<string, unknown>;
  heartRate: Record<string, unknown>;
  sleep: Record<string, unknown>;
}

function buildDailyRecord(dateStr: string, raw: RawData, stepsOverride?: number | null) {
  const { summary, stress, hrv, trainingReadiness: tr, trainingStatus: ts, heartRate: hr, sleep } = raw;

  const sleepDTO = (sleep.dailySleepDTO as Record<string, unknown>) ?? {};
  const hrvSummary = (hrv.hrvSummary as Record<string, unknown>) ?? {};
  const recentVO2Generic = ((ts.mostRecentVO2Max as Record<string, unknown>)?.generic as Record<string, unknown>) ?? {};
  const trainingStatusMap = ((ts.mostRecentTrainingStatus as Record<string, unknown>)?.latestTrainingStatusData as Record<string, Record<string, unknown>>) ?? {};
  const firstTrainingStatus = Object.values(trainingStatusMap)[0] ?? {};
  const acuteDTO = (firstTrainingStatus.acuteTrainingLoadDTO as Record<string, unknown>) ?? {};
  const bbArray = (stress.bodyBatteryValuesArray as unknown[][] | null) ?? [];
  const lastBB = bbArray.length > 0 ? bbArray[bbArray.length - 1] : null;
  const bodyBatteryChange = (sleep.bodyBatteryChange as number) ?? null;
  const sleepScoresOverall = ((sleepDTO.sleepScores as Record<string, unknown>)?.overall as Record<string, unknown>) ?? {};
  const trainingFeedback = (firstTrainingStatus.trainingStatusFeedbackPhrase as string) ?? null;
  const trainingStatusLabel = trainingFeedback ? trainingFeedback.replace(/_\d+$/, '') : null;

  const steps = stepsOverride ?? (summary.totalSteps as number) ?? null;

  return {
    date: dateStr,
    steps,
    steps_goal: null as number | null,
    resting_hr: (hr.restingHeartRate as number) ?? null,
    stress_level: (stress.avgStressLevel as number) ?? null,
    hrv_status: (hrvSummary.status as string) ?? (sleep.hrvStatus as string) ?? null,
    hrv_7d_avg: (hrvSummary.weeklyAvg as number) ?? (sleep.avgOvernightHrv as number) ?? null,
    sleep_score: (sleepScoresOverall.value as number) ?? null,
    sleep_duration_seconds: (sleepDTO.sleepTimeSeconds as number) ?? null,
    body_battery: lastBB ? (lastBB[2] as number) : null,
    body_battery_charged: bodyBatteryChange != null ? Math.abs(bodyBatteryChange) : null,
    body_battery_drained: null as number | null,
    training_readiness: Array.isArray(tr) && tr.length > 0 ? (tr[0].score as number) ?? null : null,
    training_status: trainingStatusLabel,
    vo2_max: (recentVO2Generic.vo2MaxValue as number) ?? null,
    calories_active: null as number | null,
    calories_resting: null as number | null,
    calories_total: null as number | null,
    fitness_age: (recentVO2Generic.fitnessAge as number) ?? null,
    endurance_score: null as number | null,
    training_load_acute: (acuteDTO.dailyTrainingLoadAcute as number) ?? null,
    training_load_chronic: (acuteDTO.dailyTrainingLoadChronic as number) ?? null,
    raw_json: raw,
    last_synced: new Date().toISOString(),
  };
}

export async function syncGarmin(): Promise<GarminSyncResult> {
  const today = getWibToday();

  // Circuit breaker check — createClient also checks, but we check here to avoid even that overhead
  const blockStatus = await isGarminBlocked();
  if (blockStatus.blocked) {
    console.log(`[garmin] Sync skipped: ${blockStatus.reason}, blocked until ${blockStatus.blockedUntil}`);
    return {
      date: today, metrics: {}, activitiesSynced: 0, historicalSynced: 0,
      timestamp: new Date().toISOString(), skipped: true,
      skipReason: `Blocked until ${blockStatus.blockedUntil} (${blockStatus.reason})`,
    };
  }

  const client = await createGarminClient();
  const dateObj = new Date(`${today}T00:00:00+07:00`);

  // Fetch all 10 endpoints sequentially with 1s delay between each call
  // This avoids burst requests that trigger Cloudflare rate limiting
  const apiBase = `https://connectapi.garmin.com`;
  const allResults = await fetchSequential([
    () => client.getSteps(dateObj) as Promise<unknown>,
    () => client.getSleepData(dateObj) as Promise<unknown>,
    () => client.getHeartRate(dateObj) as Promise<unknown>,
    () => client.getActivities(0, 5) as Promise<unknown>,
    () => client.get(`${apiBase}/usersummary-service/usersummary/daily/${today}`),
    () => client.get(`${apiBase}/wellness-service/wellness/bodyBattery/dates/${today}/${today}`),
    () => client.get(`${apiBase}/wellness-service/wellness/dailyStress/${today}`),
    () => client.get(`${apiBase}/hrv-service/hrv/${today}`),
    () => client.get(`${apiBase}/metrics-service/metrics/trainingreadiness/${today}`),
    () => client.get(`${apiBase}/metrics-service/metrics/trainingstatus/aggregated/${today}`),
    () => client.get(`${apiBase}/fitnessage-service/fitnessage/${today}`),
  ]);
  const [steps, sleepData, heartRate, activities, dailySummary, bodyBattery, stressData, hrvData, trainingReadiness, trainingStatus, fitnessAgeData] = allResults;

  // Extract values safely
  const summary = dailySummary.status === 'fulfilled' ? dailySummary.value as Record<string, unknown> : {};
  const bb = bodyBattery.status === 'fulfilled' ? bodyBattery.value as unknown[] : [];
  const stress = stressData.status === 'fulfilled' ? stressData.value as Record<string, unknown> : {};
  const hrv = hrvData.status === 'fulfilled' ? hrvData.value as Record<string, unknown> : {};
  const tr = trainingReadiness.status === 'fulfilled' ? trainingReadiness.value as Record<string, unknown>[] : [];
  const ts = trainingStatus.status === 'fulfilled' ? trainingStatus.value as Record<string, unknown> : {};
  const hr = heartRate.status === 'fulfilled' ? heartRate.value as unknown as Record<string, unknown> : {};
  const sleep = sleepData.status === 'fulfilled' ? sleepData.value as unknown as Record<string, unknown> : {};
  const stepsVal = steps.status === 'fulfilled' ? steps.value as number : null;

  const fitnessAge = fitnessAgeData.status === 'fulfilled' ? fitnessAgeData.value as Record<string, unknown> : null;

  const rawData = { summary, bodyBattery: bb, stress, hrv, trainingReadiness: tr, trainingStatus: ts, heartRate: hr, sleep };
  const dailyRecord = buildDailyRecord(today, rawData, stepsVal);

  // Override fitness_age from dedicated endpoint (more reliable than trainingStatus)
  if (fitnessAge) {
    const fitnessAgeVal = (fitnessAge.chronologicalFitnessAge as number) ?? (fitnessAge.fitnessAge as number) ?? null;
    if (fitnessAgeVal != null) dailyRecord.fitness_age = Math.round(fitnessAgeVal);
    // Store fitness age response in raw_json for debugging
    (dailyRecord.raw_json as unknown as Record<string, unknown>).fitnessAge = fitnessAge;
  }

  // Upsert daily record (delete-then-insert for date-unique tables)
  await supabase.from('garmin_daily').delete().eq('date', today);
  const { error: dailyErr } = await supabase.from('garmin_daily').insert(dailyRecord);
  if (dailyErr) throw dailyErr;

  // Sync recent activities
  let activitiesSynced = 0;
  if (activities.status === 'fulfilled' && Array.isArray(activities.value)) {
    const actRecords = (activities.value as unknown as Record<string, unknown>[]).map((act) => ({
      activity_id: String(act.activityId),
      activity_type: (act.activityType as Record<string, unknown>)?.typeKey as string ?? String(act.activityType),
      distance_meters: (act.distance as number) ?? null,
      duration_seconds: (act.duration as number) ? Math.round(act.duration as number) : null,
      avg_pace: (act.averageSpeed as number)
        ? `${Math.floor(1000 / (act.averageSpeed as number) / 60)}:${String(Math.floor((1000 / (act.averageSpeed as number)) % 60)).padStart(2, '0')} /km`
        : null,
      avg_hr: (act.averageHR as number) ?? null,
      calories: (act.calories as number) ?? null,
      started_at: act.startTimeLocal ? new Date(act.startTimeLocal as string + '+07:00').toISOString() : act.startTimeGMT ? new Date(act.startTimeGMT as string + 'Z').toISOString() : null,
      raw_json: act,
      last_synced: new Date().toISOString(),
    }));

    for (const rec of actRecords) {
      const { error } = await supabase
        .from('garmin_activities')
        .upsert(rec, { onConflict: 'activity_id' });
      if (!error) activitiesSynced++;
    }

    // Auto-detect 10k run: find fastest run >=9.5km and record as health measurement
    const runs10k = actRecords.filter(
      (r) => r.activity_type?.includes('run') && r.distance_meters != null && r.distance_meters >= 9500 && r.duration_seconds != null
    );
    if (runs10k.length > 0) {
      const fastest = runs10k.reduce((best, r) =>
        (r.duration_seconds! < best.duration_seconds!) ? r : best
      );
      // Upsert to health_measurements (date from activity start, not today)
      const runDate = fastest.started_at
        ? new Date(fastest.started_at).toISOString().split('T')[0]
        : today;
      await supabase.from('health_measurements').delete()
        .eq('date', runDate)
        .eq('measurement_type', 'run_10k_seconds');
      await supabase.from('health_measurements').insert({
        date: runDate,
        measurement_type: 'run_10k_seconds',
        value: fastest.duration_seconds,
        unit: 'seconds',
        source: 'garmin',
      });
    }
  }

  // Auto-update domain KPIs for Health & Fitness
  await updateHealthKpis(dailyRecord);

  // Prune records older than 56 days
  await pruneOldRecords();

  // Refresh cached tokens and reset circuit breaker failure count after successful sync
  await saveCachedTokens(client);
  await clearGarminBlock();

  // --- Incremental historical backfill (reduced to 2 days per run) ---
  let historicalSynced = 0;

  // Skip backfill if circuit breaker was tripped during today's sync
  const postSyncBlock = await isGarminBlocked();
  if (!postSyncBlock.blocked) {
    try {
      const allDates: string[] = [];
      for (let i = RETENTION_DAYS; i >= 2; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        allDates.push(formatDate(d));
      }

      const { data: existingRecords } = await supabase
        .from('garmin_daily')
        .select('date, raw_json')
        .in('date', allDates);

      const histMap = new Map<string, Record<string, unknown>>();
      for (const row of existingRecords ?? []) {
        histMap.set(row.date, row.raw_json as Record<string, unknown>);
      }

      const datesToFill: { dateStr: string; existingRaw: Record<string, unknown> | null }[] = [];
      for (const dateStr of allDates) {
        if (datesToFill.length >= GARMIN_MAX_BACKFILL_PER_RUN) break;
        const raw = histMap.get(dateStr) ?? null;
        if (!raw) {
          datesToFill.push({ dateStr, existingRaw: null });
        } else {
          const keys = Object.keys(raw);
          const isComplete = COMPLETE_RAW_KEYS.every((k) => keys.includes(k));
          if (!isComplete) {
            datesToFill.push({ dateStr, existingRaw: raw });
          }
        }
      }

      if (datesToFill.length > 0) {
        console.log(`[garmin] Incremental backfill: ${datesToFill.length} historical days to fill`);
      }

      for (const { dateStr, existingRaw } of datesToFill) {
        // Re-check circuit breaker before each day
        const midLoopBlock = await isGarminBlocked();
        if (midLoopBlock.blocked) {
          console.log(`[garmin] Backfill halted: circuit breaker tripped (${midLoopBlock.reason})`);
          break;
        }

        try {
          const histDateObj = new Date(`${dateStr}T00:00:00+07:00`);

          if (existingRaw) {
            const rawData: RawData = {
              summary: (existingRaw.summary as Record<string, unknown>) ?? {},
              bodyBattery: (existingRaw.bodyBattery as unknown[]) ?? [],
              stress: (existingRaw.stress as Record<string, unknown>) ?? {},
              hrv: (existingRaw.hrv as Record<string, unknown>) ?? {},
              trainingReadiness: (existingRaw.trainingReadiness as Record<string, unknown>[]) ?? [],
              trainingStatus: (existingRaw.trainingStatus as Record<string, unknown>) ?? {},
              heartRate: (existingRaw.heartRate as Record<string, unknown>) ?? {},
              sleep: (existingRaw.sleep as Record<string, unknown>) ?? {},
            };
            const missingKeys = COMPLETE_RAW_KEYS.filter((k) => !Object.keys(existingRaw).includes(k));
            if (missingKeys.length > 0) {
              const freshData = await fetchAllEndpoints(client, dateStr, histDateObj);
              for (const key of missingKeys) {
                (rawData as unknown as Record<string, unknown>)[key] = (freshData as unknown as Record<string, unknown>)[key];
              }
            }
            const record = buildDailyRecord(dateStr, rawData);
            await supabase.from('garmin_daily').delete().eq('date', dateStr);
            const { error } = await supabase.from('garmin_daily').insert(record);
            if (!error) historicalSynced++;
          } else {
            const rawData = await fetchAllEndpoints(client, dateStr, histDateObj);
            const record = buildDailyRecord(dateStr, rawData);
            await supabase.from('garmin_daily').delete().eq('date', dateStr);
            const { error } = await supabase.from('garmin_daily').insert(record);
            if (!error) historicalSynced++;
          }

          console.log(`[garmin] Historical: synced ${dateStr}`);
          await new Promise((r) => setTimeout(r, GARMIN_BACKFILL_DELAY_MS));
        } catch (err) {
          console.error(`[garmin] Historical sync failed for ${dateStr}:`, err);
        }
      }

      if (historicalSynced > 0) {
        console.log(`[garmin] Incremental backfill complete: ${historicalSynced} days synced`);
      }
    } catch (err) {
      console.error('[garmin] Incremental backfill error:', err);
    }
  }

  return {
    date: today,
    metrics: {
      steps: dailyRecord.steps,
      resting_hr: dailyRecord.resting_hr,
      sleep_score: dailyRecord.sleep_score,
      stress_level: dailyRecord.stress_level,
      body_battery: dailyRecord.body_battery,
      training_readiness: dailyRecord.training_readiness,
      vo2_max: dailyRecord.vo2_max,
    },
    activitiesSynced,
    historicalSynced,
    timestamp: new Date().toISOString(),
  };
}

async function updateHealthKpis(daily: Record<string, unknown>): Promise<void> {
  // Look up Health and Fitness domain IDs
  const { data: domains } = await supabase
    .from('domains')
    .select('id, name')
    .in('name', ['Health', 'Fitness']);

  if (!domains) return;

  const healthDomain = domains.find((d) => d.name === 'Health');
  const fitnessDomain = domains.find((d) => d.name === 'Fitness');
  const now = new Date().toISOString();

  interface KpiEntry { domain_id: string; kpi_name: string; kpi_value: number | null; kpi_unit: string; last_updated: string; qualifier?: string | null }
  const kpis: KpiEntry[] = [];

  // Extract Garmin qualifiers from raw_json
  const raw = daily.raw_json as Record<string, unknown> | null;
  const sleepQualifier = raw
    ? ((((raw.sleep as Record<string, unknown>)?.dailySleepDTO as Record<string, unknown>)
        ?.sleepScores as Record<string, unknown>)?.overall as Record<string, unknown>)
        ?.qualifierKey as string | undefined
    : undefined;
  const trArray = raw?.trainingReadiness as Record<string, unknown>[] | null;
  const trQualifier = Array.isArray(trArray) && trArray.length > 0
    ? (trArray[0].level as string | undefined) ?? null
    : null;
  if (healthDomain) {
    if (daily.resting_hr != null) kpis.push({ domain_id: healthDomain.id, kpi_name: 'Resting Heart Rate', kpi_value: daily.resting_hr as number, kpi_unit: 'bpm', last_updated: now });
    if (daily.sleep_score != null) kpis.push({ domain_id: healthDomain.id, kpi_name: 'Sleep Score', kpi_value: daily.sleep_score as number, kpi_unit: '/100', last_updated: now, qualifier: sleepQualifier ?? null });
    if (daily.hrv_7d_avg != null) kpis.push({ domain_id: healthDomain.id, kpi_name: 'HRV 7d Average', kpi_value: daily.hrv_7d_avg as number, kpi_unit: 'ms', last_updated: now });
  }

  if (fitnessDomain) {
    if (daily.training_readiness != null) kpis.push({ domain_id: fitnessDomain.id, kpi_name: 'Training Readiness', kpi_value: daily.training_readiness as number, kpi_unit: '/100', last_updated: now, qualifier: trQualifier });

    // Steps: 7-day average excluding today (use last 7 completed days)
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(Date.now() + wibOffset);
    const yesterday = new Date(wibNow.getTime() - 86400000).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(wibNow.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const { data: last7Days } = await supabase
      .from('garmin_daily')
      .select('steps')
      .gte('date', sevenDaysAgo)
      .lte('date', yesterday)
      .not('steps', 'is', null);
    if (last7Days && last7Days.length > 0) {
      const avg = Math.round(last7Days.reduce((sum, r) => sum + (r.steps as number), 0) / last7Days.length);
      kpis.push({ domain_id: fitnessDomain.id, kpi_name: 'Daily Steps', kpi_value: avg, kpi_unit: 'steps', last_updated: now });
    }
  }

  // Upsert KPIs — match on domain_id + kpi_name
  for (const kpi of kpis) {
    // Check if KPI exists
    const { data: existing } = await supabase
      .from('domain_kpis')
      .select('id')
      .eq('domain_id', kpi.domain_id)
      .eq('kpi_name', kpi.kpi_name)
      .single();

    if (existing) {
      await supabase
        .from('domain_kpis')
        .update({ kpi_value: String(kpi.kpi_value), kpi_unit: kpi.kpi_unit, last_updated: kpi.last_updated, qualifier: kpi.qualifier ?? null })
        .eq('id', existing.id);
    } else {
      await supabase.from('domain_kpis').insert({
        domain_id: kpi.domain_id,
        kpi_name: kpi.kpi_name,
        kpi_value: String(kpi.kpi_value),
        kpi_unit: kpi.kpi_unit,
        last_updated: kpi.last_updated,
        qualifier: kpi.qualifier ?? null,
      });
    }
  }
}

const RETENTION_DAYS = 56;

async function pruneOldRecords(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoff = cutoffDate.toISOString().split('T')[0];

  await Promise.allSettled([
    supabase.from('garmin_daily').delete().lt('date', cutoff),
    supabase.from('garmin_activities').delete().lt('started_at', new Date(cutoff).toISOString()),
    supabase.from('weight_log').delete().lt('date', cutoff),
    supabase.from('health_measurements').delete().lt('date', cutoff),
  ]);
}

export interface BackfillResult {
  days_synced: number;
  days_enriched: number;
  days_skipped: number;
  days_failed: number;
  activities_synced: number;
}

// Sequential fetch with delay between each call to avoid Cloudflare bursts
const GARMIN_INTER_CALL_DELAY_MS = 1000;

async function fetchSequential<T>(calls: (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < calls.length; i++) {
    try {
      const value = await calls[i]();
      results.push({ status: 'fulfilled', value });
    } catch (reason) {
      results.push({ status: 'rejected', reason });

      // If rate-limited, trip breaker and stop fetching — return partial results
      const { isRateLimit, retryAfterMs } = isRateLimitError(reason);
      if (isRateLimit) {
        await setGarminBlocked('429-endpoint', retryAfterMs ?? GARMIN_COOLDOWN_DEFAULT_MS);
        // Fill remaining slots as rejected
        for (let j = i + 1; j < calls.length; j++) {
          results.push({ status: 'rejected', reason: new Error('skipped: circuit breaker tripped') });
        }
        break;
      }
    }
    // Delay between calls (skip after last)
    if (i < calls.length - 1) {
      await new Promise((r) => setTimeout(r, GARMIN_INTER_CALL_DELAY_MS));
    }
  }
  await trackGarminCalls(results.filter((r) => r.status !== 'rejected' || !(r.reason instanceof Error && r.reason.message.startsWith('skipped:'))).length);
  return results;
}

async function fetchAllEndpoints(client: GarminConnect, dateStr: string, dateObj: Date): Promise<RawData> {
  const apiBase = 'https://connectapi.garmin.com';

  const results = await fetchSequential([
    () => client.get(`${apiBase}/usersummary-service/usersummary/daily/${dateStr}`),
    () => client.get(`${apiBase}/wellness-service/wellness/bodyBattery/dates/${dateStr}/${dateStr}`),
    () => client.get(`${apiBase}/wellness-service/wellness/dailyStress/${dateStr}`),
    () => client.get(`${apiBase}/hrv-service/hrv/${dateStr}`),
    () => client.get(`${apiBase}/metrics-service/metrics/trainingreadiness/${dateStr}`),
    () => client.get(`${apiBase}/metrics-service/metrics/trainingstatus/aggregated/${dateStr}`),
    () => client.getHeartRate(dateObj) as Promise<unknown>,
    () => client.getSleepData(dateObj) as Promise<unknown>,
  ]);

  const [dailySummary, bodyBattery, stressData, hrvData, trainingReadiness, trainingStatus, heartRate, sleepData] = results;

  return {
    summary: dailySummary.status === 'fulfilled' ? dailySummary.value as Record<string, unknown> : {},
    bodyBattery: bodyBattery.status === 'fulfilled' ? bodyBattery.value as unknown[] : [],
    stress: stressData.status === 'fulfilled' ? stressData.value as Record<string, unknown> : {},
    hrv: hrvData.status === 'fulfilled' ? hrvData.value as Record<string, unknown> : {},
    trainingReadiness: trainingReadiness.status === 'fulfilled' ? trainingReadiness.value as Record<string, unknown>[] : [],
    trainingStatus: trainingStatus.status === 'fulfilled' ? trainingStatus.value as Record<string, unknown> : {},
    heartRate: heartRate.status === 'fulfilled' ? heartRate.value as unknown as Record<string, unknown> : {},
    sleep: sleepData.status === 'fulfilled' ? sleepData.value as unknown as Record<string, unknown> : {},
  };
}

function adaptiveDelay(baseMs: number, consecutiveFailures: number): Promise<void> {
  const backoff = Math.min(baseMs * Math.pow(2, consecutiveFailures), 60000);
  const jitter = Math.random() * 2000;
  return new Promise((resolve) => setTimeout(resolve, backoff + jitter));
}

/** Fetch Garmin data for a specific date range (inclusive). Bypasses RETENTION_DAYS limit.
 *  Note: data older than RETENTION_DAYS will be pruned on next daily sync.
 *  Use computeBaseline=true to compute and save baselines to okr_targets instead. */
export async function backfillDateRange(startDate: string, endDate: string, computeBaseline = false): Promise<BackfillResult & { skipped?: boolean; skipReason?: string; baselines?: Record<string, number> }> {
  const blockStatus = await isGarminBlocked();
  if (blockStatus.blocked) {
    return {
      days_synced: 0, days_enriched: 0, days_skipped: 0, days_failed: 0, activities_synced: 0,
      skipped: true, skipReason: `Blocked until ${blockStatus.blockedUntil} (${blockStatus.reason})`,
    };
  }

  const client = await createGarminClient();
  const result: BackfillResult = {
    days_synced: 0, days_enriched: 0, days_skipped: 0, days_failed: 0, activities_synced: 0,
  };
  let consecutiveFailures = 0;

  // Generate date list
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  for (const dateStr of dates) {
    if (consecutiveFailures >= GARMIN_MAX_CONSECUTIVE_FAILURES) {
      console.log(`[garmin] Date range backfill halted: ${consecutiveFailures} consecutive failures`);
      await setGarminBlocked('consecutive-failures', GARMIN_COOLDOWN_DEFAULT_MS);
      break;
    }

    const midLoopBlock = await isGarminBlocked();
    if (midLoopBlock.blocked) break;

    try {
      const dateObj = new Date(dateStr + 'T00:00:00Z');
      const rawData = await fetchAllEndpoints(client, dateStr, dateObj);
      const record = buildDailyRecord(dateStr, rawData);

      await supabase.from('garmin_daily').delete().eq('date', dateStr);
      const { error } = await supabase.from('garmin_daily').insert(record);
      if (!error) result.days_synced++;
      consecutiveFailures = 0;
      await adaptiveDelay(GARMIN_BACKFILL_DELAY_MS, 0);
    } catch (err) {
      console.error(`Date range backfill error for ${dateStr}:`, err);
      result.days_failed++;
      consecutiveFailures++;

      if (isRateLimitError(err).isRateLimit) {
        const { retryAfterMs } = isRateLimitError(err);
        await setGarminBlocked('429-backfill', retryAfterMs ?? GARMIN_COOLDOWN_DEFAULT_MS);
        break;
      }
      await adaptiveDelay(GARMIN_BACKFILL_DELAY_MS, consecutiveFailures);
    }
  }

  await saveCachedTokens(client);

  // If computeBaseline, average the fetched rows and write to okr_targets
  if (computeBaseline && result.days_synced > 0) {
    const { data: rows } = await supabase
      .from('garmin_daily')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    if (rows && rows.length > 0) {
      const baselineMap: Record<string, { column: string; values: number[] }> = {
        resting_hr: { column: 'resting_hr', values: [] },
        steps: { column: 'steps', values: [] },
        sleep_duration_seconds: { column: 'sleep_duration_seconds', values: [] },
        stress_level: { column: 'stress_level', values: [] },
        body_battery: { column: 'body_battery', values: [] },
        hrv_7d_avg: { column: 'hrv_7d_avg', values: [] },
        vo2_max: { column: 'vo2_max', values: [] },
        fitness_age: { column: 'fitness_age', values: [] },
      };

      for (const row of rows) {
        for (const [key, meta] of Object.entries(baselineMap)) {
          const val = row[meta.column] as number | null;
          if (val != null) baselineMap[key].values.push(val);
        }
      }

      // Map garmin columns to okr_targets source_column
      const baselines: Record<string, number> = {};
      for (const [key, meta] of Object.entries(baselineMap)) {
        if (meta.values.length > 0) {
          const avg = Math.round((meta.values.reduce((a, b) => a + b, 0) / meta.values.length) * 10) / 10;
          baselines[key] = avg;
        }
      }

      // Write baselines to okr_targets where source_column matches
      for (const [col, value] of Object.entries(baselines)) {
        let writeValue = value;
        // Convert sleep seconds to hours for the sleep_hours KR
        if (col === 'sleep_duration_seconds') {
          writeValue = Math.round((value / 3600) * 10) / 10;
        }
        await supabase
          .from('okr_targets')
          .update({ baseline_value: writeValue })
          .eq('source_table', 'garmin_daily')
          .eq('source_column', col)
          .is('baseline_value', null);
      }

      // Clean up: delete the old rows that will be pruned anyway
      await supabase.from('garmin_daily').delete().gte('date', startDate).lte('date', endDate);

      return { ...result, baselines };
    }
  }

  return result;
}

export async function backfillGarmin(force = false): Promise<BackfillResult & { skipped?: boolean; skipReason?: string }> {
  // Circuit breaker check
  const blockStatus = await isGarminBlocked();
  if (blockStatus.blocked) {
    console.log(`[garmin] Backfill skipped: ${blockStatus.reason}, blocked until ${blockStatus.blockedUntil}`);
    return {
      days_synced: 0, days_enriched: 0, days_skipped: 0, days_failed: 0, activities_synced: 0,
      skipped: true, skipReason: `Blocked until ${blockStatus.blockedUntil} (${blockStatus.reason})`,
    };
  }

  const client = await createGarminClient();
  const result: BackfillResult = {
    days_synced: 0,
    days_enriched: 0,
    days_skipped: 0,
    days_failed: 0,
    activities_synced: 0,
  };
  let consecutiveFailures = 0;

  // Load existing records to classify dates
  const { data: existingRows } = await supabase
    .from('garmin_daily')
    .select('date, raw_json')
    .order('date', { ascending: true });

  const existingMap = new Map<string, Record<string, unknown>>();
  for (const row of existingRows ?? []) {
    existingMap.set(row.date, row.raw_json as Record<string, unknown>);
  }

  for (let i = RETENTION_DAYS; i >= 1; i--) {
    // Re-check circuit breaker before each day
    const midLoopBlock = await isGarminBlocked();
    if (midLoopBlock.blocked) {
      console.log(`[garmin] Backfill halted: circuit breaker tripped (${midLoopBlock.reason})`);
      break;
    }

    // Hard stop after too many consecutive failures
    if (consecutiveFailures >= GARMIN_MAX_CONSECUTIVE_FAILURES) {
      console.log(`[garmin] Backfill halted: ${consecutiveFailures} consecutive failures, tripping circuit breaker`);
      await setGarminBlocked('consecutive-failures', GARMIN_COOLDOWN_DEFAULT_MS);
      break;
    }

    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);

    const existingRaw = existingMap.get(dateStr);

    if (!force && existingRaw) {
      const existingKeys = Object.keys(existingRaw);
      const isComplete = COMPLETE_RAW_KEYS.every((k) => existingKeys.includes(k));

      if (isComplete) {
        result.days_skipped++;
        continue;
      }

      // PARTIAL: re-extract from existing raw_json using buildDailyRecord
      try {
        const rawData: RawData = {
          summary: (existingRaw.summary as Record<string, unknown>) ?? {},
          bodyBattery: (existingRaw.bodyBattery as unknown[]) ?? [],
          stress: (existingRaw.stress as Record<string, unknown>) ?? {},
          hrv: (existingRaw.hrv as Record<string, unknown>) ?? {},
          trainingReadiness: (existingRaw.trainingReadiness as Record<string, unknown>[]) ?? [],
          trainingStatus: (existingRaw.trainingStatus as Record<string, unknown>) ?? {},
          heartRate: (existingRaw.heartRate as Record<string, unknown>) ?? {},
          sleep: (existingRaw.sleep as Record<string, unknown>) ?? {},
        };

        const missingKeys = COMPLETE_RAW_KEYS.filter((k) => !existingKeys.includes(k));
        if (missingKeys.length > 0) {
          const freshData = await fetchAllEndpoints(client, dateStr, date);
          for (const key of missingKeys) {
            (rawData as unknown as Record<string, unknown>)[key] = (freshData as unknown as Record<string, unknown>)[key];
          }
          await adaptiveDelay(GARMIN_BACKFILL_DELAY_MS, 0);
        }

        const record = buildDailyRecord(dateStr, rawData);
        await supabase.from('garmin_daily').delete().eq('date', dateStr);
        const { error } = await supabase.from('garmin_daily').insert(record);
        if (!error) result.days_enriched++;
        consecutiveFailures = 0;
      } catch (err) {
        console.error(`Backfill enrich error for ${dateStr}:`, err);
        result.days_failed++;
        consecutiveFailures++;

        // Check if this was a rate limit error
        if (isRateLimitError(err).isRateLimit) {
          const { retryAfterMs } = isRateLimitError(err);
          await setGarminBlocked('429-backfill', retryAfterMs ?? GARMIN_COOLDOWN_DEFAULT_MS);
          break;
        }
        await adaptiveDelay(GARMIN_BACKFILL_DELAY_MS, consecutiveFailures);
      }
      continue;
    }

    // MISSING (or force): fetch all endpoints from API
    try {
      const rawData = await fetchAllEndpoints(client, dateStr, date);
      const record = buildDailyRecord(dateStr, rawData);

      await supabase.from('garmin_daily').delete().eq('date', dateStr);
      const { error } = await supabase.from('garmin_daily').insert(record);
      if (!error) result.days_synced++;
      consecutiveFailures = 0;

      await adaptiveDelay(GARMIN_BACKFILL_DELAY_MS, 0);
    } catch (err) {
      console.error(`Backfill fetch error for ${dateStr}:`, err);
      result.days_failed++;
      consecutiveFailures++;

      // Check if this was a rate limit error
      if (isRateLimitError(err).isRateLimit) {
        const { retryAfterMs } = isRateLimitError(err);
        await setGarminBlocked('429-backfill', retryAfterMs ?? GARMIN_COOLDOWN_DEFAULT_MS);
        break;
      }
      await adaptiveDelay(GARMIN_BACKFILL_DELAY_MS, consecutiveFailures);
    }
  }

  // Backfill activities (fetch last 100) — only if not blocked
  const postLoopBlock = await isGarminBlocked();
  if (!postLoopBlock.blocked) {
    try {
      const allActivities = await client.getActivities(0, 100);
      await trackGarminCalls(1);
      if (Array.isArray(allActivities)) {
        const actRecords = (allActivities as unknown as Record<string, unknown>[]).map((act) => ({
          activity_id: String(act.activityId),
          activity_type: (act.activityType as Record<string, unknown>)?.typeKey as string ?? String(act.activityType),
          distance_meters: (act.distance as number) ?? null,
          duration_seconds: (act.duration as number) ? Math.round(act.duration as number) : null,
          avg_pace: (act.averageSpeed as number)
            ? `${Math.floor(1000 / (act.averageSpeed as number) / 60)}:${String(Math.floor((1000 / (act.averageSpeed as number)) % 60)).padStart(2, '0')} /km`
            : null,
          avg_hr: (act.averageHR as number) ?? null,
          calories: (act.calories as number) ?? null,
          started_at: act.startTimeLocal ? new Date(act.startTimeLocal as string + '+07:00').toISOString() : act.startTimeGMT ? new Date(act.startTimeGMT as string + 'Z').toISOString() : null,
          raw_json: act,
          last_synced: new Date().toISOString(),
        }));

        for (const rec of actRecords) {
          const { error } = await supabase
            .from('garmin_activities')
            .upsert(rec, { onConflict: 'activity_id' });
          if (!error) result.activities_synced++;
        }
      }
    } catch (err) {
      console.error('Backfill activities error:', err);
    }
  }

  // Refresh tokens after successful backfill
  await saveCachedTokens(client);

  return result;
}
