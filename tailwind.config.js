/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F7F4',
        card: 'rgba(255,255,255,0.62)',
        primary: '#2F312D',
        deep: '#111111',
        soft: 'rgba(195,196,191,0.22)',
        ink: '#111111',
        muted: '#6F716D',
        line: 'rgba(195,196,191,0.38)',
        loopoutStone: '#C3C4BF',
        loopoutBg: '#F7F7F4',
        loopoutText: '#111111',
        loopoutMuted: '#6F716D',
        loopoutGlass: 'rgba(255,255,255,0.42)',
        activeBlue: '#6EA8FE',
      },
      boxShadow: {
        soft: '0 20px 60px rgba(0,0,0,0.08)',
        lift: '0 14px 34px rgba(0,0,0,0.10)',
        ios: '0 20px 60px rgba(0,0,0,0.08)',
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
