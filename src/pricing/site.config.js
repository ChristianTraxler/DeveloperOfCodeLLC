// Settings you are likely to change before this page goes live.

export const site = {
  // Where links to the rest of the site point. Use '' once this page lives inside developerofcode.com.
  base: '',
  intake: '/intake.html', // "Start your project"
  consult: '/consult.html', // "Book a free consultation"
  email: 'DeveloperOfCodeLLC@Gmail.com',
  phone: '(828) 781-4674',
  phoneHref: 'tel:+18287814674',
  support: 'https://support.developerofcode.com',

  // Shows a small "Preview" tag in the header. Set to false when the page goes live.
  preview: false,

  // The estimator tells people to ask for a written quote when either limit is passed.
  // The handoff lists the $1,500 line as proposed, so the number is never printed on the page.
  customQuote: { aboveSetup: 1500, addOnCount: 3 },
}

export const url = (path) => (path.startsWith('http') || path.startsWith('mailto') || path.startsWith('tel') ? path : site.base + path)
