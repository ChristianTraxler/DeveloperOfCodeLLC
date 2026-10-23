/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './intake.html', './products.html', './notify.html', './pricing.html', './video.html', './src/**/*.{js,jsx}'],
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
        // /video page palette (night, ink and paper above are shared with the site tokens)
        navy: { DEFAULT: '#112448', 700: '#0E1D3B', 500: '#1C3366', 300: '#3A548F' },
        cobalt: '#2B45A6',
        ember: { DEFAULT: '#F07A45', deep: '#B4491D', soft: '#F6A178' },
        signal: '#4CC38A',
        bone: '#EAE3D6',
        mute: '#5B6478',
        fog: '#A9B3C9',
      },
      maxWidth: { page: '76rem' },
      boxShadow: {
        phone: '0 40px 80px -30px rgba(3,8,22,.75), 0 0 0 1px rgba(255,255,255,.06)',
        card: '0 1px 0 rgba(18,26,43,.04), 0 18px 40px -24px rgba(18,26,43,.35)',
      },
      keyframes: {
        drift: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        rise: { from: { opacity: 0, transform: 'translateY(18px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        drift: 'drift 7s ease-in-out infinite',
        rise: 'rise .8s cubic-bezier(.2,.7,.2,1) both',
      },
      fontFamily: {
        display: ['"Literata DOC"', 'Georgia', 'serif'],
        serif: ['"Literata DOC"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['"Mona Sans DOC"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
