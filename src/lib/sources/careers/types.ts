// Shared types for the career job-watch source layer.

export interface RawJob {
  company: string;
  external_id: string;
  title: string;
  department: string | null;
  location: string | null;
  url: string;
  description_raw: string | null;
}

export interface SourceResult {
  company: string;
  ok: boolean;
  jobs: RawJob[];
  error?: string;
}

// A source fetches and normalizes one company's open roles. Each must isolate
// its own failures (never throw) so one broken source can't abort the run.
export interface JobSource {
  company: string;
  fetch: () => Promise<SourceResult>;
}
