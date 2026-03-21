#!/usr/bin/env node
/**
 * Backfill recent Garmin days from your local IP.
 * Fetches the last N days (default 3) directly.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-recent.mjs
 *   node --env-file=.env.local scripts/backfill-recent.mjs 7    # last 7 days
 */

import { GarminConnect } from 'garmin-connect';
import { createClient } from '@supabase/supabase-js';

const email = process.env.GARMIN_EMAIL;
const password = process.env.GARMIN_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DAYS = parseInt(process.argv[2] || '3', 10);

if (!email || !password || !supabaseUrl || !supabaseKey) {
  console.error('Missing env vars: GARMIN_EMAIL, GARMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchDay(client, dateStr) {
  const dateObj = new Date(`${dateStr}T00:00:00+07:00`);
  const apiBase = 'https://connectapi.garmin.com';

  const endpoints = [
    ['summary', () => client.get(`${apiBase}/usersummary-service/usersummary/daily/${dateStr}`)],
    ['bodyBattery', () => client.get(`${apiBase}/wellness-service/wellness/bodyBattery/dates/${dateStr}/${dateStr}`)],
    ['stress', () => client.get(`${apiBase}/wellness-service/wellness/dailyStress/${dateStr}`)],
    ['hrv', () => client.get(`${apiBase}/hrv-service/hrv/${dateStr}`)],
    ['trainingReadiness', () => client.get(`${apiBase}/metrics-service/metrics/trainingreadiness/${dateStr}`)],
    ['trainingStatus', () => client.get(`${apiBase}/metrics-service/metrics/trainingstatus/aggregated/${dateStr}`)],
    ['heartRate', () => client.getHeartRate(dateObj)],
    ['sleep', () => client.getSleepData(dateObj)],
  ];

  const raw = {};
  for (const [key, fn] of endpoints) {
    try {
      raw[key] = await fn();
    } catch (err) {
      console.warn(`  [${key}] failed: ${err.message?.slice(0, 80)}`);
      raw[key] = key === 'bodyBattery' || key === 'trainingReadiness' ? [] : {};
    }
    await sleep(1000); // 1s between calls
  }
  return raw;
}

function buildRecord(dateStr, raw) {
  const { summary = {}, stress = {}, hrv = {}, trainingStatus: ts = {}, sleep = {} } = raw;
  const sleepDTO = sleep.dailySleepDTO ?? {};
  const hrvSummary = hrv.hrvSummary ?? {};
  const recentVO2 = ts.mostRecentVO2Max?.generic ?? {};
  const tsMap = ts.mostRecentTrainingStatus?.latestTrainingStatusData ?? {};
  const firstTS = Object.values(tsMap)[0] ?? {};
  const acuteDTO = firstTS.acuteTrainingLoadDTO ?? {};
  const bbArray = stress.bodyBatteryValuesArray ?? [];
  const lastBB = bbArray.length > 0 ? bbArray[bbArray.length - 1] : null;
  const sleepScores = sleepDTO.sleepScores?.overall ?? {};
  const trFeedback = firstTS.trainingStatusFeedbackPhrase ?? null;

  return {
    date: dateStr,
    steps: summary.totalSteps ?? null,
    steps_goal: null,
    resting_hr: raw.heartRate?.restingHeartRate ?? null,
    stress_level: stress.avgStressLevel ?? null,
    hrv_status: hrvSummary.status ?? sleep.hrvStatus ?? null,
    hrv_7d_avg: hrvSummary.weeklyAvg ?? sleep.avgOvernightHrv ?? null,
    sleep_score: sleepScores.value ?? null,
    sleep_duration_seconds: sleepDTO.sleepTimeSeconds ?? null,
    body_battery: lastBB ? lastBB[2] : null,
    body_battery_charged: sleep.bodyBatteryChange != null ? Math.abs(sleep.bodyBatteryChange) : null,
    body_battery_drained: null,
    training_readiness: Array.isArray(raw.trainingReadiness) && raw.trainingReadiness.length > 0
      ? raw.trainingReadiness[0].score ?? null : null,
    training_status: trFeedback ? trFeedback.replace(/_\d+$/, '') : null,
    vo2_max: recentVO2.vo2MaxValue ?? null,
    calories_active: null, calories_resting: null, calories_total: null,
    fitness_age: recentVO2.fitnessAge ?? null,
    endurance_score: null,
    training_load_acute: acuteDTO.dailyTrainingLoadAcute ?? null,
    training_load_chronic: acuteDTO.dailyTrainingLoadChronic ?? null,
    raw_json: raw,
    last_synced: new Date().toISOString(),
  };
}

async function main() {
  console.log(`Logging in as ${email}...`);
  const client = new GarminConnect({ username: email, password });
  await client.login();
  console.log('Login OK\n');

  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    console.log(`Fetching ${dateStr}...`);

    const raw = await fetchDay(client, dateStr);
    const record = buildRecord(dateStr, raw);

    await supabase.from('garmin_daily').delete().eq('date', dateStr);
    const { error } = await supabase.from('garmin_daily').insert(record);
    if (error) {
      console.error(`  Failed to save: ${error.message}`);
    } else {
      console.log(`  Saved: steps=${record.steps}, sleep=${record.sleep_score}, stress=${record.stress_level}, bb=${record.body_battery}`);
    }

    if (i > 0) await sleep(3000); // 3s between days
  }

  // Save tokens for Railway
  const tokens = client.exportToken();
  await supabase.from('sync_status').upsert({
    sync_type: 'garmin-tokens',
    last_synced_at: new Date().toISOString(),
    last_result: 'success',
    last_error: JSON.stringify(tokens),
  }, { onConflict: 'sync_type' });

  console.log('\nDone! Tokens refreshed in Supabase.');
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });
