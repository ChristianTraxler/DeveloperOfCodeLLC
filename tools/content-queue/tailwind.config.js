/** @type {import('tailwindcss').Config} */
// Hub color names and values (same as Marketing), so Content Queue matches the Admin Hub.
// well, ember.soft/deep, paper, ink2 and slate are the extras Content Queue adds.
const rgb = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: rgb('ink'),
        panel: rgb('panel'),
        raised: rgb('raised'),
        well: rgb('well'),
        bone: rgb('bone'),
        mute: rgb('mute'),
        faint: rgb('faint'),
        ember: { DEFAULT: rgb('ember'), soft: 'rgba(255, 90, 31, 0.12)', deep: '#d9480f' },
        live: rgb('live'),
        danger: rgb('danger'),
        line: 'var(--line)',
        line2: 'var(--line2)',
        paper: '#f6f5f2',
        ink2: '#1d1c1a',
        slate: '#6b6a66',
      },
      fontFamily: {
        sans: ['"Mona Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Literata Variable"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        slidein: { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        sheet: { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        rise: 'rise .32s cubic-bezier(.2,.7,.2,1) both',
        fade: 'fade .2s ease-out both',
        slidein: 'slidein .28s cubic-bezier(.2,.7,.2,1) both',
        sheet: 'sheet .28s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
}
