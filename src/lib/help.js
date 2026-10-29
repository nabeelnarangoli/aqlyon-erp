// Aqlyon ERP — in-app help centre content.
//
// How an article is written (rendered by pages/Help.jsx):
//   ## Heading           ### Sub-heading
//   - bullet             1. numbered step
//   > Tip text           (green tip box)
//   >! Warning text      (amber "watch out" box)
//   **bold**   `Button or menu name`   [[article-id]] or [[article-id|link text]]
//   blank line = new paragraph
//
// perm:   the article is shown to people who have ANY of these permissions (empty = everyone)
// routes: page paths the article belongs to — the Help button opens these first on that page

export const HELP_CATEGORIES = [
  { id: 'start', label: 'Getting started', icon: 'Rocket' },
  { id: 'daily', label: 'Dashboard, approvals & alerts', icon: 'BadgeCheck' },
  { id: 'crm', label: 'Leads & clients', icon: 'Target' },
  { id: 'production', label: 'Design & content', icon: 'Palette' },
  { id: 'sales', label: 'Selling & billing', icon: 'FileText' },
  { id: 'money', label: 'Payments, expenses & suppliers', icon: 'Wallet' },
  { id: 'reports', label: 'Reports', icon: 'BarChart3' },
  { id: 'admin', label: 'Team & settings', icon: 'Settings' },
  { id: 'faq', label: 'FAQ & troubleshooting', icon: 'LifeBuoy' }
]

const FIN = ['money.view']

