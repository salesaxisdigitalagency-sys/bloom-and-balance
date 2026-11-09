# Bloom & Balance ✿ — Intelligent Companion Upgrade

**This is an upgrade of the existing Bloom planner, not a rebuild.** The original look, layout, icons, tasks, budgets, savings goals, transactions, projects, habits, priorities, Today's plan popup, and browser data key (`bloom-and-balance-v1`) are preserved.

## What was wrong with the old Speak to Bloom?
The old `app.js` detected commands using regular expressions (for example, matching “add task” or “record income”) and ran a fixed conversation state machine. It could not understand general questions or references such as “What about Wednesday?” reliably. That parser has now been removed from the live assistant flow and replaced with a secure LLM endpoint using function/tool calling.

## What this upgrade adds

- Real, model-backed conversations through `/.netlify/functions/ai`. Multi-turn message context and English/Nigerian Pidgin conversations are supported **when a compatible AI service is configured**.
- Server-side tools for **reading, creating, editing, completing, rescheduling and deleting actual tasks**, setting task reminders, reviewing real finances and productivity, creating transactions, reading/writing Notes, priority categories and items, projects, and storing only explicitly authorized preferences.
- **Verified writes**: the backend writes changes to the user's Supabase row before reporting them successful. If a tool fails, Bloom receives the failure rather than a pretend success.
- **Notes & journal**: autosave while typing, editable notes, search, view by date, pin/unpin, collections, optional reminders. Notes persist after refresh.
- **Custom task reminders**: off, a chosen number of minutes before a timed task, or a custom date/time.
- **Background browser push notifications** via service worker, Supabase queue, and Netlify Scheduled Function, after optional configuration and device opt-in. Local notification checks still work when the app is open.
- Optional spoken alerts and soft/bright/silent tones while the app is open (browser restrictions apply). The system controls notification sounds when the app is closed.
- **Actual productivity metrics**: daily/weekly/monthly completion percentages, planned/done/pending, a weekly completion chart, best day and recommendations based on saved tasks.
- **Private memory controls**: the AI stores preferences only if you ask, and Settings lets you review and delete them.
- **Cloud sign-in and sync** for phone/computer, using Supabase Auth and Row Level Security.
- **Preserved original data** in the same browser origin. Settings → Backup still exports/imports JSON. Your existing data is not silently erased.

## IMPORTANT: AI requires setup and may cost money

There is no honest way to give a truly unrestricted, general-purpose ChatGPT-like AI through a purely static Netlify site with **no backend and no model provider**. The new code is real and wired up, but it cannot make live AI requests until the following external credentials and services are configured. Never put a secret AI key in `index.html`, `app.js`, or `config.js`.

Netlify, Supabase and AI providers may have free tiers, usage limits, or paid billing. **OpenAI API is a separate paid API service**; having a ChatGPT account alone does not provide API access. You can choose another **OpenAI-compatible, tool-calling model** using the `BLOOM_AI_*` environment variables, but reliability and pricing vary.

If you skip the cloud/AI setup, the beautiful planner and Notes still work locally. **Speak to Bloom will explicitly say that AI setup is required; it will not pretend to understand conversations through the old parser.**

## Deployment — don't use drag-and-drop for the full upgrade

**Netlify Drop only hosts static files; it does NOT deploy the Netlify Functions required for real AI and background reminders.** To use the upgraded AI, use **Netlify's Git repository deployment** or the **Netlify CLI with Functions**. You can keep your existing Netlify site by connecting it to a Git repository and deploying this upgrade to the same site, so its domain/origin stays the same.

### Step 1 — Back up your existing Bloom

1. Open your current site and choose **Settings & backups → Download my backup**.
2. Save the JSON file somewhere safe.
3. Keep the existing Netlify site address if possible; browser localStorage belongs to that address, and moving to a new domain does not automatically move your data.

### Step 2 — Make a Supabase project

1. Create a project at https://supabase.com/ .
2. Open **SQL Editor** and run the complete `supabase-schema.sql` file.
3. Open Project Settings / API and copy your **Project URL** and **anon/publishable key**.
4. Open Authentication → Email provider and enable email/password sign-ups. Configure email confirmation and site redirect URLs as desired.
5. **Never put the Supabase service_role key into frontend code.** It belongs only in Netlify's environment variables.

The SQL creates an authenticated `bloom_states` JSON store with Row Level Security, AI rate limiting, push subscriptions and a reminder queue. Existing local data is not modified by SQL setup.

### Step 3 — Configure the public browser variables

Edit `config.js` before deployment:

```js
window.BLOOM_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR-PUBLIC-ANON-KEY',
  vapidPublicKey: '' // optional; fill in only if enabling background push
};
```

