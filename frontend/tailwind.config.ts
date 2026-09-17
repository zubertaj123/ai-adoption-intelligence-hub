/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          black: '#000000', surface: '#0D0D0D', surface2: '#161616', surface3: '#1E1E1E',
          border: '#252525', border2: '#303030',
          green: '#00D67B', purple: '#5900D0',
          text: '#FFFFFF', dim: '#CCCCCC', muted: '#666666',
          red: '#E03060', amber: '#F0A500', teal: '#00A862',
        }
      },
      fontFamily: {
        sans: ['"Figtree"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif'],
      },
      fontSize: {
        xxs:  ['0.7rem',   { lineHeight: '1.15', fontWeight: '400' }],   /* 14px */
        xs:   ['0.8rem',   { lineHeight: '1.3',  fontWeight: '400' }],   /* 16px */
        sm:   ['0.875rem', { lineHeight: '1.5',  fontWeight: '400' }],   /* 17.5px */
        base: ['1rem',     { lineHeight: '1.5',  fontWeight: '400' }],   /* 20px */
        lg:   ['1.25rem',  { lineHeight: '1.75', fontWeight: '500' }],   /* 25px */
        xl:   ['1.5rem',   { lineHeight: '1.75', fontWeight: '500' }],   /* 30px */
        '2xl': ['2rem',    { lineHeight: '2',    fontWeight: '700' }],   /* 40px */
      },
      width: { sidebar: '250px' },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { boxShadow: '0 0 4px #00D67B' }, '50%': { boxShadow: '0 0 10px #00D67B' } },
      }
    }
  },
  plugins: [],
}