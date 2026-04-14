#!/usr/bin/env node
// Preview OpenAI TTS voices + instructions. Usage: node scripts/preview-tts.mjs [voice]
import fs from 'node:fs';
import path from 'node:path';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const voice = process.argv[2] || 'fable';
const key = process.env.OPENAI_API_KEY;
if (!key) { console.error('OPENAI_API_KEY missing'); process.exit(1); }

const instructions =
  'Speak in the calm, composed, distinguished voice of a sophisticated British AI butler. Measured pace, warm but precise diction, subtle dry wit. Refined, intelligent, and unflappably polite — the voice of a trusted personal assistant.';

const text =
  "Good morning, sir. It is 6:47 AM in Jakarta. You have three meetings today, the first at 9. Weather is clear, 28 degrees. Your resting heart rate overnight averaged 54. Shall I proceed with the full briefing?";

const res = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-4o-mini-tts',
    voice,
    speed: 0.95,
    input: text,
    instructions,
    response_format: 'mp3',
  }),
});

if (!res.ok) { console.error('TTS error', res.status, await res.text()); process.exit(1); }

const out = path.resolve(`tts-preview-${voice}.mp3`);
fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log(`Saved ${out}`);
