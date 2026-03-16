# N8N Workflow Fix Session — Prompt for Claude

> **Instructions**: Copy this entire prompt into a new Claude session that has access to your n8n instance at `https://n8nion8n-production-d73b.up.railway.app/`. Use the n8n API key below to authenticate API calls.

---

## Context

I have an n8n instance on Railway that processes emails and sends Telegram notifications. There are 3 key workflows:

- **WF1** (Email Classification — Main): Classifies incoming emails using AI and sends Telegram messages with inline keyboard buttons (Confirm / Relabel)
- **WF1B** (Email Classification — Alternate/Backup): Same as WF1 but for a different trigger or mailbox
- **WF3** (Telegram Callback Handler): Handles button presses from Telegram (when user clicks Confirm or Relabel), updates the classification, and edits the Telegram message to show the result

## N8N API Access

- **URL**: `https://n8nion8n-production-d73b.up.railway.app`
- **API Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYjM1MzVkMi05MTQ4LTQ4NTUtOGNhNi04YWJkZmNhMjc1NjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmEyMTc2MmItMTA1Zi00M2RhLTk1NzMtODc3ZjFkMzQ5M2U0IiwiaWF0IjoxNzczNDMzMDU5LCJleHAiOjE3NzU5NjY0MDB9.ik4_8288r1cH134mJKhVIhKaqEQUFc7w51B3a4iR8No`
- **Auth Header**: `X-N8N-API-KEY: <key above>`

### API Endpoints

```
GET  /api/v1/workflows              — List all workflows
GET  /api/v1/workflows/{id}         — Get workflow details (includes all nodes)
PUT  /api/v1/workflows/{id}         — Update workflow (send full workflow JSON)
POST /api/v1/workflows/{id}/activate   — Activate workflow
POST /api/v1/workflows/{id}/deactivate — Deactivate workflow
GET  /api/v1/executions?workflowId={id}&limit=10 — Get recent executions
```

---

## Task 1: Fix WF3 — Telegram Feedback Missing "Subject" and "From" Fields

### Problem
When a user clicks "Confirm" or "Relabel" on a Telegram notification, WF3 handles the callback and edits the message. However, the edited message shows **empty** "Subject" and "From" fields. The original Telegram message (sent by WF1/WF1B) contains these fields, but WF3 fails to extract them from the callback data.

### How to Debug

1. **Fetch WF3** — Find the workflow by listing all workflows, identify WF3 (the one handling Telegram callbacks/webhooks)
2. **Examine the "Parse Callback" node** (likely a Code or Function node) — This node processes the Telegram callback. It should extract `From` and `Subject` from either:
   - The callback data payload (if WF1 encodes them in the button callback_data)
   - The original message text (the Telegram message that had the buttons)
3. **Examine the "Update Telegram Message" node** — This node edits the Telegram message after classification. It should display the `From` and `Subject` values.

### Root Cause Analysis

The issue is likely one of:

**A) Callback data doesn't contain From/Subject**: WF1/WF1B may only encode the email ID and label in the callback_data (e.g., `confirm:12345:e/Newsletter`), not the From/Subject. In this case, WF3 needs to extract them from `callback_query.message.text` (the original message text).

**B) Parsing is wrong**: The Parse Callback node may try to extract From/Subject but uses incorrect regex or field paths.

**C) Variable reference is wrong**: The Update Telegram node may reference variables that don't exist in the execution context.

### Fix Strategy

1. In the **Parse Callback / Code node**, after receiving the callback:
   - Access the original message text via `$input.first().json.body.callback_query.message.text` (or similar path depending on the webhook structure)
   - Parse out Subject and From using regex on the original message text, e.g.:
     ```javascript
     const messageText = $input.first().json.body.callback_query.message.text;
     const subjectMatch = messageText.match(/Subject:\s*(.+)/);
     const fromMatch = messageText.match(/From:\s*(.+)/);
     const subject = subjectMatch ? subjectMatch[1].trim() : 'N/A';
     const from = fromMatch ? fromMatch[1].trim() : 'N/A';
     ```
   - Include these in the node output

2. In the **Update Telegram Message node**, use the extracted values in the message text.

### Verification
- After fixing, trigger a test by clicking a Confirm/Relabel button on a Telegram notification
- Check that the edited message shows the correct Subject and From

---

## Task 2: Add Fitness Sender Classification Rules to WF1 and WF1B

### Current State
A previous session added **financial institution sender rules** to WF1/WF1B. These rules check the sender/from address before AI classification and override the label if the sender matches known patterns.

### What to Add
Add **fitness/health sender rules** with the same pattern. These senders should always be classified as `e/Health-Fitness` regardless of email content.

### Known Fitness Senders (add these)
```
Kris Gethin
Jeremy Ethier
Jeff Nippard
RP (Renaissance Periodization) / rpstrength
Athlean-X / Jeff Cavaliere
Mike Israetel
V Shred
Bodybuilding.com
MyFitnessPal
Strava
Fitbit
Garmin
Peloton
Noom
Gymshark
```

### How to Implement

1. **Fetch WF1 and WF1B** from the API
2. **Find the classification node** — Look for the Code/Function node that does sender-based classification (the one with the financial institution rules added previously)
3. **Add fitness sender rules** in the same pattern. The check should be:
   - If sender matches any fitness sender pattern → assign label `e/Health-Fitness`
   - This should be checked AFTER financial rules (financial takes priority if somehow both match)
4. **Also identify additional fitness senders**: Look at recent executions of WF1/WF1B to find emails that were classified as health/fitness related, and extract their sender addresses to add to the rules

### Sender Matching Pattern
Match against the `from` field (email address and display name) using case-insensitive partial matching:
```javascript
const fitnessSenders = [
  'kris gethin', 'krisgethin',
  'jeremy ethier', 'jeremyethier',
  'jeff nippard', 'jeffnippard',
  'renaissance periodization', 'rpstrength', 'rp strength',
  'athlean', 'jeff cavaliere',
  'mike israetel',
  'v shred', 'vshred',
  'bodybuilding.com',
  'myfitnesspal',
  'strava',
  'fitbit',
  'garmin',
  'peloton',
  'noom',
  'gymshark',
];

