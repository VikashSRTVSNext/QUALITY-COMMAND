/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: '#08111a',
          panelBg: '#0e1424',
          border: '#1d324b',
          text: '#f8fafc',
          muted: '#97a7bb',
          primary: '#005aff',
          success: '#10b981',
          warning: '#eab308',
          danger: '#ef4444',
          info: '#06b6d4',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glowPrimary: '0 0 15px rgba(0, 90, 255, 0.35)',
        glowSuccess: '0 0 15px rgba(16, 185, 129, 0.35)',
        glowWarning: '0 0 15px rgba(234, 179, 8, 0.35)',
        glowDanger: '0 0 15px rgba(239, 68, 68, 0.5)',
      }
    },
  },
  plugins: [],
}
