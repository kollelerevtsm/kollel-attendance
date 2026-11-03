# כולל ערב תורתך שעשועי – Attendance & Payroll

Nightly attendance from the Anviz W1 Pro fingerprint scanner, pay calculation, principal approval and payroll.

**Stack:** Next.js (on Vercel) · Supabase (database + logins) · CrossChex Cloud (scanner data, from Phase 3)

## Status

| Phase | What | Status |
| --- | --- | --- |
| 1 | Database, logins and roles, Settings, Students and PINs | Done |
| 2 | Calendar with Hebrew dates, holidays, nights on/off, learning sessions, test dates | Done |
| 3 | Attendance rules, fixing punches, scans entered by hand | Done |
| 3b | CrossChex webhook + nightly backup sync | Waiting for scanner and Developer Mode |
| 4 | Test sheet, weekly approval, payroll list, check numbers, print, Excel export | Done |
| 5 | Student portal: attendance with reasons, payments | Done |

## One-time setup

### 1. Supabase database

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste all of `supabase/migrations/0001_initial.sql` and click **Run**. Then do the same, in order, with `0002_attendance_payroll.sql`, `0003_torahscha_sync.sql`, `0004_special_days.sql`, `0005_holidays_daf.sql` and `0006_two_step.sql`.
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
| `SMTP_USER` | The Gmail address that sends sign-in codes |
| `SMTP_PASS` | That Gmail account's 16-letter app password |

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
