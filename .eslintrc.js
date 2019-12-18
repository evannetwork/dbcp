module.exports =  {
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    // note you must disable the base rule as it can report incorrect errors
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/explicit-function-return-type': ['off'],
    '@typescript-eslint/no-explicit-any': ['off'],
    // rule additions for airbnb
    'class-methods-use-this': ['off']  // *may* require further adjustments to instance usage
  },
};
