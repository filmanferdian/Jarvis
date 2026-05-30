import type { JobSource } from './types';
import { anthropicSource } from './anthropic';
import { openaiSource } from './openai';
import { grabSource } from './grab';
import { gotoSource } from './goto';
import { stripeSource } from './stripe';
import { revolutSource } from './revolut';

// Registry of all career sources. Add a new company by appending its source.
export const CAREER_SOURCES: JobSource[] = [
  anthropicSource,
  openaiSource,
  grabSource,
  gotoSource,
  stripeSource,
  revolutSource,
];

export type { JobSource, RawJob, SourceResult } from './types';
