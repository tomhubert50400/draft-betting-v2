export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f0f17',
          secondary: '#1c1c2e',
          card: '#1a1a2e',
          hover: '#252540',
        },
        accent: {
          purple: '#7c3aed',
          pink: '#ec4899',
          cyan: '#06b6d4',
        },
        text: {
          primary: '#f0f0f0',
          secondary: '#a0a0b8',
          muted: '#666680',
        },
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(90deg, #7c3aed, #ec4899)',
        'gradient-bg': 'linear-gradient(135deg, #0f0f17 0%, #1c1c2e 50%, #2a1a3e 100%)',
      },
    },
  },
  plugins: [],
};
