const path = require('path')

module.exports = {
  target: 'electron-main',
  entry: './electron/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'main.js'
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
  },
  externals: {
    electron: 'commonjs electron'
  }
}
