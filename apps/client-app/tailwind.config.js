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
      },
      fontFamily: {
        "headline-md": ["Montserrat"],
        "headline-lg-mobile": ["Montserrat"],
        "label-lg": ["Inter"],
        "display-lg": ["Montserrat"],
        "headline-lg": ["Montserrat"],
        "body-md": ["Inter"],
        "label-sm": ["Inter"],
        "body-lg": ["Inter"]
      },
      fontSize: {
        "headline-md": ["24px", { "lineHeight": "1.3", "fontWeight": "700" }],
        "headline-lg-mobile": ["28px", { "lineHeight": "1.2", "fontWeight": "800" }],
        "label-lg": ["14px", { "lineHeight": "1.2", "letterSpacing": "0.05em", "fontWeight": "700" }],
        "display-lg": ["56px", { "lineHeight": "1.1", "letterSpacing": "-0.03em", "fontWeight": "800" }],
        "headline-lg": ["36px", { "lineHeight": "1.2", "fontWeight": "800" }],
        "body-md": ["16px", { "lineHeight": "1.5", "fontWeight": "400" }],
        "label-sm": ["12px", { "lineHeight": "1.2", "fontWeight": "600" }],
        "body-lg": ["18px", { "lineHeight": "1.6", "fontWeight": "400" }]
      }
    },
  },
  plugins: [],
}