export const HELP_ARTICLES = [
  /* ============================ GETTING STARTED ============================ */
  {
    id: 'welcome', cat: 'start', title: 'Welcome — how Aqlyon ERP fits together',
    summary: 'The big picture: how a lead becomes a client, work gets delivered and money comes in.',
    routes: ['/'],
    body: `
Aqlyon ERP is one place for the whole agency: **sales**, **design and content production**, **billing** and **reports**. Everyone works in the same system, so nobody has to ask "what's the status?" on WhatsApp.

## The journey of a client
1. **Lead** — a business shows interest. It is added in \`Leads & Pipeline\` and moved through the stages: New → Contacted → Meeting → Proposal → Negotiation → Won / Lost. See [[leads]].
2. **Quotation** — you send a price or a full commercial proposal from \`Quotations\`. See [[quotations]].
3. **Client** — when the lead says yes, press \`Convert to client\`. Their whole conversation history moves with them. See [[convert-lead]].
4. **Package** — add the monthly retainer on the client's \`Packages\` tab: fee, posts, reels and stories per month. See [[packages]]. Clients who pay per job instead don't need a package: log each job in [[on-demand-jobs|On-demand jobs]] and bill at month end.
5. **Work** — posts are planned in the \`Content Calendar\` and designs are made in \`Design Tasks\`. Every design goes through internal review, then client approval. See [[task-lifecycle]] and [[calendar]].
6. **Invoice** — each month, \`Generate retainer invoices\` creates the invoices from the packages. See [[retainer-invoices]].
7. **Payment** — record the money when it arrives. The invoice updates to Partly paid or Paid. See [[record-payment]].
8. **Reports** — the client gets a monthly social report, and the founders see profit, receivables and team productivity. See [[social-reports]] and [[business-reports]].

## What you see depends on your role
The menu on the left only shows the areas your role allows. A designer sees design tasks and the calendar; finance sees invoices and payments. Money amounts are only shown to people allowed to see them. See [[roles-visibility]].

> Not sure where something is? Press the \`?\` help button at the top of any page — it opens the guide for that page.`
  },
  {
    id: 'sign-in', cat: 'start', title: 'Signing in, “Remember me” and passwords',
    summary: 'How to log in, stay logged in on your own device and what to do if you forget your password.',
    body: `
## Signing in
1. Open the ERP link your admin gave you.
2. Enter your **login email** and **password**, then press \`Sign in\`.

## Remember me
- **Ticked** (the default) — you stay signed in on this device, even after closing the browser.
- **Unticked** — you are signed out when the browser is closed. Use this on shared or public computers.

## Forgot your password?
There is no self-service reset for security reasons. Ask an admin to open \`Team & Access\` → your name → \`Reset password\`. They will give you a new temporary password. See [[team-users]].

## "Account disabled"
If you see this, an admin has switched your access off (the **Active** tick on your user). Contact the admin.

>! Never share your password with anyone, including clients. Each person must have their own login so the system knows who did what.`
  },
  {
    id: 'navigation', cat: 'start', title: 'Finding your way: menu, search, filters and dates',
    summary: 'The sidebar, the global search box, searchable dropdowns and the date period picker.',
    body: `
## The sidebar
The left menu is grouped into **CRM**, **Production**, **Finance**, **Insights** and **Admin**. Green number bubbles show how many things are waiting for you (for example, tasks to review or follow-ups due today). On a phone, tap the ☰ button at the top left to open the menu.

## Global search
The search box at the top of every page finds **clients, design tasks, leads and invoices**. Type at least two letters — a client name, a task code like \`AQB-T-0042\`, a phone number or an invoice number — and click a result to open it.

## Searchable dropdowns
Every dropdown (client, team member, supplier, category…) has a search box. Click it and start typing to filter long lists. Where you see \`+ New customer\` or \`+\` next to a list, you can create the missing item without leaving the form.

## Picking a period
Lists such as invoices, expenses, payments and reports have a period button (it shows, for example, "This month"). Click it to choose:
- **Quick periods** — Today, Yesterday, This week, Last week, Last 7 / 30 days, This month, Last month, Last 3 / 6 months, This quarter, This / Last financial year (April–March), This / Last year, All time.
- **Custom period** — pick any From and To date on the right and press \`Apply\`.

## Exporting
Most lists have an \`Export\` or \`CSV\` button. It downloads exactly what you are looking at (with your filters) as a spreadsheet file that opens in Excel or Google Sheets.

## Print and PDF
Invoices, quotations, work orders and client social reports have \`Print\` and \`Download PDF\` buttons. The small printer and download icons in the lists do the same without opening the document.`
  },
  {
    id: 'roles-visibility', cat: 'start', title: 'Roles: who can see and do what',
    summary: 'Why your menu looks different from a colleague’s, and why some amounts show as “—”.',
    body: `
Every user has one **role**. A role is a set of **permissions** that decides which menus they see and what they can change. Admins build roles in \`Team & Access\` → \`Roles & permissions\` (see [[roles]]).

## The starting roles
- **Administrator** — everything.
- **Digital Marketer** — leads, clients, packages, campaigns, design tasks (create, assign, review), content calendar, timesheets and the sales / team / content reports.
- **Graphic Designer** — works on design tasks, uploads proofs, sees clients' brand kits and the calendar.
- **Finance** — quotations, invoices, payments, expenses, suppliers and the finance reports.

## Money is private
Prices, fees, totals and balances are only visible to roles with **See prices & money**. By default that is **Administrator** and **Finance** only. Everyone else sees **—** where an amount would be.

The exceptions: anyone making a [[walk-in|walk-in sale]] sees the amount of that sale and what **they** collected, so they can hand over the right change and receipt. Amounts on [[on-demand-jobs|On-demand jobs]] are visible to everyone, because the person who does the job enters its price.

## Everyone can always
- see their own dashboard,
- use \`Approvals\`, \`Team Queries\`, \`Walk-in sale\` and \`On-demand jobs\`,
- log their own time in the \`Timesheet\` (if they work on tasks),
- open this help centre.

> If you need access to something you can't see, ask an admin to add the permission to your role — not to give you someone else's login.`
  },

  /* ===================== DASHBOARD, APPROVALS & ALERTS ===================== */
  {
    id: 'dashboard', main: true, cat: 'daily', title: 'Your dashboard',
    summary: 'What each dashboard card means for your role.',
    routes: ['/'],
    body: `
The dashboard is different for each role — it shows what **you** need to act on today.

## Designers see
- **My work queue** — tasks assigned to you that are To do or In progress.
- **Revisions to fix** — designs the reviewer or client sent back.
- **Unassigned — pick one up** — open tasks with no designer. Open one and press \`Pick up this task\`.
- **Time logged this week**.

## Marketers see
- **Proofs waiting for your review**, **Follow-ups due**, **My open leads**, **Pipeline** and **Publishing in the next 7 days**.

## Admin and finance see
- **Monthly recurring revenue** — total of active retainer packages.
- **Collected this month** and **Paid out this month**.
- **Outstanding from customers** and **Overdue invoices** — only invoices that have been **sent** (drafts are not counted).
- **Payable to suppliers** — work orders not yet fully paid.
- **Revenue vs expenses (6 months)** chart.
- **Designer workload** — open tasks per designer, so you can balance work.

Most cards are clickable and open the matching list already filtered.`
  },
  {
    id: 'approvals', main: true, cat: 'daily', title: 'Approvals inbox',
    summary: 'One page with every proof, post, revision and question waiting for you.',
    routes: ['/approvals'],
    body: `
\`Approvals\` collects everything that is waiting for **you**. The red number next to it in the menu is how many items need action.

## Sections
- **Design proofs to approve** — for reviewers. You see the latest version, who made it and their note.
  - \`Approve\` — the task moves to **Client review**.
  - \`Approve with note\` — same, with a message to the designer.
  - \`Request changes\` — write what must change (numbered points work best). The task goes to **Revision** and the designer is told.
- **Posts to approve** — posts in Internal review on the content calendar.
  - \`Approve → client\` — sends it to the client for approval (it appears on their approval link).
  - \`Approve (final)\` — approves it without asking the client.
  - \`Send back\` — returns it to Copywriting.
- **Changes requested on your designs** — for designers: your tasks in Revision.
- **Queries waiting for your answer** — team queries sent to you or your team.
- **Waiting on clients** — items already sent to the client. Follow up if they've been waiting a long time.

Once one approver decides, the item disappears from everyone else's inbox, so two people never approve the same thing.

See also [[task-lifecycle]] and [[post-workflow]].`
  },
  {
    id: 'notifications', cat: 'daily', title: 'Notifications, pop-ups and @mentions',
    summary: 'How you are alerted about approvals and mentions, and how to clear them.',
    body: `
## The bell
The 🔔 at the top right lists your latest notifications. Unread ones are highlighted. Click one to open the task, post or query it is about — it is marked as read. \`Mark all read\` clears the list.

## Pop-up cards
Important notifications — **approval requests** and **mentions** — also appear as pop-up cards at the bottom right of the screen. They stay there on every page **until you press \`Mark read\` or open them**, so nothing is missed. If there are many, you'll see "+ N more unread" with a \`Mark all read\` link.

## @mentions
In a task discussion or a team query, type **@** and choose a colleague from the list. They get a notification and a pop-up with your message.

> Use @mentions instead of WhatsApp for work questions — the conversation stays on the task, where everyone can see it later.`
  },

  /* ============================ LEADS & CLIENTS ============================ */
  {
    id: 'leads', main: true, cat: 'crm', title: 'Leads & pipeline',
    summary: 'Add enquiries, track them through the sales stages and never lose a follow-up.',
    perm: ['leads.view', 'leads.manage'], routes: ['/leads'],
    body: `
A **lead** is any person or business that might buy from us — an Instagram enquiry, a referral, a walk-in.

## Adding a lead
1. Press \`New lead\`.
2. Fill in the **contact name**, **business / brand**, **phone** (and WhatsApp if different), **city**, **industry** and **lead source** (Instagram, Referral, Walk-in…).
3. Tick the services they are **interested in**, and enter an **estimated monthly / deal value** if you know it.
4. Set the **temperature** — 🔥 Hot, ☀️ Warm or ❄️ Cold — and a **next follow-up** date.
5. Write requirements, budget, decision-maker and competitors in the notes.

## The pipeline
Stages: **New → Contacted → Meeting → Proposal → Negotiation → Won / Lost**.
- **Board view** — drag a card to the next column as the deal moves forward.
- **List view** — a sortable table; switch with the Board / List buttons.
- Filter by owner and source, or search by name, company or phone.

When a lead is **Lost**, choose a lost reason — the Sales report shows why we lose deals.

## From a lead you can
- Log every call, WhatsApp chat and meeting — see [[conversations]].
- Press \`Quotation\` to prepare a quotation for this prospect — see [[quotations]].
- Press \`Convert to client\` when they say yes — see [[convert-lead]].`
  },
  {
    id: 'conversations', cat: 'crm', title: 'Logging conversations',
    summary: 'Record calls, chats and meetings with leads and clients so the whole team has the context.',
    perm: ['leads.manage', 'clients.manage'], routes: ['/leads', '/clients/'],
    body: `
Every lead and client has a **Conversation log**. It is the shared memory of the relationship — anyone picking up the account can read what was promised.

## Log an interaction
1. Open the lead, or the client's \`Conversations\` tab.
2. Press \`Log interaction\` and choose the type: Phone call, WhatsApp, Meeting, Site visit, Video call, Email or Note.
3. Write **what was discussed** — requirements, feedback, objections, budget.
4. Write the **outcome** (e.g. "Interested, asked for quote").
5. Add a **next action** and a **follow-up date** if something must happen next.

Interactions with a follow-up date appear in [[followups|Follow-ups]] on that day, and are counted in the menu bubble.

> Log it the same day. A two-line note now saves a confused client call next month.`
  },
  {
    id: 'convert-lead', cat: 'crm', title: 'Converting a lead into a client',
    summary: 'What happens when a lead is won and becomes a client.',
    perm: ['leads.manage'], routes: ['/leads'],
    body: `
1. Open the lead and press \`Convert to client\`, then confirm.
2. A new client is created with the lead's name, contact details and industry. The **conversation log moves with them**.
3. The lead is marked **Won** with a **Converted** badge, and an \`Open client\` button takes you to the new client.

The new client starts with the status **Onboarding**. Next steps:
- complete the [[clients|brand kit]] (colours, fonts, logo folder, tone of voice),
- add their [[packages|package]],
- set their status to **Active** when work starts.`
  },
  {
    id: 'clients', main: true, cat: 'crm', title: 'Clients, the client page and the brand kit',
    summary: 'Adding clients, statuses, salesman, and everything on a client’s page.',
    perm: ['clients.view', 'clients.manage'], routes: ['/clients'],
    body: `
## Adding a client
Convert a won lead ([[convert-lead]]) or press \`New client\` and fill in:
- **Brand / business name**, **contact person**, **phone**, **WhatsApp**, **email**, **address**, **industry**.
- **Status** — Onboarding, Active, Paused or Churned. The list shows Onboarding and Active clients by default; use the status filter to see the others.
- **Account manager** — the team member responsible for them.
- **Salesman / brought by** — who brought this client. Pick a team member, or type the name of an outside agent. This shows in reports so you know where business comes from.
- **Online presence** — Instagram, Facebook, website, YouTube, LinkedIn and other links.

## The brand kit
**Designers see the brand kit on every task**, so fill it in well:
- brand colours (e.g. \`#1BA76A, #1E0203\`), brand fonts, tone of voice,
- a link to the **logo & assets folder** (Google Drive),
- the target audience.

## The client page
Click a client to open their page. The tabs you see depend on your role:
- **Overview** — open design tasks, posts planned this month, monthly retainer, outstanding balance, deliverables this month vs package, brand kit, contacts and upcoming deliveries.
- **Conversations** — the [[conversations|conversation log]].
- **Design tasks** and **Campaigns**.
- **Packages** — their retainer(s). See [[packages]].
- **Invoices & money flow** — every invoice, payment and supplier cost for this client.
- **Client approval links** — see [[client-portal]].

## Walk-in customers
Customers created from a [[walk-in|walk-in sale]] are clients too (customer type "walk-in"). Use the customer type filter on the Clients list to see or hide them.`
  },
  {
    id: 'packages', cat: 'crm', title: 'Packages (retainers)',
    summary: 'Set up a client’s monthly retainer — it drives invoices and content targets.',
    perm: ['packages.view', 'packages.manage'], routes: ['/clients/'],
    body: `
A **package** is what the client pays for regularly, and what we promise to deliver. It powers three things:
- **monthly invoices** — see [[retainer-invoices]],
- **deliverable targets** on the content calendar and in [[social-reports|client social reports]],
- **monthly recurring revenue** on the dashboard.

## Adding a package
1. Open the client → \`Packages\` tab → \`Add package\`.
2. Enter the **package name** (e.g. "Social Media Growth"), **fee**, and **billing** — Monthly, Quarterly, Yearly or One time.
3. **Invoice day of month** — the date the retainer invoice is dated each period.
4. **Start date** and optional **end date** (leave empty for ongoing) and a **renewal date** (it appears in Follow-ups 45 days before).
5. Deliverables: **posts**, **carousels**, **reels** and **stories per month**, and the **ad budget per month** if we run ads.
6. **Platforms** and **scope / inclusions** (community management, monthly report, one shoot a month…).
7. Press \`Save package\`.

Set the status to **Paused** or **Ended** when the client stops — paused and ended packages are not invoiced.

>! One-time packages are never invoiced automatically. Create their invoice yourself with \`New invoice\` → \`Customer packages\`.`
  },
  {
    id: 'followups', main: true, cat: 'crm', title: 'Follow-ups and renewals',
    summary: 'Every call-back and check-in that is due, and packages coming up for renewal.',
    perm: ['leads.manage', 'clients.manage'], routes: ['/followups'],
    body: `
\`Follow-ups\` lists every promised call-back, quotation and check-in, so no lead or client goes cold.

## Tabs
- **Due today or overdue** — act on these first. The number in the menu bubble counts them.
- **Upcoming** — the next ones.
- **Renewals in 45 days** — client packages whose renewal date is coming up. Call them before the package ends.

Use the person filter to see **Everyone** or one team member's list. Each row has a WhatsApp button to message the person directly.

## Closing a follow-up
Follow-ups come from the **next action** and **follow-up date** on a logged interaction (see [[conversations]]). When you've done it, press \`Done\` on the row. Then log what happened on the lead or client — with a new follow-up date if another step is needed.`
  },
  {
    id: 'projects', main: true, cat: 'crm', title: 'Campaigns & projects',
    summary: 'Track ad campaigns, launches, shoots and branding projects with budgets and results.',
    perm: ['projects.view', 'projects.manage'], routes: ['/projects'],
    body: `
Use campaigns for work that has its own goal and budget, outside the normal monthly posts — for example "Onam Sale – Meta Ads", a website, a product launch or a photo shoot.

## Creating a campaign
1. Press \`New campaign\` and pick the **client**, **type** (Campaign, Ads (Meta), Ads (Google), Branding, Website, Video shoot…) and **platform**.
2. Write the **objective** — leads, awareness, store visits, sales.
3. Enter the **agency fee** and the **ad spend**, plus start and end dates.
4. Set the status: Planning → Active → Completed (or On hold / Cancelled).

## Recording results
When the campaign runs, add **impressions**, **clicks**, **leads generated** and **conversions / sales**, and write what worked in **results notes**. People who can see money also see the **cost per lead** (ad spend ÷ leads).

Design tasks can be linked to a campaign when they are created, so you can see all creatives for it in one place.`
  },
  {
    id: 'client-portal', cat: 'crm', title: 'Client approval links (no-login client portal)',
    summary: 'Send clients one link where they approve posts and designs without logging in.',
    perm: ['calendar.manage', 'clients.manage'], routes: ['/clients/'],
    body: `
Clients don't need an account. Each client gets a private **approval link**. When they open it they see everything waiting for their decision.

## Creating and sending the link
1. Open the client → \`Client approval links\` tab.
2. Press \`Create new link\`. The link is copied to your clipboard. It is valid for **60 days**.
3. Press \`Send\` to open WhatsApp with a ready message, or \`Copy\` to paste it anywhere.

## What the client sees
- **Posts** you sent with \`Approve → client\` (status *Client approval*), with caption and creative.
- **Designs** in *Client review*, with the latest proof.
- For each one: \`Approve\`, or \`Request changes\` with a note.

Their decision and note show on the post or task, and the item leaves the **Waiting on clients** list in [[approvals]]. The page also shows the approval window from Settings (e.g. "please reply within 24 hours").

## Security
- Anyone with the link can see that client's pending items — only send it to the client.
- Press \`Revoke\` to switch a link off immediately (for example if it was sent to the wrong person). Create a new one when needed.`
  },

  /* =========================== DESIGN & CONTENT =========================== */
  {
    id: 'task-lifecycle', main: true, cat: 'production', title: 'How a design task moves: the statuses',
    summary: 'To do → In progress → Internal review → Client review → Approved → Delivered.',
    perm: ['tasks.view', 'tasks.work', 'tasks.manage', 'tasks.review'], routes: ['/tasks'],
    body: `
Every design task follows the same path, so everyone knows exactly where it is.

1. **To do** — created and waiting. It may be assigned to a designer, or **Unassigned** so any designer can pick it up.
2. **In progress** — the designer is working on it.
3. **Internal review** — the designer uploaded a proof. A reviewer checks it ([[review-proofs]]).
4. **Client review** — the team approved it and it's waiting for the client (on their [[client-portal|approval link]], or you send it yourself).
5. **Revision** — changes were requested, by the reviewer or the client. Back to the designer.
6. **Approved** — the client approved it.
7. **Delivered** — final files handed over.
8. **Cancelled** — no longer needed (can be reopened).

## What moves it automatically
- Uploading a proof → **Internal review**.
- Reviewer approves → **Client review**; requests changes → **Revision**.
- Client approves on their link → **Approved**; requests changes → **Revision**.

## Board and list
The \`Design Tasks\` page shows a **board** with a column per status (drag cards between columns) or a **list**. Designers can only move tasks between To do, In progress and Internal review — the later steps need a reviewer or manager. Filter by client, designer and type; the list view hides delivered tasks unless you tick \`Show delivered\`.

Each card shows priority (colour), due date, revision count and number of proofs. Overdue tasks are marked in red.`
  },
  {
    id: 'create-task', cat: 'production', title: 'Creating a design task with a good brief',
    summary: 'What to fill in so the designer gets it right the first time.',
    perm: ['tasks.manage'], routes: ['/tasks'],
    body: `
Press \`New task\` on Design Tasks (or \`Create design task\` from a calendar post — see [[calendar]]).

## The form
- **Client** and **task title** (e.g. "Onam offer post – 20% off").
- **Type** (Social Post, Carousel, Reel, Logo, Flyer…), **platform**, **size / format** (1080×1350 portrait, Story 1080×1920, A4…) and **quantity**.
- **Priority** — Low, Normal, High, Urgent — and **due date**.
- **Assign designer** — the number next to each name is how many open tasks they already have. Leave it **Unassigned** to let designers pick it up.
- **Campaign** — link it if it belongs to one.
- **Estimated hours** and **revisions included** (default from Settings — the proposal promises 2 per creative).
- **Billable client work** — untick for internal work (our own marketing).

## Writing the brief
A clear brief saves revision rounds:
- **Creative brief** — goal, key message, mood, must-include elements, things to avoid.
- **Text / copy on the design** — the exact headline, offer, phone number, address, hashtags. The designer copies it as-is, so check spelling here.
- **References & links** — Pinterest / Instagram references, the Drive folder with product photos.

> The client's brand kit (colours, fonts, logo folder) is shown on the task automatically — you don't need to repeat it.`
  },
  {
    id: 'designer-work', cat: 'production', title: 'For designers: picking up, working and uploading proofs',
    summary: 'Your day-to-day: claim a task, upload versions, log time and ask questions.',
    perm: ['tasks.work'], routes: ['/tasks'],
    body: `
## 1. Get a task
- Tasks assigned to you are in **My work queue** on the dashboard and on the Design Tasks board.
- Unassigned tasks: open one and press \`Pick up this task\` — it becomes yours and moves to **In progress**.
- For an assigned task, press \`Start work\` when you begin.

## 2. Read everything on the task
The task page shows the **brief**, the **copy text** (use it exactly), **references**, size and the client's **brand kit** with the logo folder link. Unclear? Use the discussion or \`Raise query\` — see [[queries]].

## 3. Upload a proof
In **Proofs & versions**:
1. Choose the file (JPG, PNG, PDF, MP4 — up to 50 MB), **or** paste a Drive / Canva / Figma link.
2. Add a **note for the reviewer** — what changed in this version.
3. Upload. The task moves to **Internal review** and the reviewers are notified.

Each upload becomes a new version (v1, v2, v3…), so the history is kept.

### Image optimisation
Images are converted to high-quality WebP at **full resolution** before upload, which saves a lot of storage without visible quality loss. You'll see the size saving before uploading. For print files where the exact original is needed, tick \`Keep original file (print-ready)\`.

## 4. Revisions
If the reviewer or client asks for changes, the task moves to **Revision** and appears in **Revisions to fix**. Read the comments, make the changes and upload the next version.

## 5. Final files
When approved, add the link to the source + final files (Drive) in **Final files** on the task.

## Log your time
Use the time box on the task, or the [[timesheet]], to log the hours you spent.`
  },
  {
    id: 'review-proofs', cat: 'production', title: 'Reviewing proofs and delivering to the client',
    summary: 'Approve or request changes, record the client’s decision and mark delivered.',
    perm: ['tasks.review', 'tasks.manage'], routes: ['/tasks', '/approvals'],
    body: `
## Reviewing inside the team
Proofs waiting for you are in [[approvals|Approvals]] and on the task page. Click the thumbnail to see the full design.
- \`Approve\` → the task moves to **Client review**.
- \`Request changes\` → write numbered, specific points ("1. Make the headline bigger 2. Use the client's green"). The task goes to **Revision**.

Check the brief, the copy (spelling, phone number, prices), the size and the brand colours before approving.

## Getting the client's decision
- **Through the approval link** — the client approves or requests changes themselves. See [[client-portal]].
- **Client replied on WhatsApp or by phone** — on the task press \`Client approved\` or \`Client wants changes\` (write their feedback).

## Delivering
When the client has approved and the final files are ready, press \`Mark delivered\`. Delivered tasks count in the team productivity and content delivery reports.

## Revisions limit
Each task shows **revisions used / included**. If a client keeps asking for changes beyond what's included, it's visible on the task and in the client scorecard — a good reason to discuss extra charges.`
  },
  {
    id: 'calendar', main: true, cat: 'production', title: 'Content calendar: planning posts',
    summary: 'Plan every client’s posts by month, with caption, design and publishing date.',
    perm: ['calendar.view', 'calendar.manage'], routes: ['/calendar'],
    body: `
The content calendar holds every post for every client.

## Views
- **Month** — a calendar grid. Drag a post to another day to move its publish date.
- **List** — all posts of the month in a table.
Use \`‹ ›\` to change month and the client filter to focus on one client. The client's package targets (posts, reels, stories) are shown so you can see if the month is fully planned.

## Adding a post
Press \`New post\` (or the small \`+\` on a day, or double-click the day) and fill in:
- **Client**, **publish date**, **post type** (Post, Carousel, Reel, Story, Banner…), **assigned to** and **content pillar** (Educational, Promotional, Festival…).
- **Platforms** where it will go out.
- **Title / topic** (e.g. "Diwali greeting").
- **Caption**, **hashtags** and **call to action**.
- **Media / final creative link** once the design is ready.

## Getting the design made
Inside the post, press \`Create design task\`. A task is created **pre-filled** from the post — the designer sees the caption, size and date. The post and task stay linked, so you can jump between them.

Next: [[post-workflow]].`
  },
  {
    id: 'post-workflow', cat: 'production', title: 'Post statuses and approval',
    summary: 'Idea → Copywriting → In design → Internal review → Client approval → Approved → Scheduled → Published.',
    perm: ['calendar.view', 'calendar.manage'], routes: ['/calendar'],
    body: `
1. **Idea** — just a topic.
2. **Copywriting** — caption being written.
3. **In design** — the creative is being made (usually with a linked design task).
4. **Internal review** — ready for a team check. It appears in [[approvals]] for people who manage the calendar.
5. **Client approval** — sent to the client; it shows on their [[client-portal|approval link]].
6. **Approved** — by the client or by us (\`Approve (final)\`).
7. **Scheduled** — set up in Meta Business Suite or another scheduler.
8. **Published** — live.
9. **Cancelled**.

If the client asks for changes, their feedback appears on the post as **Client feedback**.

**Approved, Scheduled and Published** posts count as *delivered* in the [[social-reports|client social report]].`
  },
  {
    id: 'post-performance', cat: 'production', title: 'Post links & performance',
    summary: 'Add the live link and numbers for each platform — they feed the client’s monthly report.',
    perm: ['calendar.manage'], routes: ['/calendar', '/social'],
    body: `
Once a post is live, open it in the content calendar and go to **Post links & performance**.

1. Press \`Add platform\` — one row for each platform it went out on (Instagram, Facebook…).
2. Paste the **post URL**.
3. Add the numbers from that platform's insights: **reach**, **views**, **likes**, **comments**, **shares**, **saves** — any time later, when the numbers have settled (usually after 3–7 days).

The system works out the **engagement**. These figures appear in the **Post performance** section of the client's monthly report, including the best post of the month. See [[social-reports]].`
  },
  {
    id: 'queries', main: true, cat: 'production', title: 'Team queries',
    summary: 'Ask a colleague or team a question that stays tracked until it is resolved.',
    routes: ['/queries'],
    body: `
Use a query for anything that needs an answer — a brief clarification, missing files, a finance question, a leave request. Unlike a chat message, it is tracked until someone marks it **resolved**.

## Raising a query
1. \`Team Queries\` → \`New query\` (or \`Raise query\` on a task, which links it to that task).
2. Write a **subject** and the question.
3. Send it to **a person** or **a whole team** (e.g. all designers).
4. Choose a **category** (Design, Client, Files / Access, Finance, Leave / HR…) and **priority**.

## Answering
Open the query, type your reply (\`Ctrl + Enter\` to send) — use **@** to bring someone else in. Status goes **Open → Answered → Resolved**. Whoever raised it marks it resolved when they're satisfied.

Queries waiting for you also appear in [[approvals]], and the menu bubble shows how many are open.`
  },
  {
    id: 'timesheet', main: true, cat: 'production', title: 'Timesheet',
    summary: 'Log your hours each day — they power utilisation and client profitability.',
    perm: ['tasks.work', 'tasks.manage', 'timesheet.all'], routes: ['/timesheet'],
    body: `
The timesheet shows one week at a time. Use \`‹ ›\` to move between weeks.

## Adding an entry
1. Press \`Add entry\`.
2. Pick the **date** and the **hours** (decimals are fine, e.g. 1.5).
3. In **Task / what you did**, either choose one of **your tasks** from the suggestions, or simply **type what you did** — e.g. "Reel editing for Star Health" or "Client meeting".
4. Choose the **client** (or *Internal / no client*).
5. Keep **Billable client work** ticked for client work; untick for internal work.

## The numbers at the top
- **Logged this week** and **Billable** hours.
- **Utilisation** — billable hours ÷ your weekly capacity. Healthy creative teams run at **65–75%**.

People with *See everyone's timesheets* can switch to another team member.

> Log time daily. Hours are what show whether a client's fee actually covers the work.`
  },

  /* ============================ SELLING & BILLING ============================ */
  {
    id: 'walk-in', main: true, cat: 'sales', title: 'Walk-in sale (any team member)',
    summary: 'Bill a walk-in customer, collect the money and give a receipt in one screen.',
    routes: ['/walkin'],
    body: `
Any team member can bill a customer who walks in — for a visiting card, a flyer, a logo — even without finance access.

## Making the sale
1. \`Walk-in sale\` in the menu.
2. **Customer** — type the **mobile number** first. If they've been here before, their details appear: tap to use them. Otherwise fill in the **name / shop name**, **WhatsApp** (defaults to the same as mobile), **email**, **location / area**, **address** (printed on the receipt) and **salesman / brought by**. To bill an existing client instead, switch to \`Existing client\`.
3. **Items** — add each item with description, quantity and rate. Add a discount if agreed.
4. **Collect payment** — enter the **amount received** (full or an advance), the **method** (UPI, Cash, Card…) and a reference if any.
5. Save. An invoice is created and marked with **your name as the collector**.
6. Press \`Open receipt · Print / WhatsApp\` to print it or send it on WhatsApp.

## Collecting the balance later
If the customer paid an advance, find the sale under **Your walk-in sales · last 30 days** and press \`Collect balance\` when they pay the rest.

## Your cash today
**You collected today** shows what you collected, by method — so you can hand over the cash at the end of the day. Finance sees all collections in [[cash-flow|Payments & cash flow]] under *Received by*.`
  },
  {
    id: 'on-demand-jobs', main: true, cat: 'sales', title: 'On-demand jobs (clients without a monthly package)',
    summary: 'Log single jobs with their amount as you do them, then bill at month end or when the client pays.',
    routes: ['/jobs', '/clients/'],
    body: `
Some clients don't take a monthly package. They ask for one piece of work at a time — a poster today, a banner next week — and pay per job. **On-demand jobs** keeps track of every job and what to charge, so nothing is forgotten at billing time.

**Every team member** can add jobs, including the amount.

## Adding a job
1. Open \`On-demand jobs\` in the menu and press \`Add job\`. You can also open the client → \`On-demand jobs\` tab → \`Add job\`.
2. Choose the **customer**. If they're new, press \`+\` next to the list to add them.
3. Write **what was done** (e.g. "Poster – Friday offer"). Titles you've used before are suggested as you type.
4. Enter the **date**, **quantity** and **rate** (the price for one). The amount is calculated for you.
5. Add **notes** if useful (size, platform). They are printed under the line on the invoice.
6. Optionally link the **design task** it belongs to. People who create tasks can also tick **Also create a design task for this job**, so the designer gets it straight away.

The job now sits under **To bill** until it's invoiced. You can edit it freely until then.

## Billing at month end
1. \`On-demand jobs\` → \`To bill\` shows every unbilled job from **any date**, grouped by customer, with the total for each.
2. Untick any job you want to leave for a later bill.
3. Press \`Bill all\` (or \`Bill 2\`…) on the customer. One invoice is created with **one line per job**, and the **invoice period** is set from the first to the last job date.
4. Finance can tick **Save as a draft** to check it first, then send it and press \`Mark sent\` (see [[invoices]]). For everyone else the invoice is issued straight away.

## When the client pays on the spot
Press \`Bill\` on the customer and enter the **amount received now** (\`Full\` fills the whole total), the method and a reference. The invoice and the payment are created together, and the payment is recorded as **collected by you**, just like a [[walk-in|walk-in sale]]. If they paid only part, the rest can be collected later with \`Collect balance\` on the invoice.

## Good to know
- A billed job is **locked**. To change it, change the invoice. If the invoice is **cancelled** or deleted, its jobs go back to **To bill**.
- \`All jobs\` lists every job in a period, with its invoice number and status. \`Export\` downloads it.
- The client's page has an **On-demand jobs** tab with the same view for just that client.
- Finance can also open this page from \`Invoices\` → \`Bill on-demand jobs\`.
- Clients with a monthly package can also have on-demand jobs, for extra work that isn't in the package.`
  },
  {
    id: 'quotations', main: true, cat: 'sales', title: 'Quotations and the commercial proposal',
    summary: 'Send a quick quote or a full proposal with terms, and turn it into an invoice when accepted.',
    perm: ['quotations.view', 'quotations.manage'], routes: ['/finance/quotations'],
    body: `
## Creating a quotation
1. \`Quotations\` → \`New quotation\`, or press \`Quotation\` on a lead.
2. Choose the **client** — or, for a prospect, the **lead** (shown as *Bill to*).
3. Write a **subject / title** (e.g. "Social media marketing for the new branch") and the **valid until** date.
4. Add **line items** — pick from \`+ Add from service catalogue…\` (prices come from Settings), or type your own. Use \`Blank line\` for headings or spacing. Add a discount if needed.
5. Save as **Draft**.

## Quick quote or full proposal
Tick **Print as full commercial proposal** to print the standard Aqlyon proposal: about us and objectives, the services, **client responsibilities**, **what's not included**, **terms & conditions** and an **acceptance / signature block**. The text comes from \`Settings\` → \`Quotation & proposal\`, and you can edit it for this quote only. Untick it for a short price quote.

The standard terms include **2 revisions per creative** and a **24-hour client approval window** — change them in Settings if your policy changes.

## Sending and following up
\`Download PDF\` or \`Print\`, or send it on WhatsApp, then press \`Mark sent\`. Statuses: **Draft → Sent → Accepted / Rejected / Expired**. The page shows what's awaiting a response and your acceptance rate.

## When the client accepts
Press \`Accept → Invoice\`. The quote is marked **Accepted** and a draft invoice is created with the same items. Use \`Duplicate\` to start a similar quote for another client.`
  },
  {
    id: 'invoices', main: true, cat: 'sales', title: 'Creating and sending invoices',
    summary: 'New invoice, invoice period, statuses, sending, printing, cancelling.',
    perm: ['invoices.view', 'invoices.manage'], routes: ['/finance/invoices'],
    body: `
## Creating an invoice
1. \`Invoices\` → \`New invoice\` (or \`New invoice\` on a client's page).
2. Choose the **client** and the **due date**.
3. **Invoice period** (optional) — the dates the invoice covers, e.g. 1 Oct – 31 Oct. Use the \`This month\`, \`Last month\` or \`Next month\` buttons, or pick any start and end date (picking a start date fills in the end of that month). It is printed on the invoice, shown in the list ("for 1 Oct – 31 Oct") and included in the WhatsApp message.
4. **Line items** — use \`Customer packages\` to add the client's package in one click, \`+ Add from service catalogue…\` or type your own. Amounts can have decimals.
5. Add **notes** to show on the invoice, and save.

## Statuses
- **Draft** — not sent yet. **Drafts are not counted as money owed** anywhere (Outstanding, Overdue, Receivables).
- **Sent** — the client has it; it now counts as outstanding.
- **Partly paid** / **Paid** — updated automatically when you [[record-payment|record payments]].
- **Overdue** — sent or partly paid, and past the due date.
- **Cancelled** — kept for the record, not counted.

## Sending
Open the invoice and:
- \`WhatsApp\` — opens WhatsApp with the amount, period and payment details. Sending this way marks a draft as sent.
- \`Download PDF\` / \`Print\` — then press \`Mark sent\`.

>! Always press \`Mark sent\` once the client has the invoice. Until then it stays a draft and won't show in Outstanding or Receivables.

## Other actions
- \`Duplicate\` — copy it for a new invoice.
- \`Edit\` — change an invoice that isn't paid or cancelled.
- **Cancel invoice** (🚫 icon) — if it was raised by mistake. Only possible while nothing has been paid on it; remove any payments first. Drafts can simply be deleted (🗑 icon).
- The cards at the top (Outstanding, Overdue, Drafts to send) are clickable filters.`
  },
  {
    id: 'retainer-invoices', cat: 'sales', title: 'Generating monthly retainer invoices',
    summary: 'One click creates this month’s invoices for every active package.',
    perm: ['invoices.manage'], routes: ['/finance/invoices'],
    body: `
At the start of each month press \`Generate retainer invoices\` on the Invoices page.

## What it does
For every **active** package (monthly, quarterly or yearly) that is due this month, it creates one **draft** invoice:
- dated on the package's **invoice day of month** (or today if that has passed), due 7 days later,
- with the package name and month as the line item, e.g. "Social Media Growth — Oct 2026",
- with the **invoice period** filled in — one month, three months (quarterly) or twelve months (yearly),
- with your default terms from Settings.

Quarterly packages are billed every third month from their start date; yearly ones in their start month.

## It's safe to press again
A package is never invoiced twice for the same month, so pressing it again only creates invoices that are missing (for example for a client added later).

## Then
1. Review each draft — add extras (ad spend, extra reels) if needed.
2. Send it and press \`Mark sent\` ([[invoices]]).

Paused, ended and one-time packages are skipped.`
  },
  {
    id: 'record-payment', cat: 'sales', title: 'Recording a customer payment',
    summary: 'Record money received against an invoice, or as an advance.',
    perm: ['payments.manage', 'invoices.manage'], routes: ['/finance/invoices', '/finance/payments'],
    body: `
1. Press \`Record payment\` on the invoice (or in the invoice list, or on Payments & cash flow).
2. **Against invoice** — choose the invoice, or *No invoice (advance / on account)* for an advance.
3. Enter the **amount** (decimals allowed), the **date received** and the **method** — UPI, Bank Transfer, Cash, Cheque, Card.
4. **Money received by** — normally **Company account**. If a team member collected cash or it came into their personal account, choose them, so you know who is holding it.
5. Add a **reference** (UPI ref, cheque number, transaction ID) and save.

The invoice updates automatically to **Partly paid** or **Paid**, and the balance is reduced.

## Made a mistake?
Open the invoice → **Payments received** → \`Remove\` on the wrong payment, then record it again correctly.`
  },

  /* ==================== PAYMENTS, EXPENSES & SUPPLIERS ==================== */
  {
    id: 'cash-flow', main: true, cat: 'money', title: 'Payments & cash flow',
    summary: 'Money in and out side by side, the running balance and your cash position today.',
    perm: ['payments.manage'], routes: ['/finance/payments'],
    body: `
This page shows every money movement: payments from customers, payments to suppliers, and expenses.

## The cards
- **Money in** — received from customers in the selected period.
- **Paid to suppliers** and **Other expenses** — with how much was paid from the company account vs paid personally.
- **Paid personally (founder / staff)** — company costs someone paid from their own pocket, and how much is still owed to them.
- **Cash position today** — the overall balance **as of today**, from all time. It does **not** change when you pick a different period. The small text shows this period's net and the company account alone.

## The movements list
- Tabs: **All movements**, **Received from customers**, **Paid to suppliers**.
- An **Opening balance** row shows the balance from everything before the period, and each row has a **running balance**. The footer shows the closing balance.
- Filter by customer, method and who received the money.

## How personal payments are counted
When a founder or staff member pays a company cost from their own account, the cost is counted **when it was spent** — it reduces the cash flow at that time. When the company later repays them, that row is marked **⇄ Settlement**: it moves money between the company and that person but does not change the total again. See [[founder-repay]].`
  },
  {
    id: 'expenses', main: true, cat: 'money', title: 'Recording expenses',
    summary: 'Rent, salaries, subscriptions, ad spend — with receipts, payees and recurring costs.',
    perm: ['expenses.manage'], routes: ['/finance/expenses'],
    body: `
## Adding an expense
1. \`Expenses\` → \`Add expense\`.
2. Date, **amount**, **category** (Salary, Rent, Software, Ad Spend (Client), Printing…).
3. **Paid from** — *Company account*, or the team member who paid from their own pocket (see [[founder-repay]]).
4. **Paid via** — UPI, cash, card…
5. **Vendor / paid to** — choose the payee, or \`+\` to add a new one (landlord, KSEB, Adobe…). This builds each payee's statement.
6. **For client (optional)** — if the cost was for a specific client. Tick **Re-bill to client** if you will charge it to them (e.g. ad spend) — it shows in the *Re-billable to clients* card so it isn't forgotten on the next invoice.
7. Attach a **photo of the receipt / bill** — it is compressed automatically to save storage.
8. Tick **Recurring monthly** for costs that repeat (rent, salaries, subscriptions).

## Recurring expenses
At the start of the month, select the month and press \`Copy recurring\`. All of last month's recurring expenses are added to this month in one go. Edit any amounts that changed.

## Views
Switch between the list, **By payee** and **By category**. The cards show total spent, re-billable amounts, what's **payable to founder / staff**, and the biggest category.`
  },
  {
    id: 'founder-repay', cat: 'money', title: 'When a founder or staff member pays from their own account',
    summary: 'Record personal spending as payable, then repay it later.',
    perm: ['expenses.manage', 'suppliers.pay'], routes: ['/finance/expenses', '/finance/payments'],
    body: `
Sometimes a founder pays a company bill from his own account, and the company repays him later.

## 1. Record the spending
Add the expense (or supplier payment) as usual, but set **Paid from** to that person instead of *Company account*. It is:
- counted as a company expense **on the day it was spent**,
- shown as **payable to that person** until repaid.

## 2. See what's owed
\`Expenses\` → the **Payable to founder / staff** card, and the **Still payable** list, show every unpaid item from **any date**, per person.

## 3. Repay
1. Press \`Repay founder / staff\`.
2. Choose the person (**Repay to**). Their unpaid items are listed — **tick the ones you are repaying**.
3. Enter the **date paid**, the method and a **reference** (UTR / cheque no.) and save.

The items are marked repaid. In [[cash-flow]] the repayment appears as a **⇄ Settlement** — it doesn't count as a second expense. If you made a mistake, use \`Undo repayment\`.`
  },
  {
    id: 'suppliers', main: true, cat: 'money', title: 'Suppliers & payees',
    summary: 'Freelancers, printers and anyone you pay — with a running account statement.',
    perm: ['suppliers.view', 'suppliers.manage', 'suppliers.pay', 'expenses.manage', 'payments.manage'], routes: ['/finance/suppliers'],
    body: `
Add everyone you pay: **freelancers and printers** you outsource to, and **payees** like the landlord, KSEB or Adobe.

## Adding one
\`Add supplier / payee\` — name, **category**, contact person, phone, **WhatsApp**, **UPI ID**, **bank details**, and notes (rates, turnaround, quality).

## A supplier's page
- **Total spent with them** and **Balance owed**.
- Their **work orders** and **expenses**.
- An **account statement** for any period: an **opening balance**, then work orders (which add to what you owe) and payments (which reduce it). Expenses are paid on the spot, so they appear on both sides. Press \`Export statement\` to download it.`
  },
  {
    id: 'work-orders', main: true, cat: 'money', title: 'Supplier work orders',
    summary: 'Outsourced work: what you owe, which customer it’s for, and your margin.',
    perm: ['suppliers.view', 'suppliers.manage', 'suppliers.pay'], routes: ['/finance/work-orders', '/finance/suppliers'],
    body: `
A **work order** records work you give to an outside supplier — a print run, a freelance logo, a video shoot.

## Creating a work order
1. \`Supplier work orders\` → \`New work order\`.
2. Choose the **supplier** (or \`Add supplier\`), a **title** (e.g. "Logo design – Kappad Beach Resort"), the **order date** and **expected delivery**.
3. **What you're paying for** — the lines and amounts.
4. **Which customer is this for?** — choose the customer. One order can be **split across several customers** (e.g. one print run for three clients): \`Add customer\`, then enter each **cost share**, or press \`Split equally\`. The split must add up to the order total. Leave it empty for internal work.
5. Optionally link each share to the customer's invoice (**Against invoice**) — the work order then shows **Billed to customer**, **Supplier cost** and **your margin**.

## When the work arrives
Press \`Work received\`.

## Paying the supplier
Press \`Pay supplier\`, choose the **payment type** (Advance, Part payment or Final / balance), **amount**, **date**, **paid from** (company account or a team member — see [[founder-repay]]), method and reference. You can't pay more than the balance.

## Cards
**Payable to suppliers** (balance still to pay), **Work not yet received**, and **Supplier cost this month**. Each work order can be printed or downloaded as a PDF to send to the supplier.`
  },

  /* ================================ REPORTS ================================ */
  {
    id: 'social-reports', main: true, cat: 'reports', title: 'Client social reports',
    summary: 'Monthly deliverables vs package, the content log, account KPIs and post performance.',
    perm: ['calendar.view', 'calendar.manage', 'clients.view', 'clients.manage', 'reports.content'], routes: ['/social'],
    body: `
This replaces the marketer's Excel sheets. Everything comes from data already in the system, plus the account numbers you type in once a week or month.

## Where the numbers come from
- **Deliverables** — posts in the [[calendar|content calendar]] that are **Approved, Scheduled or Published**, compared with the client's [[packages|package]] (posters, stories, reels / motion, banners, other).
- **Content log** — every post of the month by week: topic, type, assignee, status and links.
- **Account performance (KPIs)** — typed in from Instagram / Meta insights (below).
- **Post performance** — from [[post-performance|Post links & performance]] on each post.

## The overview page
One row per client: delivered vs package, still in progress, waiting on clients, and whether **KPIs are entered** for this month. The cards show which package clients still have no numbers.

## Entering account KPIs
Open a client's report:
1. Press \`Add period\` and choose the **From–To dates** you're reporting — a week, two weeks, a month; any length.
2. For each platform, type the numbers from insights: **reach, content shared, new followers, profile visits, story views, post views, interactions, followers %**. You can type \`1.2k\` or \`45%\`. Grey hints under *Content shared* show the posts approved or posted in that period.
3. \`Add metric\` adds your own measure (e.g. Saves, Non-followers %). \`Add another platform / channel\` adds YouTube, Website, etc.
4. Save. Charts appear once numbers are saved; **This month by period** and **Last 6 months** compare progress.

## Sharing with the client
Press \`Download PDF\` or \`Print\` for a clean, branded monthly report: deliverables, KPIs with charts, the content log and the best-performing posts.`
  },
  {
    id: 'work-report', main: true, cat: 'reports', title: 'Client work report (how many posters, posts, jobs…)',
    summary: 'For any customer and any period: how many designs, posts and on-demand jobs were done, by type.',
    routes: ['/clients/'],
    body: `
Use the work report when a client (or you) asks "how much work did you do for us?" — for a month, a quarter or any dates you choose.

## Opening it
1. Open the client and press \`Work report\` at the top of their page.
2. Pick the **period** with the date button: This month, Last month, Last 3 months… or a **custom From–To**.
3. To switch to another customer, choose them in the customer box at the top.

## What it counts
- **Designs** — design tasks, counted **per piece**: a task "Social Post ×3" counts as 3. They're grouped by type (Social Post, Poster, Story, Reel, Flyer, Logo…). A finished task is dated on the day it was **approved or delivered**.
- **Posts** — posts in the [[calendar|content calendar]], grouped by type (Poster, Carousel, Reel, Story…), dated by their **publish date**.
- **On-demand jobs** — every [[on-demand-jobs|on-demand job]] in the period, with quantity and amount.

## Completed work vs everything
- **Completed work** (the default) counts only finished items: designs **approved or delivered**, posts **approved, scheduled or posted**.
- **Everything in period** also includes work still in progress, with separate *Finished* and *In progress* columns. Unfinished designs are dated by their due date.

## Sharing it
- \`Show item list\` adds a dated list of every item under the summary. Untick it for a one-page summary.
- \`Download PDF\` or \`Print\` gives a clean report with your logo to send to the client. \`CSV\` downloads the item list as a spreadsheet.

> A post that was made from a design task appears in both **Designs** and **Posts**, because it's both a design delivered and a post published. Look at one section at a time when you quote totals to a client.`
  },
  {
    id: 'business-reports', main: true, cat: 'reports', title: 'Business reports',
    summary: 'Profit & loss, receivables, client profitability, sales, team productivity and content delivery.',
    perm: ['reports.finance', 'reports.clients', 'reports.sales', 'reports.team', 'reports.content', 'tasks.work'], routes: ['/reports'],
    body: `
\`Reports\` has a tab for each area. You only see the tabs your role allows. Pick a period at the top; \`Print\` prints the current tab.

## Profit & Loss
- **Revenue (invoiced)** — sent invoices dated in the period (drafts excluded).
- **Cash collected**, **Supplier costs**, **Expenses** and **Profit (accrual)**.
- **Net cash flow** — money in, minus expenses and supplier payments (including those paid personally).
- A monthly chart, expenses by category, spend by payee and a monthly statement.

## Receivables
What customers owe, by age: **Not due, 1–30, 31–60, 61–90, 90+ days** past the due date, and an **aging by client** table. Only **sent** and **partly paid** invoices count — drafts are not owed until sent.

## Client profitability
For each client: **monthly fee**, **labour cost** (hours logged × each person's cost per hour), **supplier & direct costs** and the **margin**, plus a client scorecard with revisions. Add salaries and working hours in Team & Access for accurate labour cost.

## Sales & leads
New leads, **won value**, **win rate**, average deal, the conversion funnel, leads by source, results by marketer and **why we lose**.

## Team productivity
Per person: tasks delivered vs assigned, **on-time** rate (approved by the due date), **first-pass approval** (approved without revisions), average revisions, hours logged and **utilisation** (healthy: 65–75%). Designers see their own numbers.

## Content delivery
Committed in packages vs planned vs published, per client, with engagement rate.`
  },

  /* ============================ TEAM & SETTINGS ============================ */
  {
    id: 'team-users', main: true, cat: 'admin', title: 'Adding and managing users',
    summary: 'Create logins, reset passwords, block access, and record salary and working hours.',
    perm: ['team.manage'], routes: ['/team'],
    body: `
\`Team & Access\` → \`Users\`.

## Adding a user
1. Press \`Add user\`.
2. **Full name**, **role** (build roles first — see [[roles]]), **login email** and a **temporary password** (at least 8 characters). Give them the email and password privately.
3. **Designation** (e.g. Senior Graphic Designer) and **joined on**.
4. **Monthly salary**, **working days** and **work start / end times**. The system works out their **cost per hour**, used in client profitability.

>! Salaries are private: only people whose role includes *Manage users and roles* can see them.

## Changing a user
- **Reset password** — set a new temporary password when someone forgets theirs.
- **Active** — untick to **block their login** immediately (e.g. when someone leaves). Their history stays in the system. Never delete a person who has done work.
- Change their **role** at any time; it applies the next time they open a page.

You can't remove your own Administrator access, so the company is never locked out.`
  },
  {
    id: 'roles', cat: 'admin', title: 'Roles & permissions',
    summary: 'Build roles by ticking what each one can see and do.',
    perm: ['team.manage'], routes: ['/team'],
    body: `
\`Team & Access\` → \`Roles & permissions\`.

## Creating a role
1. Press \`New role\` (or \`Duplicate\` an existing one to start from it).
2. Give it a **name** (e.g. "Social Media Executive"), a colour and a description.
3. Tick the permissions, grouped as **CRM**, **Design & content**, **Finance**, **Reports** and **Administration**.
4. \`Save role\`, then assign it to users on the Users tab.

## Things to know
- A **Manage** permission automatically includes the matching **See** permission.
- **See prices & money** is required for **every** finance permission. Without it, a role can't see invoices, quotations, payments, expenses or supplier costs, and every amount shows as **—**, even if the other finance boxes are ticked.
- Everyone can always see their dashboard, team queries, the walk-in sale page and log their own time.
- The **Permission overview** shows all roles side by side — useful to check who can see money.

> Give each person the smallest role that lets them do their job. It's easy to add a permission later.`
  },
  {
    id: 'settings', main: true, cat: 'admin', title: 'Company settings, proposal text and price list',
    summary: 'Details printed on invoices, numbering, bank/UPI, proposal terms and the service catalogue.',
    perm: ['settings.manage'], routes: ['/settings'],
    body: `
## Company & invoices
- **Company name, address, phone, email, website** — printed on every invoice, quotation and work order.
- **Invoice prefix** and **quotation prefix** — e.g. \`AQB-INV\` gives \`AQB-INV-2026-0001\`. Numbers run automatically.
- **Task code prefix** for design tasks.
- **UPI ID** and **bank details** — printed in *Payment details* on invoices.
- **Default invoice terms**.
- **Design workflow** — **revisions included by default** per task (the proposal promises 2) and the **client approval window** in hours (shown on the client approval page).

## Quotation & proposal
The standard text of the [[quotations|commercial proposal]]: **about us & objectives**, **client responsibilities**, **not included**, **terms & conditions** and the **acceptance** text above the signature lines. Formatting: \`## Heading\`, \`- bullet\`, \`**bold**\`. Use \`Preview\` to check it.

Every new quotation starts with this text. Existing quotations keep what they were sent with.

## Services & pricing
The **service catalogue** used by \`+ Add from service catalogue…\` on quotations and invoices. For each service: name, **category**, **rate** (or *Quote per job*), description, and whether to **show it in the picker**.`
  },

  /* ========================= FAQ & TROUBLESHOOTING ========================= */
  {
    id: 'faq-draft-missing', cat: 'faq', title: 'I created an invoice but it’s not in Outstanding / Receivables',
    summary: 'It’s still a draft — press Mark sent.',
    perm: FIN, routes: ['/finance/invoices', '/reports'],
    body: `
New invoices — including generated retainer invoices — start as **Draft**. A draft hasn't been given to the client, so it isn't owed yet and is **not counted** in Outstanding, Overdue, the dashboard or Receivables.

**Fix:** open the invoice and press \`Mark sent\` (or send it with the \`WhatsApp\` button, which marks it sent). It then appears everywhere straight away.

Tip: the **Drafts to send** card on the Invoices page shows how many drafts are waiting — click it to see them.`
  },
  {
    id: 'faq-dash', cat: 'faq', title: 'Why do I see “—” instead of amounts?',
    summary: 'Your role doesn’t include “See prices & money”.',
    body: `
Money is private. Only roles with **See prices & money** (by default Administrator and Finance) see fees, prices, totals and balances. Everyone else sees **—**.

If your job needs it, ask an admin to add the permission to your role. See [[roles-visibility]].`
  },
  {
    id: 'faq-menu', cat: 'faq', title: 'A menu or button I need is missing',
    summary: 'Menus and buttons follow your role’s permissions.',
    body: `
The sidebar only shows what your role allows, and buttons like \`New invoice\`, \`Approve\` or \`Delete\` only appear if you can use them.

- Ask an admin to check your role in \`Team & Access\` → \`Roles & permissions\`.
- After your role changes, **refresh the page** (or open another page) to see the new menus.`
  },
  {
    id: 'faq-mistake', cat: 'faq', title: 'How do I correct a mistake?',
    summary: 'Fixing a wrong payment, invoice, expense or task.',
    body: `
- **Wrong payment** — open the invoice → *Payments received* → \`Remove\`, then record it again.
- **Wrong invoice** — while it's a draft, just edit it. After sending, edit it, or cancel it (🚫 icon) and create a new one, so the number history stays clean.
- **Wrong expense** — open it and edit, or delete it from the expenses list.
- **Wrong repayment to a founder** — \`Undo repayment\` on Expenses.
- **Task cancelled by mistake** — open it and press \`Reopen\`.
- **Wrong proof uploaded** — upload the correct file as the next version, with a note.

Everything you change is saved immediately — there is no separate "save all".`
  },
  {
    id: 'faq-upload', cat: 'faq', title: 'My file won’t upload',
    summary: 'File size, file type and slow connections.',
    perm: ['tasks.work', 'expenses.manage'],
    body: `
- **Over 50 MB** — large videos and print files: upload them to Google Drive and paste the **share link** in the proof's link box instead.
- **"Still optimising the image — one moment"** — large images are compressed in your browser first. Wait a few seconds and press upload again.
- **Allowed types** for proofs: images (JPG, PNG, WebP…), videos (MP4…) and PDF.
- On a slow connection, keep the page open until you see the confirmation message.

Check the Drive link is shared as *Anyone with the link can view*, otherwise reviewers and clients can't open it.`
  },
  {
    id: 'faq-client-link', cat: 'faq', title: 'The client says their approval link doesn’t work',
    summary: 'Links expire after 60 days or can be revoked.',
    perm: ['calendar.manage', 'clients.manage'],
    body: `
"Link unavailable" means the link has **expired** (after 60 days) or was **revoked**.

Open the client → \`Client approval links\` → \`Create new link\` and send it again. If the client sees "You're all caught up", the link works — there's simply nothing waiting for them. Send the post with \`Approve → client\` or move the design to *Client review* first.`
  },
  {
    id: 'faq-errors', cat: 'faq', title: 'I see an error message (e.g. “column … not found” or “schema cache”)',
    summary: 'Usually the database needs its latest update — tell the admin.',
    body: `
After a software update, the admin sometimes has to run the latest database update (\`supabase/schema.sql\`) in Supabase. Until then, new features can show errors such as *"Could not find the … column … in the schema cache"*.

- Take a screenshot of the message and send it to the admin.
- Refresh the page after the admin confirms the update is done.

Messages like *"Choose a client"* or *"Enter an amount"* just mean a required field is empty — fill it in and save again.`
  }
]

export const helpById = (id) => HELP_ARTICLES.find((a) => a.id === id)

/** articles that belong to the page at `path`: exact page first, then the page's main guide, then the rest */
export function helpForPath(path, articles = HELP_ARTICLES) {
  const tier = (a) => Math.max(0, ...(a.routes || []).map((r) => {
    if (r === '/') return path === '/' ? 2 : 0
    if (r.endsWith('/')) return path.startsWith(r) && path.length > r.length ? 1 : 0 // detail pages only
    if (path === r) return 2
    return r !== '/' && path.startsWith(r + '/') ? 1 : 0
  }))
  return articles.map((a, i) => [a, tier(a), i]).filter(([, t]) => t > 0)
    .sort((x, y) => y[1] - x[1] || (y[0].main ? 1 : 0) - (x[0].main ? 1 : 0) || x[2] - y[2]).map(([a]) => a)
}

/** plain text of an article, for search */
export const helpText = (a) => `${a.title} ${a.summary} ${a.body}`.replace(/[`*#>[\]|]/g, ' ').toLowerCase()
