/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './intake.html', './products.html', './notify.html', './pricing.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--surface-2) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        rule: 'rgb(var(--rule) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        lamp: 'rgb(var(--c-lamp) / <alpha-value>)',
        // Pricing page palette (src/pricing/styles.css defines the variables)
        night: 'rgb(var(--c-night) / <alpha-value>)',
        deep: 'rgb(var(--c-deep) / <alpha-value>)',
        dusk: 'rgb(var(--c-dusk) / <alpha-value>)',
        dusk2: 'rgb(var(--c-dusk-2) / <alpha-value>)',
        snow: 'rgb(var(--c-snow) / <alpha-value>)',
        'snow-muted': 'rgb(var(--c-snow-muted) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--c-ink-muted) / <alpha-value>)',
        sand: 'rgb(var(--c-sand) / <alpha-value>)',
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        'lamp-ink': 'rgb(var(--c-lamp-ink) / <alpha-value>)',
        live: 'rgb(var(--c-live) / <alpha-value>)',
      },
      maxWidth: { page: '76rem' },
      fontFamily: {
        serif: ['"Literata DOC"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['"Mona Sans DOC"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
