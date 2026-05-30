// Location gate + hard-exclude categories applied before LLM scoring.
// The keep-set is intentionally loose: anything not hard-excluded that clears
// the location gate goes to the LLM, which makes the final fit/level call.

// In-region signals. The bar is now narrow: a role must be BASED in Singapore
// or in Indonesia (Jakarta is the hub). Everything else is dropped before
// scoring, including the rest of SEA (KL, Bangkok, Manila, HCMC), broad
// APAC/remote labels, ANZ, South Asia, and East Asia. Locations are free-text
// and often compound (e.g. "Seoul; Singapore"); a single in-region hit keeps
// the role, so a role offered in both Singapore and Tokyo still passes on
// Singapore while a Tokyo-only role does not.
const IN_REGION_PATTERNS = [/singapore/i, /jakarta|indonesia/i];

// A role passes only if its (possibly compound) base location names Singapore
// or Indonesia/Jakarta. Bare "Remote" or "APAC" with no SG/Jakarta base fails.
export function passesLocationGate(location: string | null | undefined): boolean {
  const loc = (location || '').trim();
  if (!loc) return false;
  return IN_REGION_PATTERNS.some((re) => re.test(loc));
}

// Drop-before-LLM categories, matched against title + department. Keeps noise
// out: engineering/ML/research, design/UX, support specialists, financial-crime
// analyst/ops, internships and early-career.
const HARD_EXCLUDE = [
  /\bengineer(ing)?\b/i,
  /\bdeveloper\b/i,
  /\barchitect\b/i,
  /machine learning|\bml\b|research scientist|research engineer/i,
  /\bdesign(er)?\b|\bux\b|\bui\b/i,
  /product support|support specialist|customer support|technical support/i,
  /\baml\b|anti-money|financial crime|fraud analyst|compliance analyst/i,
  /\bintern(ship)?\b|new grad|early career|graduate program|apprentice/i,
];

export function isHardExcluded(title: string, department: string | null | undefined): boolean {
  const haystack = `${title} ${department || ''}`;
  return HARD_EXCLUDE.some((re) => re.test(haystack));
}

// Below-bar titles: clearly junior or IC-level roles that sit under Filman's
// Director / Head / regional-lead bar, so the LLM would always score them not a
// fit. Dropping them before scoring cuts cost and noise (matters most for
// traditional-title employers like Grab and GoTo where these dominate volume).
const BELOW_BAR =
  /\b(associate|assistant|officer|coordinator|analyst|specialist|representative|administrator|clerk|executive assistant)\b/i;
// Senior markers that override a below-bar word (e.g. "Associate Director",
// "Chief Risk Officer" must NOT be dropped on "associate" / "officer").
const SENIOR_OVERRIDE =
  /\b(head|director|chief|vice president|vp|president|partner|principal|managing director|general manager|country manager|gm)\b/i;

export function isBelowBar(title: string): boolean {
  if (SENIOR_OVERRIDE.test(title)) return false;
  return BELOW_BAR.test(title);
}

// True if a role should be kept for LLM scoring.
export function shouldScore(title: string, department: string | null, location: string | null): boolean {
  return passesLocationGate(location) && !isHardExcluded(title, department) && !isBelowBar(title);
}