const fromLower = from.toLowerCase();
const isFitnessSender = fitnessSenders.some(s => fromLower.includes(s));
if (isFitnessSender) {
  return { label: 'e/Health-Fitness', confidence: 'high', reason: 'Fitness sender' };
}
```

---

## Task 3: Verify Financial Institution Rules (Quick Check)

The previous session added financial institution classification. Quickly verify these are still in place and working:

### Expected Financial Senders (should already be in WF1/WF1B)
```
Bank Central Asia (BCA)
Bank Mandiri
Bank Negara Indonesia (BNI)
Bank Rakyat Indonesia (BRI)
CIMB Niaga
Bank Danamon
Bank Permata
OCBC NISP
Bank Mega
Panin Bank
Bank BTPN / Jenius
Bank Jago
Bank Digital BCA (Blu)
Sea Bank / SeaBank
Bank Neo Commerce
Ajaib
Bibit
Bareksa
Stockbit
OVO
GoPay
Dana
ShopeePay
LinkAja
Tokopedia
Shopee
```

- Financial senders with transactions → `e/Transactional`
- Financial senders without transactions → `e/Finance`

---

## Execution Order

1. First, list all workflows and identify WF1, WF1B, WF3 by their names/descriptions
2. Fetch each workflow's full JSON
3. Fix WF3 (Telegram From/Subject bug)
4. Add fitness senders to WF1 and WF1B
5. Verify financial rules are intact
6. Update each workflow via PUT API
7. Test by checking recent executions or triggering a test

---

## Important Notes

- Always **backup workflow JSON** before modifying (save the original response)
- When using `PUT /api/v1/workflows/{id}`, send the **complete workflow JSON** including all nodes
- Keep workflows **active** after updating
- The Telegram bot token and chat ID should already be configured in the existing nodes — don't change those
- All email labels use the format: `e/CategoryName` (e.g., `e/Health-Fitness`, `e/Transactional`, `e/Finance`, `e/Newsletter`)
