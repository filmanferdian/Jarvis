import { NextResponse } from 'next/server';

export function safeError(message: string, err: unknown, status = 500) {
  console.error(`[API Error] ${message}:`, err);
  return NextResponse.json({ error: message }, { status });
}
