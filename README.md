# Aqlyon ERP

Internal agency management system for **Aqlyon Brand Management, Koyilandy** — built for a digital marketing, social media and graphic design agency.

**Setup: see [SETUP.md](SETUP.md).**

## Modules

- **Dashboard** — role-specific: admin overview (MRR, collections, outstanding, pipeline, designer workload), marketer to-dos, designer work queue, finance cash position.
- **CRM** — lead pipeline (drag-and-drop board), conversation log (calls, WhatsApp, meetings, visits) with follow-up dates, one-click lead → client conversion, client profiles with brand kit, retainer packages and renewals, follow-up inbox.
- **Campaigns & projects** — ad campaigns, shoots and branding projects with budget, ad spend, reach, leads and cost-per-lead.
- **Design tasks** — briefs with copy/size/references, designer workload when assigning, Kanban board, proof versions (file upload or Drive/Canva link), internal review, revision tracking against scope, task discussion, time logging, final-file links.
- **Content calendar** — monthly calendar per client, drag to reschedule, captions/hashtags/pillars, deliverables vs package targets, create design task from a post, post performance.
- **Client approval portal** — tokenised link the client opens on their phone (no login) to approve or request changes on posts and designs.
- **Team queries** — tracked questions between people or whole teams, with replies and resolution.
- **Timesheet** — weekly time per person, billable vs internal, utilisation.
- **Finance** — quotations (convert to invoice), invoices with automatic numbering, retainer invoice generation, WhatsApp sharing, printable/PDF invoices with amount in words, payments (part-payments), expenses with receipts and recurring copy-forward.
- **Reports** — profit & loss, receivables aging, client profitability (revenue vs labour cost), sales funnel & lead sources, team productivity (on-time %, first-pass approval, utilisation), content delivery vs commitment.
- **Admin** — team logins and roles, company/bank/UPI details, numbering prefixes, service price list.

Stack: React 18 + Vite · Supabase (Postgres + RLS, Auth, Storage, Realtime) · Netlify (hosting + 2 serverless functions).
