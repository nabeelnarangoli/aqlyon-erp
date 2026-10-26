import react from 'eslint-plugin-react'
import hooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
export default [{
  files: ['src/**/*.{js,jsx}'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser }, parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { react, 'react-hooks': hooks },
  settings: { react: { version: '18' } },
  rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { varsIgnorePattern: '^_|^React$' }], 'react/jsx-uses-vars': 'error', 'react/jsx-no-undef': 'error', 'react-hooks/rules-of-hooks': 'error' }
}]
