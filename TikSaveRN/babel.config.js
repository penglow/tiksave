/**
 * Babel config for Expo. Reanimated plugin must stay last in the plugins array.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