These browser keys are public *by design*; never place `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or private VAPID keys here.

### Step 4 — Configure private Netlify environment variables

In **Netlify → Site configuration → Environment variables**, set:

| Variable | Required? | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Same Supabase Project URL |
| `SUPABASE_ANON_KEY` | Yes | Public anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Secret service-role key; **server only** |
| `OPENAI_API_KEY` | Yes for OpenAI | Your model API key; **server only** |
| `OPENAI_MODEL` | Optional | Default `gpt-4o-mini` |
| `BLOOM_AI_API_KEY` | Alternative | A compatible provider's secret API key (takes precedence) |
| `BLOOM_AI_BASE_URL` | Alternative | An HTTPS OpenAI Chat Completions-compatible endpoint that supports function/tool calling |
| `BLOOM_AI_MODEL` | Alternative | Model name supported by your alternative provider |

A compatible alternative model must support OpenAI-style `tools` and `tool_calls`. Not all free models do. This project uses a per-account 60-request/day AI limit in the Supabase SQL RPC (this is a safety quota, not a billing guarantee).

### Step 5 — Deploy with Git or Netlify CLI

**Recommended (Git):**
1. Create a private GitHub repository and upload **the entire extracted project directory**. Include `netlify/functions`, `package.json`, and `netlify.toml`.
2. In Netlify, use **Add new project → Import from Git** (or connect Git to your existing site).
3. Set the publish directory to `.` and Functions directory to `netlify/functions` (already in `netlify.toml`).
4. Netlify will install `web-push` from `package.json` during the build and bundle the functions. Deploy, then visit your site.
5. In Bloom Settings, create an account / sign in. It will offer to merge your existing device records into the cloud on first sign-in. A local recovery snapshot is stored as `bloom-before-cloud-sync` before merging. If you sign into a *different* account on the same device, Bloom asks before moving old local entries into that account.

**CLI alternative:** Install Netlify CLI and authenticate, then deploy the project with Functions (`netlify deploy --build --prod` after linking the site). A plain ZIP/static upload is **not enough for AI**.

### Step 6 — Optional background push notifications

1. In a terminal with `npm install` completed, run `npx web-push generate-vapid-keys`.
2. Put the **public** VAPID key in `config.js` as `vapidPublicKey`.
3. Add these **private server-side Netlify env vars**:
   - `VAPID_PUBLIC_KEY` — same public VAPID key
   - `VAPID_PRIVATE_KEY` — generated **private** key
   - `VAPID_SUBJECT` — e.g. `mailto:you@example.com`
4. Redeploy, sign in on each device, open **Settings → Enable background notifications**, and grant permission.
5. The `scheduled-reminders` Netlify Function is configured to run once per minute in `netlify.toml`; it checks saved reminders and sends Web Push notifications through `web-push`.

**Limitations:** Scheduled functions and push depend on your Netlify plan, browser, network, permissions, service-worker availability and OS policies. Push notifications may be delayed. On iPhone, browser push typically requires an installed Home Screen web app and compatible iOS version. **Spoken reminders and custom sounds are not guaranteed when the app is closed** (the OS chooses background alert presentation).

### Step 7 — Test using actual app data

1. Sign in to Bloom under Settings.
2. Add a task in the normal form and confirm it appears.
3. Tap Speak to Bloom, then try: `What do I have tomorrow?`
4. Follow up with `What about Wednesday?` then `Move that study task to Friday.` Check the calendar for the actual date.
5. Say `I want to add a task` and respond to Bloom's questions. It should ask about missing title/date rather than invent details.
6. Save a note, refresh, search for it, and ask Bloom to summarize it.
7. Record real expenses, then ask `What did I spend this month?` and compare the returned numbers with the Finance page.
8. Create a timed task with a reminder. Grant permission, check that an in-app reminder appears when due, and test background push with the app closed on a supported device.
9. Verify Notes, Habits, Projects, Priorities, Daily planner, Today popup and data backups still work.
10. For phone/computer sync, sign into the same account on both. Do not edit the same record simultaneously on two devices; this starter sync currently uses last-write-wins for conflicting edits.

## Privacy, limitations & data migration

- Your **original localStorage data key stays** `bloom-and-balance-v1`. Existing records are read in place. New fields (`notes`, `memory`, task reminder settings) are additive.
- When signed in, your records sync to your private Supabase row, protected by RLS. A local copy remains on the device for offline-friendly use and backups.
- Conversation history is stored in this device's browser (`bloom-ai-conversation-v2`) and can be cleared in Settings. Explicitly saved preferences go into `state.memory` and are reviewable/deletable in Settings.
- Each AI request sends only your recent conversation to the configured model; **tool calls may retrieve actual data (tasks, notes, financial details)** and send those tool results to the model to answer you. Do not connect an AI provider whose data-handling terms you do not accept.
- Browser voice recognition may depend on online speech services, and recognition of Nigerian Pidgin varies by device/browser. Type messages whenever voice recognition is inaccurate.
- Browser text-to-speech can require a user gesture and may not auto-play when the app starts.
- If an AI action fails, the backend returns a tool error; it does not record a success without a database write.
- **This upgrade has been statically checked and the AI tool/database flow tested with mocks.** End-to-end live AI, Supabase, Netlify deployment and background push **cannot be verified without your configured credentials and a deployed site**. Do not treat them as live-tested yet.
- Netlify/Supabase plan limits, model API charges, push availability and browser features must be checked on your actual account and device.

## Files

- `index.html`, `styles.css`, `app.js` — updated existing Bloom UI and local features
- `config.js` — public browser settings (no secrets)
- `netlify/functions/ai.js` — genuine LLM conversation with guarded tool calls
- `netlify/functions/_shared.cjs` — Supabase auth and database helpers
- `netlify/functions/push-subscribe.js`, `push-unsubscribe.js`, `sync-reminders.js`, `scheduled-reminders.js` — background push pipeline
- `supabase-schema.sql` — cloud database and Row Level Security schema
- `service-worker.js`, `manifest.webmanifest`, `icons` — offline frontend and PWA
- `netlify.toml`, `package.json` — deployment and function dependency config
- `tests/ai-smoke.cjs` — mock integration tests: `node tests/ai-smoke.cjs`
