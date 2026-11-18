export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Los colores salen de variables CSS (src/index.css) para poder cambiar
      // entre tema claro y oscuro sin tocar las clases de los componentes.
      colors: {
        graphite: {
          900: 'rgb(var(--c-g900) / <alpha-value>)',
          800: 'rgb(var(--c-g800) / <alpha-value>)',
          700: 'rgb(var(--c-g700) / <alpha-value>)',
          600: 'rgb(var(--c-g600) / <alpha-value>)',
          500: 'rgb(var(--c-g500) / <alpha-value>)',
        },
        amber: {
          DEFAULT: 'rgb(var(--c-amber) / <alpha-value>)',
          soft: 'rgb(var(--c-amber-soft) / <alpha-value>)',
          deep: 'rgb(var(--c-amber-deep) / <alpha-value>)',
          texto: 'rgb(var(--c-amber-texto) / <alpha-value>)',
        },
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        'sobre-amber': 'rgb(var(--c-sobre-amber) / <alpha-value>)',
        'sobre-ok': 'rgb(var(--c-sobre-ok) / <alpha-value>)',
        serie: {
          1: 'rgb(var(--c-serie-1) / <alpha-value>)',
          2: 'rgb(var(--c-serie-2) / <alpha-value>)',
          3: 'rgb(var(--c-serie-3) / <alpha-value>)',
          4: 'rgb(var(--c-serie-4) / <alpha-value>)',
        },
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
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'sheet-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bay-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Testigo del tablero que se enciende (LucesTema).
        'luz-on': {
          '0%': { opacity: '0.35' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'bay-in': 'bay-in 420ms cubic-bezier(0.2, 0.7, 0.3, 1)',
        'fade-in': 'fade-in 200ms ease-out',
        'luz-on': 'luz-on 260ms ease-out',
        'pop-in': 'pop-in 160ms cubic-bezier(0.2, 0.7, 0.3, 1)',
        'sheet-up': 'sheet-up 220ms cubic-bezier(0.2, 0.7, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
