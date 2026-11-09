# Upgrade notes

**Starting point:** extracted the previous `Bloom-and-Balance-Conversational-Netlify.zip` and changed its existing HTML, CSS and JavaScript. No replacement design or reset of browser data was introduced.

**Preserved:** original sidebar, dashboard, tasks and calendar, Today's plan popup, priority categories and expandable sub-priorities, budgets, transactions, savings goals, projects, habits, visual theme and original storage key `bloom-and-balance-v1`.

**Corrected:** old scripted Speak to Bloom's grammar/regex state machine was removed from the active conversation logic. `sendToBloom` now calls a secure authenticated Netlify backend with real model tool calls, and the backend checks successful Supabase writes before claiming a task or other change was persisted.

**New:** Notes/journal, note autosave/search/pinning/reminders; actual daily/weekly/monthly progress metrics; task reminder settings; push notification infrastructure; opt-in voice alerts; reviewed/deletable preference memory; Supabase cloud sign-in and syncing.

**External setup needed:** Supabase project and SQL schema, server-side AI model key, and Netlify Functions deployment. Background push additionally needs VAPID credentials and a scheduled function. No API credentials were supplied, so live cloud/AI/push behavior has not been tested end-to-end.

**Verification performed:** Node syntax checks; static HTML selector checks; mocked backend integration tests for real-data retrieval, task creation/editing, note save, finance recording and analysis, reminder and memory saves, rejected missing dates, authentication, and safe handling of failed database writes.

**Safety before upgrade:** download a JSON backup on the *current* website first, and keep the same Netlify site/domain when possible.
