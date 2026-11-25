/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#5B5CE2', 600: '#4A4BCB', 50: '#EEEEFD' },
        violet2: '#8B5CF6',
        ink: '#172033',
        surface: '#FFFFFF',
        canvas: '#F8FAFC',
        ok: '#16A34A',
        warn: '#F59E0B',
        bad: '#DC2626',
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'Noto Sans Tamil', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 6px 24px rgba(23,32,51,0.08)' },
    },
  },
  plugins: [],
};
