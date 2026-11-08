# כולל ערב תורתך שעשועי – Attendance & Payroll

Nightly attendance from the Anviz W1 Pro fingerprint scanner, pay calculation, principal approval and payroll.

**Stack:** Next.js (on Vercel) · Supabase (database + logins) · CrossChex Cloud (scanner data, from Phase 3)

## Status

| Phase | What | Status |
| --- | --- | --- |
| 1 | Database, logins and roles, Settings, Students and PINs | Done |
| 2 | Calendar with Hebrew dates, holidays, nights on/off, learning sessions, test dates | Done |
| 3 | Attendance rules, fixing punches, scans entered by hand | Done |
| 3b | CrossChex webhook + nightly backup sync | Built; needs keys and a real scan to confirm |
| 4 | Test sheet, weekly approval, payroll list, check numbers, print, Excel export | Done |
| 5 | Student portal: attendance with reasons, payments | Done |

## One-time setup

### 1. Supabase database

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste all of `supabase/migrations/0001_initial.sql` and click **Run**. Then do the same, in order, with `0002_attendance_payroll.sql`, `0003_torahscha_sync.sql`, `0004_special_days.sql`, `0005_holidays_daf.sql`, `0006_two_step.sql`, `0007_test_claim_window.sql`, `0008_test_id.sql` and `0009_test_night_attendance.sql`.
3. Make yourself the first admin. Run this with your own login email:
   ```sql
   insert into staff_invites (email, role, full_name) values ('your@email.com', 'admin', 'Your Name');
   ```
4. **Authentication → URL Configuration:**
   - Site URL: your Vercel address, for example `https://kollel-attendance.vercel.app`
   - Redirect URLs: add `https://kollel-attendance.vercel.app/auth/confirm` (and `http://localhost:3000/auth/confirm` for local testing)

### 2. Vercel

1. In Vercel, **Add New → Project** and import `kollelerevtsm/kollel-attendance`.
2. Under **Environment Variables**, add:

| Name | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → the **anon / publishable** key (never the service_role / secret key) |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel address, for example `https://kollel-attendance.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Added by the Supabase–Vercel connection |
| `CROSSCHEX_API_KEY` | CrossChex Cloud → Settings → Developer Mode → Cloud API |
| `CROSSCHEX_API_SECRET` | Same page |
| `CROSSCHEX_WEBHOOK_KEY` | Any long random text; also goes at the end of the webhook Server URL |
| `CRON_SECRET` | Any long random text (lets Vercel run the nightly backup pull) |

### Supabase email templates

Use `{{ .RedirectTo }}` (not `{{ .SiteURL }}`) in links: the Supabase–Vercel connection resets the Site URL to the protected
`...-kollel-clucking.vercel.app` address on every deploy, while the app always sends the correct address as RedirectTo.

Authentication → Emails. In **Magic Link** (also used for the two-step code) and **Confirm signup**, the body should be:

```html
<h2>Kollel Erev</h2>
<p>Your sign-in code is:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Or click: <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
<p>If you didn't try to sign in, you can ignore this email.</p>
```

### 4. CrossChex webhook

CrossChex Cloud → Settings → Developer Mode → Webhooks:
- Server URL: `https://<your site>/api/webhooks/crosschex?key=<CROSSCHEX_WEBHOOK_KEY>`
- Password: anything (the key in the URL is what's checked)
- Turn Webhooks on and Save.

Every night at about 10:30pm a backup pull fetches the last 3 days from the CrossChex API, in case a webhook was missed.
On test nights, a student who verifies with their **PIN** instead of a fingerprint is recorded as a test taker automatically.

3. Click **Deploy**. Every change pushed to GitHub deploys automatically after that.

### 3. Sign in

Go to the site, enter your email, and click the link in the email. Then:
- **Staff logins** (admin only): add the principal and the payroll person by email.
- **Students:** add each student. The PIN is set from the last 4 digits of the phone (5 if those are taken). Students sign in with the email on their record.
- **Calendar:** mark test dates, turn nights on or off, and add the learning session for each night.

## How the rules work

- A night counts scans between **Clock-in opens** and **Clock-out closes** (Settings). First scan = clock in, last scan = clock out.
- Paid if at least **Minutes required** passed between them; otherwise $0.
- A student who took the most recent test earns the **test rate** until the next test date. On test night, test takers are paid without clocking in.
- Nights before Yom Tov are suggested off automatically; the principal can override any night.

The rules live in `src/lib/rules.ts` and are tested in `src/lib/rules.test.ts`.

## Developing

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm test                     # rule tests
npm run build
```
