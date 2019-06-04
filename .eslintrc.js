module.exports = {
	env: {
		browser: true,
		node: true,
		es6: true,
	},
	extends: [
		'eslint:recommended',
		'plugin:flowtype/recommended',
		'plugin:react/recommended',
	],
	plugins: ['react', 'react-hooks', 'flowtype'],
	rules: {
		'react-hooks/rules-of-hooks': 'error',
		'react-hooks/exhaustive-deps': 'warn',
	},
};
