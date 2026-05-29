// Location gate + hard-exclude categories applied before LLM scoring.
// The keep-set is intentionally loose: anything not hard-excluded that clears
// the location gate goes to the LLM, which makes the final fit/level call.

// In-region signals. The bar is: a role must plausibly include Indonesia.
// That means Indonesia itself, Singapore (the regional hub Filman targets),
// any SEA market, or a broad APAC / Asia-Pacific / remote-APAC label.
// Deliberately excluded because they do NOT include Indonesia: ANZ
// (Australia/New Zealand), South Asia (India and neighbours), and
// single-country East Asia (Japan, Korea, China, Hong Kong, Taiwan).
// Locations are free-text and often compound (e.g. "London, UK; Singapore");
// a single in-region hit keeps the role, so "Singapore; Tokyo" still passes
// on Singapore while "Tokyo, Japan" alone does not.
const APAC_PATTERNS = [
  /singapore/i,
  /\bapac\b/i,
  /asia[\s-]?pacific/i,
  /\bsea\b/i,
  /southeast asia/i,
  /jakarta|indonesia/i,
  /kuala lumpur|malaysia/i,
  /bangkok|thailand/i,
  /manila|philippines/i,
  /ho chi minh|saigon|hanoi|vietnam/i,
  /phnom penh|cambodia/i,
];

// "Remote-Friendly, United States" and bare US/EU remote must NOT count as
// APAC-relevant. A remote role only passes if it also names an APAC region.
export function passesLocationGate(location: string | null | undefined): boolean {
  const loc = (location || '').trim();
  if (!loc) return false;
  return APAC_PATTERNS.some((re) => re.test(loc));
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

// True if a role should be kept for LLM scoring.
export function shouldScore(title: string, department: string | null, location: string | null): boolean {
  return passesLocationGate(location) && !isHardExcluded(title, department);
}
