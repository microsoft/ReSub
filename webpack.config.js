var path = require('path');
var webpack = require('webpack');

var webpackConfig = {
    entry: './tests/tests.ts',
    
    output: {
        filename: './ReSubTestsPack.js',
    },

    resolve: {
        root: [
            path.resolve('./src'),
            path.resolve('./node_modules')
        ],
        extensions: ['', '.ts', '.tsx', '.js']
    },
    
    module: {
        loaders: [{
            // Compile TS.
            test: /\.tsx?$/, 
            exclude: /node_modules/,
            loader: 'ts-loader'
        }]
    }  
};

module.exports = webpackConfig;
