/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './intake.html', './products.html', './notify.html', './src/**/*.{js,jsx}'],
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
      },
      fontFamily: {
        serif: ['"Literata DOC"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['"Mona Sans DOC"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
