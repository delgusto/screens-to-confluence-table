/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/ui/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        // Figma-native palette so the plugin UI feels at home in Figma
        bg: "#ffffff",
        border: "#e5e5e5",
        muted: "#f5f5f5",
        fg: "#1e1e1e",
        "fg-muted": "#666666",
        accent: "#0d99ff",
        "accent-hover": "#0b87e3",
        danger: "#e03e1a",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
