/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7FBFF',
        card: '#FFFFFF',
        primary: '#007AFF',
        deep: '#0A3D91',
        soft: '#EAF4FF',
        ink: '#0B1220',
        muted: '#667085',
        line: '#D8E8F8',
      },
      boxShadow: {
        soft: '0 20px 60px rgba(10, 61, 145, 0.10)',
        lift: '0 12px 36px rgba(11, 18, 32, 0.10)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
