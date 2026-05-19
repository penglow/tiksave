/**
 * Dynamic Expo config — merges app.json with env-driven Google Maps API key for Android/web.
 */
const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

// --- Env helpers --------------------------------------------------------------

/** Read a single KEY=value from a .env-style file (no dotenv dependency). */
const readEnvValue = (filePath, key) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const line = content
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${key}=`));

    if (!line) return '';

    const rawValue = line.slice(line.indexOf('=') + 1).trim();
    return rawValue.replace(/^['"]|['"]$/g, '');
  } catch {
    return '';
  }
};

// --- Resolved secrets ---------------------------------------------------------

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  readEnvValue(path.join(__dirname, '..', 'backend', '.env'), 'GOOGLE_MAPS_API_KEY');

// --- Expo config export -------------------------------------------------------

module.exports = ({ config } = {}) => {
  const baseConfig = config || appJson.expo;

  return {
    ...baseConfig,
    ios: baseConfig.ios,
    android: {
      ...baseConfig.android,
      config: {
        ...(baseConfig.android?.config || {}),
        ...(googleMapsApiKey
          ? {
              googleMaps: {
                ...(baseConfig.android?.config?.googleMaps || {}),
                apiKey: googleMapsApiKey,
              },
            }
          : {}),
      },
    },
    extra: {
      ...(baseConfig.extra || {}),
      googleMapsApiKey,
    },
  };
};
