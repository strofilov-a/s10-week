// The developers' stack: webpack 5, ts-loader, style-loader + css-loader, nothing else.
const path = require('path');
module.exports = {
  mode: 'production',
  context: __dirname,
  entry: './harness.tsx',
  output: { path: path.join(__dirname, 'dist'), filename: 'app.js' },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  module: { rules: [
    { test: /\.tsx?$/, loader: 'ts-loader', options: { configFile: path.join(__dirname, 'tsconfig.json'), onlyCompileBundledFiles: true } },
    { test: /\.css$/, use: ['style-loader', 'css-loader'] },
  ] },
  performance: { hints: false },
};
