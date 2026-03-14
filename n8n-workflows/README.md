# n8n Workflows for Jarvis

## Setup Instructions

### 1. Add Credentials in n8n

Before importing workflows, set up these credentials in n8n (Settings → Credentials):

- **Supabase**: URL = `https://voycxhchxtggncosfzuf.supabase.co`, Service Role Key
- **Anthropic**: Your API key (`sk-ant-...`)
- **Google Calendar OAuth2**: Client ID + Client Secret from Google Cloud Console

### 2. Import Workflows

For each JSON file:
1. Go to n8n → Workflows → **Import from File**
2. Select the JSON file
3. Open the imported workflow
4. Update each node's credential dropdown to point to your saved credentials
5. Activate the workflow

### Workflows

#### `google-calendar-sync.json`
- **Schedule**: Every 15 minutes
- **What it does**: Fetches today's Google Calendar events and syncs them to Supabase `calendar_events` table
- **Credentials needed**: Google Calendar OAuth2, Supabase

#### `morning-briefing.json`
- **Schedule**: Daily at 07:30 (WIB / UTC+7)
- **What it does**: Reads calendar + tasks from Supabase, sends to Claude for summary, saves briefing to `briefing_cache`
- **Credentials needed**: Supabase, Anthropic
- **Note**: Uses `claude-sonnet-4-20250514` with max 600 tokens and low temperature (0.3) to keep costs minimal

### Important Notes

- The morning briefing uses ~600 tokens per run (~$0.002/day with Sonnet)
- Calendar sync runs every 15 minutes but only reads/writes — no AI calls
- All workflows use the `jarvis` tag for easy filtering
