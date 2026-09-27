// The project intake form. Every field keeps the exact name the original developerofcode.com form
// sends through Web3Forms, so submissions keep arriving in the same format.

export const WEB3FORMS = {
  endpoint: 'https://api.web3forms.com/submit',
  accessKey: 'caf43c82-c0f7-4ea8-ad90-56d4075f0be3',
  subject: 'New Website Project Intake Submission',
  fromName: 'developerofcode.com Intake Form',
}

// Picking any of these features turns on the online store section.
export const STORE_TRIGGERS = [
  'E-commerce/Online store',
  'Shopping cart & checkout',
  'Product catalog with inventory',
  'Payment processing',
]

const opts = (list) => list.map((item) => (typeof item === 'string' ? { value: item, label: item } : item))
const YES_NO = opts(['Yes', 'No'])
const YES_NO_UNSURE = opts(['Yes', 'No', 'Unsure'])

export const sections = [
  {
    id: 'you',
    title: 'About you',
    fields: [
      { kind: 'text', name: 'Full Name', label: 'Full name', required: true, error: 'Enter your full name.', autoComplete: 'name', span: 'half' },
      { kind: 'text', name: 'Company', label: 'Company or organization', required: true, error: 'Enter your company or organization.', autoComplete: 'organization', span: 'half' },
      { kind: 'email', name: 'Email', label: 'Email', required: true, error: 'Enter your email address.', autoComplete: 'email', span: 'half' },
      { kind: 'tel', name: 'Phone', label: 'Phone', required: true, error: 'Enter your phone number.', autoComplete: 'tel', span: 'half' },
      { kind: 'url', name: 'Current Website', label: 'Current website', hint: 'If you have one.', placeholder: 'https://', autoComplete: 'url' },
    ],
  },
  {
    id: 'project',
    title: 'Your project',
    fields: [
      { kind: 'textarea', name: 'Business Description', label: 'Tell me about your business or organization', required: true, error: 'Tell me a little about your business.', rows: 4 },
      { kind: 'textarea', name: 'Primary Goal', label: 'What’s the main goal for this website?', hint: 'More calls, online bookings, selling products, looking more established. Whatever matters most.', required: true, error: 'Share the main goal for the site.', rows: 3 },
      { kind: 'textarea', name: 'Target Audience', label: 'Who are your customers or visitors?', rows: 3 },
    ],
  },
  {
    id: 'pages',
    title: 'Pages and features',
    fields: [
      {
        kind: 'cards', name: 'Page Count', label: 'How many pages will you need?', required: true, error: 'Choose how many pages you need.', cols: 4,
        options: [
          { value: '1-3 pages (simple site)', label: '1 to 3 pages', detail: 'Simple site' },
          { value: '4-7 pages (standard site)', label: '4 to 7 pages', detail: 'Standard site' },
          { value: '8-15 pages (medium site)', label: '8 to 15 pages', detail: 'Medium site' },
          { value: '16+ pages (large site)', label: '16 or more', detail: 'Large site' },
        ],
      },
      {
        kind: 'chips', name: 'Page Types', label: 'Which pages do you need?', hint: 'Choose all that apply.',
        options: opts([
          'Home page', { value: 'About Us', label: 'About us' }, { value: 'Services/Products', label: 'Services or products' },
          'Contact page', 'Blog', { value: 'Portfolio/Gallery', label: 'Portfolio or gallery' }, 'FAQ',
          { value: 'Team/Staff', label: 'Team or staff' }, 'Testimonials', 'Pricing',
          { value: 'Resources/Downloads', label: 'Resources or downloads' },
        ]),
      },
      { kind: 'text', name: 'Other Pages', label: 'Any other pages?' },
      {
        kind: 'chips', name: 'Functionality', label: 'What should the site be able to do?', hint: 'Choose all that apply.',
        options: opts([
          'Contact form', { value: 'E-commerce/Online store', label: 'Online store' },
          { value: 'Shopping cart & checkout', label: 'Cart and checkout' }, 'Product catalog with inventory',
          'Database integration', { value: 'User accounts/login', label: 'User accounts and login' }, 'Payment processing',
          { value: 'Booking/Scheduling system', label: 'Booking and scheduling' }, { value: 'Search functionality', label: 'Site search' },
          { value: 'Newsletter/Email signup', label: 'Newsletter signup' }, 'Social media integration',
          { value: 'Live chat support', label: 'Live chat' }, { value: 'Multi-language support', label: 'Multiple languages' },
          { value: 'Blog/News section', label: 'Blog or news' }, 'Member portal',
          { value: 'Photo/Video gallery', label: 'Photo or video gallery' }, { value: 'Customer reviews/ratings', label: 'Customer reviews' },
          'Live streaming',
        ]),
      },
      { kind: 'text', name: 'Other Functionality', label: 'Anything else it should do?' },
    ],
  },
  {
    id: 'store',
    title: 'Online store',
    gate: {
      label: 'I’ll be selling online',
      off: 'Skip this unless you’ll sell products on the site. Choosing a store feature above turns it on.',
    },
    fields: [
      { kind: 'number', name: 'Product Count', label: 'About how many products?', span: 'half', min: 0, inputMode: 'numeric' },
      { kind: 'text', name: 'Payment Methods', label: 'Payment methods', hint: 'For example cards, PayPal, or Apple Pay.', span: 'half' },
      { kind: 'segmented', name: 'Inventory Tracking', label: 'Inventory tracking?', options: YES_NO_UNSURE, span: 'half' },
      { kind: 'segmented', name: 'Shipping Integration', label: 'Shipping integration?', options: YES_NO_UNSURE, span: 'half' },
      { kind: 'textarea', name: 'E-commerce Special Requirements', label: 'Anything special about your store?', rows: 3 },
    ],
  },
  {
    id: 'design',
    title: 'Look and feel',
    fields: [
      { kind: 'segmented', name: 'Brand Guidelines', label: 'Do you have brand guidelines?', options: YES_NO },
      {
        kind: 'colors', names: ['Primary Color', 'Secondary Color', 'Accent Color'], labels: ['Primary', 'Secondary', 'Accent'],
        label: 'Brand colors', hint: 'Pick a color or type a hex code. Leave these blank if you don’t have colors yet.',
      },
      {
        kind: 'chips', name: 'Design Style', label: 'Which styles feel right?', hint: 'Choose all that apply.',
        options: [
          { value: 'Modern/Minimalist', label: 'Modern and minimal' },
          { value: 'Classic/Traditional', label: 'Classic and traditional' },
          { value: 'Bold/Creative', label: 'Bold and creative' },
          { value: 'Professional/Corporate', label: 'Professional and corporate' },
          { value: 'Playful/Fun', label: 'Playful and fun' },
          { value: 'Elegant/Luxury', label: 'Elegant and luxurious' },
        ],
      },
      { kind: 'text', name: 'Other Style', label: 'Other style notes' },
      {
        kind: 'urls', names: ['Inspiration URL 1', 'Inspiration URL 2', 'Inspiration URL 3'],
        label: 'Websites you like', hint: 'Up to three links to sites whose look or feel you like.',
      },
    ],
  },
  {
    id: 'content',
    title: 'Content and media',
    fields: [
      {
        kind: 'chips', name: 'Content Provided', label: 'What can you provide?', hint: 'Choose all that apply.',
        options: opts([
          { value: 'Logo (existing)', label: 'Existing logo' }, { value: 'Written content/copy', label: 'Written copy' },
          'Professional photos', 'Product images', 'Videos', { value: 'Graphics/Icons', label: 'Graphics or icons' },
        ]),
      },
      {
        kind: 'chips', name: 'Services Needed', label: 'Where would you like help?', hint: 'Choose all that apply.',
        options: opts(['Logo design', 'Copywriting', 'Professional photography', 'Stock images', 'Video production', 'Content strategy']),
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical details',
    intro: 'Not sure about any of these? Leave them blank and I’ll walk you through them.',
    fields: [
      {
        kind: 'cards', name: 'Domain Status', label: 'Domain name', cols: 2,
        options: [
          { value: 'I have a domain', label: 'I have a domain', detail: 'Already registered' },
          { value: 'I need help purchasing a domain', label: 'I need one', detail: 'Help me buy a domain' },
        ],
      },
      { kind: 'text', name: 'Domain Name', label: 'Which domain?', placeholder: 'yourbusiness.com', showIf: { name: 'Domain Status', equals: 'I have a domain' } },
      {
        kind: 'cards', name: 'Hosting Status', label: 'Web hosting', cols: 2,
        options: [
          { value: 'I have hosting', label: 'I have hosting', detail: 'Already set up' },
          { value: 'I need hosting services', label: 'I need hosting', detail: 'Host it for me' },
        ],
      },
      {
        kind: 'choiceChips', name: 'CMS Preference', label: 'Platform preference',
        options: opts(['WordPress', 'Shopify', { value: 'Wix/Squarespace', label: 'Wix or Squarespace' }, 'Custom-built', { value: 'No preference (please recommend)', label: 'No preference, recommend one' }]),
      },
      { kind: 'text', name: 'Other CMS', label: 'Another platform?' },
      { kind: 'segmented', name: 'Mobile Optimization', label: 'Mobile optimization?', options: YES_NO, span: 'third' },
      { kind: 'segmented', name: 'SEO Needed', label: 'SEO services?', options: YES_NO_UNSURE, span: 'third' },
      { kind: 'segmented', name: 'Analytics', label: 'Analytics or tracking?', options: YES_NO_UNSURE, span: 'third' },
    ],
  },
  {
    id: 'timeline',
    title: 'Timeline and budget',
    fields: [
      { kind: 'date', name: 'Target Date', label: 'Target launch date', span: 'half' },
      { kind: 'segmented', name: 'Date Flexible', label: 'Is that date flexible?', options: YES_NO, span: 'half' },
      { kind: 'segmented', name: 'Has Event Deadline', label: 'Is an event or deadline driving it?', options: YES_NO },
      { kind: 'textarea', name: 'Event Description', label: 'Tell me about the event or deadline', rows: 3, showIf: { name: 'Has Event Deadline', equals: 'Yes' } },
      {
        kind: 'cards', name: 'Project Timeframe', label: 'Preferred timeframe', required: true, error: 'Choose a timeframe.', cols: 4,
        options: [
          { value: 'Rush (2-4 weeks)', label: 'Rush', detail: '2 to 4 weeks' },
          { value: 'Standard (1-2 months)', label: 'Standard', detail: '1 to 2 months' },
          { value: 'Extended (3-4 months)', label: 'Extended', detail: '3 to 4 months' },
          { value: 'Flexible / No specific deadline', label: 'Flexible', detail: 'No set deadline' },
        ],
      },
      {
        kind: 'cards', name: 'Budget', label: 'Estimated budget', required: true, error: 'Choose a budget range.', cols: 3,
        options: [
          { value: 'Under $1,000', label: 'Under $1,000' },
          { value: '$1,000 - $3,000', label: '$1,000 to $3,000' },
          { value: '$3,000 - $5,000', label: '$3,000 to $5,000' },
          { value: '$5,000 - $10,000', label: '$5,000 to $10,000' },
          { value: '$10,000+', label: '$10,000 or more' },
          { value: 'Not sure yet', label: 'Not sure yet' },
        ],
      },
    ],
  },
  {
    id: 'care',
    title: 'After launch',
    fields: [
      { kind: 'segmented', name: 'Ongoing Maintenance', label: 'Ongoing updates and maintenance?', options: YES_NO_UNSURE, span: 'half' },
      { kind: 'segmented', name: 'Training Needed', label: 'Training to edit the site yourself?', options: YES_NO, span: 'half' },
      { kind: 'textarea', name: 'Maintenance Needs', label: 'Anything specific you’ll need help with?', rows: 3 },
    ],
  },
  {
    id: 'more',
    title: 'Anything else',
    fields: [
      { kind: 'textarea', name: 'Competitors', label: 'Competitors’ websites', hint: 'Links to sites you compete with, for reference.', rows: 3 },
      { kind: 'textarea', name: 'Other Details', label: 'Anything else I should know?', rows: 4 },
    ],
  },
]

export const requiredFields = sections.flatMap((section) => section.fields.filter((field) => field.required))
