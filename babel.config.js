module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (Expo SDK 54) also adds the react-native-reanimated plugin.
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.js', '.json'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
    env: {
      production: {
        plugins: ['react-native-paper/babel'],
      },
    },
  };
};
