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
4. **Team & Access → Add team member** for each person: name, email, temporary password, role, designation,
   internal cost/hour (salary ÷ monthly hours — used for client profitability) and weekly hours.
5. Add clients (or convert won leads), then add each client's **retainer package** (fee + posts/reels/stories per month).

---

## Roles

| Area | Admin | Digital Marketer | Graphic Designer | Finance |
|---|---|---|---|---|
| Leads, follow-ups | ✓ | ✓ | — | — |
| Clients | Full | Full | View (brand kit) | View |
| Packages / retainers | Full | Full | — | View |
| Design tasks | Full | Create, review, approve | Work, upload proofs, log time | — |
| Content calendar | Full | Full | View | — |
| Quotations | Full | Full | — | Full |
| Invoices | Full | View | — | Full |
| Payments & expenses | Full | — | — | Full |
| Suppliers & work orders | Full | Create, assign to customers | — | Full + pay suppliers |
| Team queries | All | Own + team inbox | Own + team inbox | Own + team inbox |
| Reports | All | Sales, team, content, clients | Own productivity | P&L, receivables, clients |
| Team & settings | ✓ | — | — | — |

Permissions are enforced **inside the database** (Postgres row-level security), so a user can't see or change data outside their role even by calling the API directly.

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

## Updating the database later

When a new version of `supabase/schema.sql` ships, run it again in the SQL Editor — it only adds or replaces what changed and keeps your data.

## Local development

```bash
cp .env.example .env.local   # fill in the two VITE_ values
npm install
npm run dev
```

Database tests (needs a local Postgres 16): `supabase/tests/stub_supabase.sql` then `schema.sql` then `workflow_test.sql`.
