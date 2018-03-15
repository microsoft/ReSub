import * as webpack from 'webpack';
import * as path from 'path';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';

const DIST_PATH: string = path.join(__dirname, 'dist');
const APP_PATH: string = path.join(__dirname, 'src');

const config: webpack.Configuration = {
    entry: APP_PATH,
    output: {
        filename: 'bundle.js',
        path: DIST_PATH,
    },

    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },

    module: {
        rules: [
            { test: /\.tsx?$/, loader: 'ts-loader' }
        ]
    },

    plugins: [
        new webpack.NamedModulesPlugin(),
        new HtmlWebpackPlugin({
            inject: true,
            template:  path.join(APP_PATH, 'template.html'),
        }),
    ],

    devServer: {
        contentBase: APP_PATH,
        openPage: '',
        open: true,
        port: 9999,
        stats: 'minimal',
    },
};

export default config;
