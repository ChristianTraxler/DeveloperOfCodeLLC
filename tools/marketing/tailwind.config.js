/** @type {import('tailwindcss').Config} */
// Color and font names match the Developer of Code Admin Hub, so the feature drops in without new tokens.
const rgb = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: rgb('ink'),
        panel: rgb('panel'),
        raised: rgb('raised'),
        bone: rgb('bone'),
        mute: rgb('mute'),
        faint: rgb('faint'),
        ember: rgb('ember'),
        live: rgb('live'),
        danger: rgb('danger'),
        line: 'var(--line)',
        line2: 'var(--line2)',
      },
      fontFamily: {
        sans: ['"Mona Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Literata Variable"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
