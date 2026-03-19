import { supabase } from '@/lib/supabase';
import type { ContextPageKey } from '@/lib/sync/notionContext';

const ALL_PAGES: ContextPageKey[] = ['about_me', 'communication', 'work', 'growth', 'projects'];
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

// Convenience: get all pages (for briefing, voice, delta)
export function allPages(): ContextPageKey[] {
  return ALL_PAGES;
}
