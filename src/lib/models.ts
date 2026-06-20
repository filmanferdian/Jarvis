// Single source of truth for the Claude model id used across Jarvis.
//
// Why this exists: the model id used to be a string literal copy-pasted into
// ~14 call sites. When `claude-sonnet-4-20250514` (Claude Sonnet 4) retired on
// 2026-06-15, every one of those calls started returning 404 not_found_error
// (morning briefing, email triage, email synthesis, etc.). Centralizing the id
// here makes the next model migration a one-line change instead of a repo-wide
// hunt. Import { CLAUDE_MODEL } and pass it as `model` to every Claude call.
//
// Current: Claude Sonnet 4.6 (claude-sonnet-4-6), the active Sonnet and the
// documented drop-in replacement for the retired Sonnet 4.
export const CLAUDE_MODEL = 'claude-sonnet-4-6';
