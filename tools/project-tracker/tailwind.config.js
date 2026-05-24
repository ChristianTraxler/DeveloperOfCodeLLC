/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Real developerofcode.com palette
        bg: {
          deep: '#060a13',
          primary: '#0a0e17',
          surface: '#111827',
          card: '#1a2236',
          'card-hover': '#1f2a42',
        },
        accent: {
          DEFAULT: '#ff4500',
          dim: '#cc3700',
          hover: '#ff6a33',
        },
        ink: {  // kept for compat with existing class names; mapped to DOC text scale
          950: '#060a13',
          900: '#0a0e17',
          800: '#111827',
          700: '#1a2236',
          600: '#1f2a42',
          500: '#484f58',
        },
        bone: '#e6edf3',
        muted: '#8b949e',
        faint: '#484f58',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Sans"', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 24px -4px rgba(255, 69, 0, 0.3)',
        'glow-lg': '0 8px 28px -8px rgba(255, 69, 0, 0.35)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
