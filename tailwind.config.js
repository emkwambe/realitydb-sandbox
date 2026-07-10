/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#06070a',
        'bg-elevated': '#0c0d12',
        'bg-card': '#12141a',
        accent: '#22d3ee',
        green: '#00e5a0',
        amber: '#ffb444',
        purple: '#a78bfa',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
