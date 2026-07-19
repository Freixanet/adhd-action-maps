/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        base: '#181A1F',
        surface: {
          DEFAULT: '#24262D',
          2: '#2C2E37',
        },
        primary: '#FAFAFA',
        body: '#D4D4DC',
        secondary: '#9CA0AB',
        accent: {
          DEFAULT: '#8B8FF5',
          pressed: '#7A7EE0',
        },
        sem: {
          clave: '#8B8FF5',
          matiz: '#E0B45C',
          ejemplo: '#6FBF8F',
          alerta: '#E07A6B',
        },
      },
      borderRadius: {
        card: '16px',
        chip: '12px',
        cta: '24px',
      },
    },
  },
  plugins: [],
}
