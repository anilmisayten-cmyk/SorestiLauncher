const path = require('path')

module.exports = {
  target: 'electron-preload',
  entry: './electron/preload.ts',
  output: {
    path: path.resolve(__dirname, 'dist/preload'),
    filename: 'index.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: { electron: '31' }, modules: 'commonjs' }],
              '@babel/preset-typescript'
            ]
          }
        }
      }
    ]
  }
}
