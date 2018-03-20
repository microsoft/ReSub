const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const path = require('path');
const ROOT_PATH = path.resolve(__dirname, '..');
const CONFIG_PATH = path.resolve(ROOT_PATH, 'tsconfig.test.json');

module.exports = {
    devtool: 'inline-source-map',
    mode: 'development',

    resolve: {
        extensions: ['.js', '.ts', 'tsx']
    },

    module: {
        rules: [{
            test: /\.tsx?$/,
            loader: 'ts-loader',
            options: {
                transpileOnly: true,
                configFile: CONFIG_PATH,
                context: ROOT_PATH,
            },
            exclude: /node_modules/
        }]
    },

    plugins: [
        new ForkTsCheckerWebpackPlugin({ tsconfig: CONFIG_PATH }),
    ]
};
