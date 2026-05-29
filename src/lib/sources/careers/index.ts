import type { JobSource } from './types';
import { anthropicSource } from './anthropic';
import { stripeSource } from './stripe';
import { revolutSource } from './revolut';

// Registry of all career sources. Add a new company by appending its source.
export const CAREER_SOURCES: JobSource[] = [anthropicSource, stripeSource, revolutSource];

export type { JobSource, RawJob, SourceResult } from './types';
