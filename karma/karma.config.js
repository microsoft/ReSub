const webpack = require('./webpack.test');

module.exports = config => (
    config.set({
        basePath: '',
        frameworks: ['jasmine'],
        reporters: ['spec', 'kjhtml'],

        plugins: [
            'karma-jasmine-html-reporter',
            'karma-sourcemap-loader',
            'karma-chrome-launcher',
            'karma-spec-reporter',
            'karma-jasmine',
            'karma-webpack',
        ],

        preprocessors: {
            './karma/karma.entry.js': ['webpack', 'sourcemap'],
        },

        files: [
            { pattern: './karma/karma.entry.js', watched: false },
        ],

        logLevel: config.LOG_INFO,
        colors: true,
        mime: {
            'text/x-typescript': ['ts', 'tsx'],
        },

        webpack,

        webpackMiddleware: {
            stats: 'errors-only',
        }
    })
);
