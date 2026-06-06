import { themeColors } from '@transport/shared-theme';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...themeColors,
      }
    },
  },
  plugins: [],
}
