export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          900: '#F1F2F4',
          800: '#FFFFFF',
          700: '#E7E9ED',
          600: '#DCDFE4',
          500: '#C5C9D0',
        },
        amber: {
          DEFAULT: '#C9A227',
          soft: '#E2BE4B',
          deep: '#8F7016',
        },
        ink: '#1E2126',
        muted: '#5F6672',
        ok: '#1E8E5A',
        danger: '#C6373C',
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        box: '4px',
      },
      boxShadow: {
        lift: '0 12px 30px -20px rgba(16,18,22,0.35)',
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
