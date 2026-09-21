/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta Boxly: taller mecánico (grafito + ámbar de señalización)
        graphite: {
          900: '#101216',
          800: '#16191F',
          700: '#1D2127',
          600: '#262B33',
          500: '#333944',
        },
        amber: {
          DEFAULT: '#F5A524',
          soft: '#FFD08A',
          deep: '#B87407',
        },
        ink: '#E9EBEF',
        muted: '#8C94A1',
        ok: '#3FB27F',
        danger: '#E5484D',
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        box: '4px',
      },
      boxShadow: {
        lift: '0 18px 40px -24px rgba(0,0,0,0.75)',
      },
      keyframes: {
        'bay-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'bay-in': 'bay-in 420ms cubic-bezier(0.2, 0.7, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
