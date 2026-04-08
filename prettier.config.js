/** @type {import("prettier").Config} */
export default {
    singleQuote: true,
    tabWidth: 4,
    semi: true,
    trailingComma: 'all',
    arrowParens: 'always',
    printWidth: 120,
    endOfLine: 'auto',
    plugins: ['prettier-plugin-tailwindcss'],
};
