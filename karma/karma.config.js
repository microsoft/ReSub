const webpack = require('./webpack.test');

module.exports = config => (
    config.set({
        basePath: '',
        frameworks: ['jasmine'],
        reporters: ['spec', 'kjhtml'],
        browsers: [
            process.env.TRAVIS
                ? 'ChromeHeadlessNoSandbox'
                : 'Chrome',
        ],
        plugins: [
            'karma-jasmine-html-reporter',
            'karma-sourcemap-loader',
            'karma-chrome-launcher',
            'karma-spec-reporter',
            'karma-jasmine',
            'karma-webpack',
        ],

        customLaunchers: {
            ChromeHeadlessNoSandbox: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox'],
            }
        },

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
