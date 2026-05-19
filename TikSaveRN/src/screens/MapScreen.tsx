/**
 * MapScreen (platform router)
 *
 * Re-exports the correct map implementation for the current platform. Metro/Webpack
 * resolve `MapScreen.native.tsx` on iOS/Android and `MapScreen.web.tsx` on web; this
 * file satisfies TypeScript module resolution only.
 */

import { Platform } from 'react-native';

// -----------------------------------------------------------------------------
// Platform re-export
// -----------------------------------------------------------------------------

const MapScreen = Platform.OS === 'web'
  ? require('./MapScreen.web').default
  : require('./MapScreen.native').default;

export default MapScreen;
