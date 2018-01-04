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

  devtool: 'cheap-source-map',

  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },

  module: {
    loaders: [
      { test: /\.tsx?$/, loader: 'awesome-typescript-loader' }
    ]
  },

  plugins: [
    new webpack.NamedModulesPlugin(),
    new HtmlWebpackPlugin({
      inject: true,
      template:  path.join(APP_PATH, 'template.html'),
    }),
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      },
    })
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
