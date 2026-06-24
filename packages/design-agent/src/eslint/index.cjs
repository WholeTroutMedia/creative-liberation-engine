// packages/design-agent/src/eslint/index.cjs
// ESLint plugin entry point — @cle/design-agent/eslint

'use strict';

const noLiteralCssValues = require('./no-literal-css-values.cjs');

/** @type {import('eslint').ESLint.Plugin} */
module.exports = {
    meta: {
        name: '@cle/design-agent',
        version: '1.0.0',
    },
    rules: {
        'no-literal-css-values': noLiteralCssValues,
    },
    configs: {
        recommended: {
            plugins: ['@cle/design-agent'],
            rules: {
                '@cle/design-agent/no-literal-css-values': 'error',
            },
        },
    },
};
