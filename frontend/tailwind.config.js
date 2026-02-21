export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        foreground: 'var(--fg)',
        primary: 'var(--primary)',
        muted: 'var(--fg-muted)',
      }
    },
  },
  plugins: [],
}