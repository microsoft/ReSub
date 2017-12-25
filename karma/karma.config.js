module.exports = config => (
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    reporters: ['spec'],
    
    plugins: [
      'karma-phantomjs-launcher',
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

    webpack: {
      devtool: 'inline-source-map',

      resolve: {
        extensions: ['.js', '.ts', 'tsx']
      },

      module: {
        rules: [{ 
          test: /\.tsx?$/, 
          loader: 'awesome-typescript-loader',
          query: {
            inlineSourceMap: true,
            sourceMap: false,
            compilerOptions: {
              removeComments: true
            }
          },
          exclude: [/node_modules/] 
        }]
      },
    },

    webpackMiddleware: {
      quiet: true,
      stats: {
        colors: true
      }
    }
  })
);
