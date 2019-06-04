module.exports = {
	presets: [
		'@babel/preset-react',
		'@babel/preset-flow',
		[
			'@babel/preset-env',
			{
				modules: 'cjs',
				targets: {
					node: '8.0.0',
				},
			},
		],
	],
};
