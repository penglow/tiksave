/**
 * Metro bundler config — Expo defaults plus share-extension wrapper and Zustand resolution fix.
 * @see https://docs.expo.dev/guides/customizing-metro
 */
const { getDefaultConfig } = require('expo/metro-config');
const { withShareExtension } = require('expo-share-extension/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Zustand package.json "exports" can confuse Metro; force the CJS entry.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand') {
    return context.resolveRequest(context, 'zustand/index.js', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withShareExtension(config, {
  isCSSEnabled: true,
});
