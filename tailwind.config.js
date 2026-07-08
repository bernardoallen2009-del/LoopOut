/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F6F9FF',
        card: 'rgba(255,255,255,0.66)',
        primary: '#3C76F9',
        deep: '#123FBC',
        soft: 'rgba(157,187,254,0.2)',
        ink: '#071B45',
        muted: '#42609B',
        line: 'rgba(157,187,254,0.42)',
        loopoutStone: '#9DBBFE',
        loopoutBg: '#F6F9FF',
        loopoutText: '#071B45',
        loopoutMuted: '#42609B',
        loopoutGlass: 'rgba(255,255,255,0.48)',
        activeBlue: '#3C76F9',
      },
      boxShadow: {
        soft: '0 22px 64px rgba(60,118,249,0.14)',
        lift: '0 16px 38px rgba(60,118,249,0.18)',
        ios: '0 22px 64px rgba(60,118,249,0.14)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
