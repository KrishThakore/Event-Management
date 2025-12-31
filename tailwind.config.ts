import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import scrollbar from 'tailwind-scrollbar';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'sans-serif']
      }
    }
  },
  plugins: [forms, scrollbar]
};

export default config;
