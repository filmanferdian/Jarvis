# n8n Workflows for Jarvis

## Setup Instructions

### 1. Add Credentials in n8n

Before importing workflows, set up these credentials in n8n (Settings → Credentials):

- **Supabase**: URL = `https://voycxhchxtggncosfzuf.supabase.co`, Service Role Key
- **Anthropic**: Your API key (`sk-ant-...`)
- **Google Calendar OAuth2**: Client ID + Client Secret from Google Cloud Console
- **Notion Internal Integration**: Create at https://www.notion.so/my-integrations, grant access to "Projects & Tasks" workspace

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

#### `outlook-calendar-sync.json`
- **Schedule**: Every 15 minutes
- **What it does**: Fetches today's Outlook Calendar events and syncs them to Supabase `calendar_events` table with `source = 'outlook'`
- **Credentials needed**: Microsoft OAuth2, Supabase

#### `notion-tasks-sync.json`
- **Schedule**: Every 30 minutes
- **What it does**: Queries the Notion Tasks database for active tasks (Not Started / In Progress) and syncs them to Supabase `notion_tasks` table
- **Credentials needed**: Notion Internal Integration, Supabase
- **Notion Database ID**: `014c674a-ecec-8338-94f3-0134b85d8c94` (Tasks)
- **Notion Projects DB ID**: `0a3c674a-ecec-8357-96c7-0129a693be3d` (Projects — used to resolve project names)

#### `morning-briefing.json`
- **Schedule**: Daily at 07:30 (WIB / UTC+7)
- **What it does**: Reads calendar + tasks from Supabase, sends to Claude for summary, saves briefing to `briefing_cache`
- **Credentials needed**: Supabase, Anthropic
- **Note**: Uses `claude-sonnet-4-20250514` with max 600 tokens to keep costs minimal

#### `email-synthesis.json`
- **Schedule**: Daily at 07:00 (WIB / UTC+7) — runs before morning briefing
- **What it does**: Fetches recent emails via Gmail API, sends to Claude to generate a synthesis (important items, deadlines), saves to `email_synthesis` table
- **Credentials needed**: Gmail OAuth2, Supabase, Anthropic

### Important Notes

- The morning briefing uses ~600 tokens per run (~$0.002/day with Sonnet)
- Calendar sync runs every 15 minutes but only reads/writes — no AI calls
- Notion sync runs every 30 minutes — no AI calls
- Email synthesis runs once daily before the morning briefing
- All workflows use the `jarvis` tag for easy filtering
