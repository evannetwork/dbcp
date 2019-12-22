module.exports =  {
  extends: [
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
    'plugin:chai-friendly/recommended',
  ],
  env: {
    browser: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
  },
  plugins: [
    '@typescript-eslint',
    'chai-friendly',
  ],
  rules: {
    // note you must disable the base rule as it can report incorrect errors
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/explicit-function-return-type': ['off'],
    '@typescript-eslint/no-explicit-any': ['off'],
    '@typescript-eslint/no-unused-expressions': 0,
    'chai-friendly/no-unused-expressions': 2,
    // rule additions for airbnb
    'class-methods-use-this': ['off']  // *may* require further adjustments to instance usage
  },
};
