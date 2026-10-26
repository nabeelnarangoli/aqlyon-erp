// Every permission a role can be given. Keep in sync with supabase/schema.sql (roles seed).
export const PERMISSION_GROUPS = [
  { id: 'crm', label: 'CRM', perms: [
    ['leads.view', 'See leads & pipeline'],
    ['leads.manage', 'Add / edit leads, log conversations, follow-ups, convert to client'],
    ['clients.view', 'See clients & brand kit'],
    ['clients.manage', 'Add / edit clients and approval links'],
    ['packages.view', 'See packages & retainer fees'],
    ['packages.manage', 'Create / edit packages'],
    ['projects.view', 'See campaigns & projects'],
    ['projects.manage', 'Create / edit campaigns & results']
  ] },
  { id: 'production', label: 'Design & content', perms: [
    ['tasks.view', 'See all design tasks'],
    ['tasks.work', 'Work on tasks: pick up, start, upload proofs'],
    ['tasks.manage', 'Create, edit, assign, deliver and cancel tasks'],
    ['tasks.review', 'Approve proofs / request changes'],
    ['calendar.view', 'See the content calendar'],
    ['calendar.manage', 'Plan posts and send them for client approval'],
    ['timesheet.all', 'See everyone’s timesheets']
  ] },
  { id: 'finance', label: 'Finance', perms: [
    ['quotations.view', 'See quotations'],
    ['quotations.manage', 'Create / edit quotations'],
    ['invoices.view', 'See invoices'],
    ['invoices.manage', 'Create / edit invoices, generate retainer invoices'],
    ['payments.manage', 'Record customer payments, see cash flow'],
    ['expenses.manage', 'See and record expenses'],
    ['suppliers.view', 'See suppliers, work orders & supplier costs'],
    ['suppliers.manage', 'Add suppliers and create work orders'],
    ['suppliers.pay', 'Record payments to suppliers']
  ] },
  { id: 'reports', label: 'Reports', perms: [
    ['reports.finance', 'Profit & loss and receivables'],
    ['reports.clients', 'Client profitability'],
    ['reports.sales', 'Sales & leads'],
    ['reports.team', 'Team productivity (everyone)'],
    ['reports.content', 'Content delivery']
  ] },
  { id: 'admin', label: 'Administration', perms: [
    ['team.manage', 'Manage users and roles'],
    ['settings.manage', 'Company settings and price list']
  ] }
]

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.perms.map(([k]) => k))
export const PERM_LABEL = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.perms))

/** does a permission list grant any of the requested permissions? '*' = everything */
export const grants = (list, ...want) => !!list && (list.includes('*') || want.some((w) => list.includes(w)))

export const ROLE_COLORS = ['dark', 'green', 'violet', 'amber', 'blue', 'teal', 'orange', 'red', 'slate']

// starting roles (also seeded in the database)
export const DEFAULT_ROLES = [
  { key: 'admin', name: 'Administrator', color: 'dark', is_system: true, description: 'Full access to everything', permissions: ['*'] },
  { key: 'marketer', name: 'Digital Marketer', color: 'green', description: 'Leads, clients, tasks, calendar and quotations',
    permissions: ['leads.view', 'leads.manage', 'clients.view', 'clients.manage', 'packages.view', 'packages.manage', 'projects.view', 'projects.manage',
      'tasks.view', 'tasks.manage', 'tasks.review', 'calendar.view', 'calendar.manage', 'timesheet.all', 'quotations.view', 'quotations.manage',
      'invoices.view', 'suppliers.view', 'suppliers.manage', 'reports.sales', 'reports.team', 'reports.content', 'reports.clients'] },
  { key: 'designer', name: 'Graphic Designer', color: 'violet', description: 'Works on design tasks and uploads proofs',
    permissions: ['clients.view', 'projects.view', 'tasks.view', 'tasks.work', 'calendar.view'] },
  { key: 'finance', name: 'Finance', color: 'amber', description: 'Invoices, payments, expenses and suppliers',
    permissions: ['clients.view', 'packages.view', 'quotations.view', 'quotations.manage', 'invoices.view', 'invoices.manage', 'payments.manage',
      'expenses.manage', 'suppliers.view', 'suppliers.manage', 'suppliers.pay', 'reports.finance', 'reports.clients'] }
]

export const REPORT_PERMS = ['reports.finance', 'reports.clients', 'reports.sales', 'reports.team', 'reports.content', 'tasks.work']
