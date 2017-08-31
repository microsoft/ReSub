var path = require('path');
var webpack = require('webpack');

var webpackConfig = {
    entry: './tests/tests.ts',
    
    output: {
        filename: './ReSubTestsPack.js',
    },

    resolve: {
        modules: [
            path.resolve('./src'),
            path.resolve('./node_modules')
        ],
        extensions: ['.ts', '.tsx', '.js']
    },
    
    module: {
        rules: [{
            // Compile TS.
            test: /\.tsx?$/, 
            exclude: /node_modules/,
            loader: 'awesome-typescript-loader'
        }]
    }  
};

module.exports = webpackConfig;
