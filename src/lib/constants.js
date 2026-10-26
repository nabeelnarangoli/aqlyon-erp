// Shared vocabularies, labels and colour tones used across the ERP.

export const ROLES = {
  admin:    { label: 'Admin',            tone: 'dark' },
  marketer: { label: 'Digital Marketer', tone: 'green' },
  designer: { label: 'Graphic Designer', tone: 'violet' },
  finance:  { label: 'Finance',          tone: 'amber' }
}

export const LEAD_STAGES = [
  { id: 'new',         label: 'New',         tone: 'slate' },
  { id: 'contacted',   label: 'Contacted',   tone: 'blue' },
  { id: 'meeting',     label: 'Meeting',     tone: 'violet' },
  { id: 'proposal',    label: 'Proposal',    tone: 'amber' },
  { id: 'negotiation', label: 'Negotiation', tone: 'orange' },
  { id: 'won',         label: 'Won',         tone: 'green' },
  { id: 'lost',        label: 'Lost',        tone: 'red' }
]

export const LEAD_SOURCES = ['Instagram', 'Facebook', 'WhatsApp', 'Referral', 'Website', 'Google', 'Walk-in', 'Cold call', 'Event', 'LinkedIn', 'Other']

export const INDUSTRIES = ['Restaurant / Café', 'Bakery', 'Retail / Shop', 'Textiles / Fashion', 'Jewellery', 'Real Estate', 'Healthcare / Clinic',
  'Education / Coaching', 'Travel & Tourism', 'Automobile', 'Beauty / Salon', 'Gym / Fitness', 'Construction', 'Electronics', 'Events',
  'Hotel / Resort', 'NGO / Community', 'Politics / Public figure', 'Professional Services', 'Manufacturing', 'Other']

export const SERVICE_TAGS = ['Social Media Management', 'Graphic Design', 'Reels / Video', 'Meta Ads', 'Google Ads', 'SEO', 'Website',
  'Branding / Logo', 'Photography', 'Content Writing', 'Influencer Marketing', 'WhatsApp Marketing', 'Print Design']

export const CLIENT_STATUS = [
  { id: 'onboarding', label: 'Onboarding', tone: 'blue' },
  { id: 'active',     label: 'Active',     tone: 'green' },
  { id: 'paused',     label: 'Paused',     tone: 'amber' },
  { id: 'churned',    label: 'Churned',    tone: 'red' }
]

export const INTERACTION_TYPES = [
  { id: 'call',       label: 'Phone call', icon: 'Phone' },
  { id: 'whatsapp',   label: 'WhatsApp',   icon: 'MessageCircle' },
  { id: 'meeting',    label: 'Meeting',    icon: 'Users' },
  { id: 'visit',      label: 'Site visit', icon: 'MapPin' },
  { id: 'video_call', label: 'Video call', icon: 'Video' },
  { id: 'email',      label: 'Email',      icon: 'Mail' },
  { id: 'note',       label: 'Note',       icon: 'StickyNote' }
]

export const TASK_STATUSES = [
  { id: 'todo',            label: 'To do',          tone: 'slate' },
  { id: 'in_progress',     label: 'In progress',    tone: 'blue' },
  { id: 'internal_review', label: 'Internal review', tone: 'violet' },
  { id: 'client_review',   label: 'Client review',  tone: 'amber' },
  { id: 'revision',        label: 'Revision',       tone: 'orange' },
  { id: 'approved',        label: 'Approved',       tone: 'green' },
  { id: 'delivered',       label: 'Delivered',      tone: 'teal' },
  { id: 'cancelled',       label: 'Cancelled',      tone: 'red' }
]
export const DESIGNER_STATUSES = ['todo', 'in_progress', 'internal_review']

export const TASK_TYPES = ['Social Post', 'Carousel', 'Story', 'Reel', 'Video', 'Motion Graphic', 'Ad Creative', 'Logo', 'Brand Identity',
  'Brochure', 'Flyer', 'Poster', 'Banner / Hoarding', 'Business Card', 'Menu Card', 'Packaging', 'Thumbnail', 'Website Graphic', 'Invitation', 'Other']

