import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        script: ["var(--font-script)", "monospace"],
      },
      colors: {
        // Semantic tokens used by shared UI components (pricing, etc.)
        background: '#030305',
        foreground: '#F2F2F7',
        // Warm dark "wine" palette — pairs with Tailwind's rose-* for the
        // landing page's rose/blush theme (derived from the footer's
        // #2a0e0e dark glass).
        wine: {
          950: '#12060B',
          900: '#180A10',
          850: '#1D0D14',
          800: '#241019',
          700: '#2A0E0E',
          600: '#3A1B24',
        },
        void: {
          900: '#030305',
          800: '#0A0A10',
          700: '#14141E',
          600: '#1C1C2A',
        },
        hologram: {
          DEFAULT: '#00F0FF',
          muted: '#005D66',
        },
        script: {
          primary: '#F2F2F7',
          secondary: '#8E8E93',
          marker: '#FFCC00',
        }
      },
      backgroundImage: {
        'spatial-grid': 'radial-gradient(circle, #14141E 1px, transparent 1px)',
      },
      animation: {
        'pulse-seq': 'pulse-seq 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        marquee: 'marquee 40s linear infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'draw-line': 'draw-line 2.5s ease forwards',
        ripple: 'ripple 0.65s ease-out forwards',
        'border-beam': 'border-beam calc(var(--duration)*1s) linear infinite',
      },
      keyframes: {
        'pulse-seq': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.2' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'draw-line': {
          '0%': { strokeDashoffset: '300' },
          '100%': { strokeDashoffset: '0' },
        },
        'dash-move': {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '0.6' },
          '100%': { transform: 'scale(1)', opacity: '0' },
        },
        'border-beam': {
          '0%': { offsetDistance: '0%' },
          '100%': { offsetDistance: '100%' },
        },
      }
    },
  },
  plugins: [],
};
export default config;
