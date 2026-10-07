/** @type {import('tailwindcss').Config} */
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { fg: rgb('fg'), muted: rgb('muted'), line: rgb('line'), accent: rgb('accent'), signal: rgb('signal') },
      fontFamily: { display: ['var(--font-display)'], ui: ['var(--font-ui)'] },
    },
  },
  plugins: [],
};