export const PLATFORMS = ['Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'WhatsApp', 'X / Twitter', 'Google Business', 'Website', 'Print', 'Other']

export const SIZES = ['1080×1080 (Square)', '1080×1350 (Portrait)', '1080×1920 (Story/Reel)', '1920×1080 (Landscape)', '1280×720 (Thumbnail)',
  '1200×628 (Link/Ad)', 'A4', 'A5', 'A3', 'Custom']

export const PRIORITIES = [
  { id: 'low',    label: 'Low',    tone: 'slate' },
  { id: 'normal', label: 'Normal', tone: 'blue' },
  { id: 'high',   label: 'High',   tone: 'orange' },
  { id: 'urgent', label: 'Urgent', tone: 'red' }
]

export const POST_STATUSES = [
  { id: 'idea',            label: 'Idea',            tone: 'slate' },
  { id: 'copywriting',     label: 'Copywriting',     tone: 'blue' },
  { id: 'in_design',       label: 'In design',       tone: 'violet' },
  { id: 'internal_review', label: 'Internal review', tone: 'violet' },
  { id: 'client_approval', label: 'Client approval', tone: 'amber' },
  { id: 'approved',        label: 'Approved',        tone: 'green' },
  { id: 'scheduled',       label: 'Scheduled',       tone: 'teal' },
  { id: 'published',       label: 'Published',       tone: 'dark' },
  { id: 'cancelled',       label: 'Cancelled',       tone: 'red' }
]
export const POST_TYPES = ['Post', 'Carousel', 'Reel', 'Story', 'Video', 'Ad', 'Blog', 'Live']
export const CONTENT_PILLARS = ['Educational', 'Promotional', 'Engagement', 'Behind the scenes', 'Testimonial', 'Festival / Occasion',
  'Product showcase', 'Offer', 'Announcement', 'Brand story', 'User generated']

export const PROJECT_TYPES = ['Campaign', 'Ads (Meta)', 'Ads (Google)', 'Branding', 'Website', 'Video Shoot', 'Photo Shoot', 'Event', 'SEO', 'Launch', 'Other']
export const PROJECT_STATUS = [
  { id: 'planning',  label: 'Planning',  tone: 'slate' },
  { id: 'active',    label: 'Active',    tone: 'green' },
  { id: 'on_hold',   label: 'On hold',   tone: 'amber' },
  { id: 'completed', label: 'Completed', tone: 'teal' },
  { id: 'cancelled', label: 'Cancelled', tone: 'red' }
]

export const QUERY_CATEGORIES = ['General', 'Design', 'Client', 'Content', 'Brief clarification', 'Files / Access', 'Finance', 'Leave / HR']
export const QUERY_STATUS = [
  { id: 'open',     label: 'Open',     tone: 'amber' },
  { id: 'answered', label: 'Answered', tone: 'blue' },
  { id: 'resolved', label: 'Resolved', tone: 'green' }
]

export const INVOICE_STATUS = [
  { id: 'draft',     label: 'Draft',     tone: 'slate' },
  { id: 'sent',      label: 'Sent',      tone: 'blue' },
  { id: 'partial',   label: 'Partly paid', tone: 'amber' },
  { id: 'paid',      label: 'Paid',      tone: 'green' },
  { id: 'cancelled', label: 'Cancelled', tone: 'red' }
]
export const QUOTE_STATUS = [
  { id: 'draft',    label: 'Draft',    tone: 'slate' },
  { id: 'sent',     label: 'Sent',     tone: 'blue' },
  { id: 'accepted', label: 'Accepted', tone: 'green' },
  { id: 'rejected', label: 'Rejected', tone: 'red' },
  { id: 'expired',  label: 'Expired',  tone: 'amber' }
]
export const PAYMENT_METHODS = ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Card', 'Other']
export const EXPENSE_CATEGORIES = ['Salary', 'Rent', 'Electricity / Water', 'Internet / Phone', 'Software / Subscriptions', 'Ad Spend (Client)',
  'Stock Images / Assets', 'Printing', 'Equipment', 'Travel / Fuel', 'Own Marketing', 'Freelancer', 'Office Supplies', 'Food / Refreshments',
  'Bank Charges / Fees', 'Maintenance', 'Other']
export const BILLING_TYPES = [
  { id: 'monthly', label: 'Monthly' }, { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' }, { id: 'one_time', label: 'One time' }
]

export const byId = (list, id) => list.find((x) => x.id === id) || { id, label: id || '—', tone: 'slate' }
