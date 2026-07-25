import { supabase } from '@/lib/supabase';
import type { ContextPageKey } from '@/lib/sync/notionContext';

const ALL_PAGES: ContextPageKey[] = ['about_me', 'communication', 'work', 'growth', 'projects', 'ghostwriting'];
const DEFAULT_PAGES: ContextPageKey[] = ['about_me', 'communication', 'work'];

interface JarvisContext {
  systemPrompt: string;
  userContext: string;
}

interface BuildOptions {
  pages?: ContextPageKey[];
  additionalContext?: string;
}

// In-memory cache (per serverless invocation)
let cachedContext: { data: Map<string, string>; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SECTION_HEADERS: Record<ContextPageKey, string> = {
  about_me: 'ABOUT THE USER',
  communication: 'COMMUNICATION & AI INTERACTION PREFERENCES',
  work: 'WORK PRIORITIES',
  growth: 'GROWTH & LEARNING',
  projects: 'PROJECTS',
  ghostwriting: 'GHOSTWRITING STYLE GUIDE',
};

const BASE_PERSONA = `You are Jarvis, a refined British butler and chief of staff to Filman Ferdian. You combine the discretion of Alfred Pennyworth with the technical capability of Iron Man's Jarvis. You are direct, concise, and proactive. You know Filman's context deeply and use it to provide relevant, personalized assistance.`;

async function loadContext(): Promise<Map<string, string>> {
  if (cachedContext && Date.now() - cachedContext.ts < CACHE_TTL) {
    return cachedContext.data;
  }

  const { data } = await supabase
    .from('notion_context')
    .select('page_key, content');

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.page_key, row.content);
  }

  cachedContext = { data: map, ts: Date.now() };
  return map;
}

export async function buildJarvisContext(options?: BuildOptions): Promise<JarvisContext> {
  const pages = options?.pages ?? DEFAULT_PAGES;
  const contextMap = await loadContext();

  const sections: string[] = [];
  for (const key of pages) {
    const content = contextMap.get(key);
    if (content) {
      sections.push(`--- ${SECTION_HEADERS[key]} ---\n${content}`);
    }
  }

  if (options?.additionalContext) {
    sections.push(`--- ADDITIONAL CONTEXT ---\n${options.additionalContext}`);
  }

  const userContext = sections.join('\n\n');
  const systemPrompt = `${BASE_PERSONA}\n\n${userContext}`;

  return { systemPrompt, userContext };
}

// Page selection is a cost and quality lever, not a formality. The context
// pages total roughly 39k characters (about 9.8k tokens), which is 13-26x
// larger than the hand-written instructions they precede. Loading all of them
// into every call buries the actual task, which is exactly what the Claude Code
// team's prompting guidance warns against. Give each caller the pages its task
// needs and nothing more.
//
// Measured 2026-07-25: about_me 9.7k chars, projects 8.3k, communication 7.2k,
// ghostwriting 5.7k, work 4.9k, growth 3.4k.

// Everything. Prefer a narrower selector; this stays for callers that genuinely
// need the full picture.
export function allPages(): ContextPageKey[] {
  return ALL_PAGES;
}

// Briefings cover schedule, tasks, priorities and progress. They never write in
// Filman's email voice, so the ghostwriting guide (5.7k chars, the most
// list-heavy page) is dead weight here.
export function briefingPages(): ContextPageKey[] {
  return ['about_me', 'communication', 'work', 'growth', 'projects'];
}

// Voice intent parsing turns one short spoken sentence into a JSON intent. It
// needs to recognise people and projects, nothing else. This is the hottest and
// most latency-sensitive path in the app, and it was previously loading all six
// pages, so trimming it to about_me alone drops roughly 29k characters (~75%)
// off every voice command.
export function voicePages(): ContextPageKey[] {
  return ['about_me'];
}
