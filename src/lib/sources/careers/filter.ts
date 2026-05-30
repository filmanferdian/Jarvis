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
// out: engineering/ML/research, design/UX, support specialists, financial-crime,
// internships, plus the support/control functions Filman explicitly ruled out
// (legal, audit, accounting/tax). Architecture is NOT excluded — Filman counts
// it as relevant — so senior architecture roles are allowed through.
const HARD_EXCLUDE = [
  /\bengineer(ing)?\b/i,
  /\bdeveloper\b/i,
  /machine learning|\bml\b|research scientist|research engineer/i,
  /\bdesign(er)?\b|\bux\b|\bui\b/i,
  /product support|support specialist|customer support|technical support/i,
  /\baml\b|anti-money|financial crime|fraud analyst|compliance analyst/i,
  /\bintern(ship)?\b|new grad|early career|graduate program|apprentice/i,
  /\blegal\b|\bcounsel\b|paralegal/i,
  /\baudit(or|ing)?\b/i,
  /\baccount(ing|ant)\b|\btax\b/i,
];

export function isHardExcluded(title: string, department: string | null | undefined): boolean {
  const haystack = `${title} ${department || ''}`;
  return HARD_EXCLUDE.some((re) => re.test(haystack));
}

// Seniority gate: Filman wants leadership only — Head, VP, GM, Director, or Lead
// level (10+ years). Plain "Manager" / "Senior Manager" and anything more junior
// are dropped. Higher titles (Chief, President, Principal, Managing Director)
// also qualify. "General/Country Manager" count (GM-level) even though they
// contain "Manager"; a bare "Manager" does not.
const SENIOR_TITLE =
  /\b(head|chief|president|vice president|vp|director|principal|managing director|general manager|country manager|gm|lead(?:er)?)\b/i;

export function hasSeniorTitle(title: string): boolean {
  return SENIOR_TITLE.test(title);
}

// True if a role should be kept for LLM scoring.
export function shouldScore(title: string, department: string | null, location: string | null): boolean {
  return passesLocationGate(location) && hasSeniorTitle(title) && !isHardExcluded(title, department);
}
