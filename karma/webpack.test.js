const { SourceMapDevToolPlugin } = require('webpack');

module.exports = {
    resolve: {
        extensions: ['.js', '.ts', 'tsx']
    },

    module: {
        rules: [{
            test: /\.tsx?$/,
            loader: 'awesome-typescript-loader',
            exclude: /node_modules/
        }]
    },

    plugins: [
        new SourceMapDevToolPlugin({
            filename: null,
            test: /\.(js|ts|tsx)($|\?)/i,
        })
    ]
};
