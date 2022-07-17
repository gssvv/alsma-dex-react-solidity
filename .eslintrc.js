module.exports = {
  env: {
    node: true,
    mocha: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'airbnb-base',
  ],
  rules: {
    radix: [0],
    'import/extensions': [0],
    'import/no-unresolved': [0],
    'import/prefer-default-export': [0],
    'import/no-dynamic-require': [0],
    'import/no-extraneous-dependencies': [0],
    'import/no-mutable-exports': [0],
    'global-require': [0],
    'max-classes-per-file': [0],
    'class-methods-use-this': [0],
    'no-sequences': [0],
    'no-async-promise-executor': [0],

    camelcase: [0],
    'func-names': [0],
    'no-restricted-globals': [0],
    'no-nested-ternary': [0],
    'no-param-reassign': [0],
    'linebreak-style': [0],
    'prefer-rest-params': [0],
    'no-return-await': [0],
    'no-await-in-loop': [0],
    'no-underscore-dangle': [0],
    'no-console': 0,
    'no-alert': 1,

    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
  },
};
