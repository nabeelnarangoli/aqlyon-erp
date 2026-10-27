# Aqlyon ERP — Setup guide

Internal ERP for **Aqlyon Brand Management, Koyilandy**: CRM, design production, content calendar, client approvals, finance and reports.

Stack: React (Vite) on **Netlify** · **Supabase** (Postgres database, logins, file storage, live updates).
Everything below fits in the free tiers of both.

---

## 1. Create the Supabase project (≈10 min)

1. Go to <https://supabase.com> → **New project**.
   - Name: `aqlyon-erp` · Region: **South Asia (Mumbai)** · set a strong database password and save it.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, click **Run**.
   It creates every table, the permission rules for each role, invoice numbering, storage buckets and the starter price list. It is safe to run again after updates.
3. **Authentication → Sign In / Providers → Email**: turn **OFF "Allow new users to sign up"**.
   Only the admin creates logins (from the ERP's Team & Access page).
4. **Authentication → URL Configuration**: set *Site URL* to your Netlify address (step 3), e.g. `https://erp.aqlyondm.com`.
5. **Create your own admin login**: **Authentication → Users → Add user → Create new user**, enter your email + password, tick *Auto Confirm User*.
   The first account ever created automatically becomes **Admin**.
6. **Project Settings → API**: copy
   - `Project URL`
   - `anon public` key
   - `service_role` key (secret — only goes into Netlify, never into code)

## 2. Push the code to GitHub

The project is already a git repository with `main` and `staging` branches.

```bash
# create an empty private repo named aqlyon-erp on github.com first, then:
git remote add origin https://github.com/nabeelnarangoli/aqlyon-erp.git
git push -u origin main staging
```

## 3. Deploy on Netlify

1. **Add new site → Import an existing project → GitHub → aqlyon-erp**.
   Build settings are read from `netlify.toml` (build `npm run build`, publish `dist`).
2. **Site configuration → Environment variables** — add all four:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

3. **Deploys → Trigger deploy**.
4. Staging-first workflow: in **Site configuration → Build & deploy → Branches**, set production branch = `main` and enable **branch deploys** for `staging`.
   Every change goes to `staging` first (preview URL `staging--<site>.netlify.app`); merge to `main` only after you've checked it.
5. Optional custom domain: **Domain management → Add domain** → e.g. `erp.aqlyondm.com`.

## 4. First login checklist

1. Sign in with the admin account from step 1.5.
2. **Settings → Company & invoices**: confirm address, phone, add bank details + UPI ID (printed on invoices).
3. **Settings → Services & pricing**: adjust the starter price list.
4. **Team & Access → Roles & permissions**: review the starting roles or build your own.
   Then **Users → Add user** for each person: name, email, temporary password, role, monthly salary, working days and hours.
5. Add clients (or convert won leads), then add each client's **retainer package** (fee + posts/reels/stories per month).

---

## Roles, permissions and staff

**Team & Access → Roles & permissions**: create any role (e.g. *Social Media Executive*, *Video Editor*, *Accounts Assistant*) and tick exactly what it can see and do — leads, clients, packages, design tasks, proof approval, calendar, quotations, invoices, payments, expenses, suppliers, each report, user management and settings. Four starting roles are provided (Administrator, Digital Marketer, Graphic Designer, Finance) and can be edited or duplicated; Administrator always keeps full access.

**Team & Access → Users**: create a login, pick its role, and record **monthly salary**, **working days** and **working hours**. Cost per hour is calculated automatically (salary ÷ monthly working hours) and feeds client profitability. Salaries are visible only to people who can manage users.

Permissions are enforced inside the database (row-level security), so hiding a menu is never the only protection.

## How the design workflow runs

```
Marketer creates task (brief, copy, size, due, designer)  ──►  Designer notified
Designer: Start work → uploads proof v1 (file or Drive/Canva link)  ──►  Internal review
Marketer: Approve ──► Client review          or   Request changes ──► Revision (count +1)
Client approves on the approval link (no login, works on phone)  ──►  Approved
Marketer: Mark delivered
```
- Every status change, comment and client decision is logged on the task and notifies the right person.
- Revisions beyond the number included (default 3, set per task) are flagged so you can bill them.
- Team queries keep questions between marketing, design and finance tracked until resolved.

## Monthly finance routine

1. **Invoices → Generate retainer invoices** (creates one draft per active package for the month; never duplicates).
2. Review drafts → **WhatsApp** or **Print / PDF** → marked *Sent*.
3. **Record payment** as money arrives (UPI/bank/cash; part-payments supported).
4. **Expenses → Copy recurring** to bring rent, salaries and subscriptions forward, then add the rest.
5. **Reports → Profit & Loss / Receivables / Client profitability**.

## Outsourced work (suppliers)

1. **Supplier work orders → New work order**: pick the supplier (freelancer, printer, videographer…), what you’re paying for, and **which customer(s)** it’s for — optionally against a specific invoice. One order can be split across several customers.
2. **Pay supplier** on the work order for each advance / part / final payment (Finance or Admin).
3. Mark **Work received** when the supplier delivers.
4. Every invoice shows a **Money flow for this job** card: billed, received, supplier cost (paid / still to pay) and your margin, with a dated in/out timeline.
5. **Payments & cash flow** lists all money in and out with a running balance; P&L and client profitability include supplier costs.

## Expenses & payees

Every expense is paid to a payee chosen from **Suppliers & payees** (press **+** to add a new one — landlord, KSEB, Adobe, staff…). Click any payee name — in Expenses, Payments & cash flow, or Reports → Spend by payee — to open their **account statement**: every expense, work order and payment with an opening balance, running balance owed and CSV export.

## Paid by a founder / staff, repaid later

When someone pays a company cost from their own account (e.g. the Adobe subscription on the founder's card):

1. **Expenses → Add expense**, and under **Paid from** choose that person instead of *Company account*.
   It counts as a company expense right away (P&L, payee statement) and shows **Payable to <name>**.
2. When the company pays them back: **Expenses → Payable to founder / staff → Repay**, tick the expenses being repaid, enter date / method / reference.
   The expenses turn **Paid by <name> · repaid**, and the repayment appears in **Payments & cash flow** as money out on that date.
3. Made a mistake? Open **Repayments** and undo it; the expenses become payable again.

Company cash only moves when the repayment is made, so the cash-flow figures stay true to the bank account.

## Walk-in sales (every team member)

**Walk-in sale** (top of the menu, for everyone):
1. Type the customer's mobile number. If they have bought from you before, they appear: tap to reuse their details. Otherwise enter a name and they are saved as a *Walk-in* customer.
2. Add items (the price list suggests names and rates), any discount, and the amount received with method (Cash / UPI / Card…).
3. **Create invoice & collect** makes the invoice, records the payment against the person who collected it, and opens the receipt for Print or WhatsApp.
4. A part-paid walk-in invoice can be settled later with **Collect balance**.

Each person sees their own walk-in sales and "You collected today" (by method) for cash handover. Finance sees everything under **Payments → Received from customers**, with a **Received by** column and filter. Walk-in customers are listed under **Clients** (filter *Walk-in customers*).

## Client social reports (replaces the content & KPI sheets)

**Insights → Client social reports** shows every client for a month: posters / stories / reels / banners delivered against the package, work still in progress or waiting on the client, and reach, post views, new followers and interactions with the change from last month.

Open a client for the monthly report (Print / PDF to send them):
- **Content log by week** — straight from the Content Calendar (date, platform, type, topic, assigned, status, internal ✓, client ✓, post link). Plan posts in the calendar as before; set *Assigned to*, and under *Post links & performance* add one row per platform it went out on (platform → link → reach, views, likes, comments, shares, saves). These rows make the report's *Post performance* table: per-post numbers, platform totals and the best post.
- **Account performance** — one small grid per platform: type the week's numbers from Instagram / Meta insights (1.2k and 45% work). Charts and month totals update on save.

Weeks follow the sheet: Week 1 = 1st–7th, Week 2 = 8th–14th, Week 3 = 15th–21st, Week 4 = 22nd–28th, Week 5 = 29th–end.

## Approvals, mentions and pop-up notifications

- **Approvals** (top of the menu, with a count) lists everything waiting for *you*: design proofs to approve (with the proof preview — Approve / Request changes right there), posts to approve (Approve → client, Approve final, Send back), revisions requested from you, queries for you, and what's waiting on clients. The dashboard shows a yellow "Waiting for you" bar when anything is pending.
- Approval requests go to **everyone who can approve** (proofs: anyone with *Approve proofs*; posts: anyone with *Manage calendar*), not only the task creator. When one person decides, the request disappears for the others.
- **@mentions**: in task chat, query replies and new queries, type `@` and pick a name. That person gets a mention notification.
- **Pop-ups**: unread notifications appear as cards at the bottom-right (approvals first) and stay until you press **Mark read** or open them.

## Updating the database later

When a new version of `supabase/schema.sql` ships, run it again in the SQL Editor — it only adds or replaces what changed and keeps your data.

## Local development

```bash
cp .env.example .env.local   # fill in the two VITE_ values
npm install
npm run dev
```

Database tests (needs a local Postgres 16): `supabase/tests/stub_supabase.sql` then `schema.sql` then `workflow_test.sql`.
