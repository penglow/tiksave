/**
 * MapScreen (web)
 *
 * Google Maps JavaScript API map of geotagged saves. Map tab on web; loads API key from
 * config or `/config/public`, then navigates to `VideoDetail` from marker info windows.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { SaveItem, getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { Config, Spacing, BorderRadius, Typography } from '../config';
import { Skeleton } from '../components';

// -----------------------------------------------------------------------------
// Types & globals
// -----------------------------------------------------------------------------

type GoogleMapsNamespace = any;

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    __tiksaveGoogleMapsInit?: () => void;
  }
}

// -----------------------------------------------------------------------------
// Constants — map styling & script loader
// -----------------------------------------------------------------------------

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-js';
let googleMapsPromise: Promise<GoogleMapsNamespace> | null = null;

const googleDarkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3a3a3a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1115' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
];

const loadGoogleMaps = (apiKey: string): Promise<GoogleMapsNamespace> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in a browser.'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    window.__tiksaveGoogleMapsInit = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps loaded without the maps namespace.'));
      }
      delete window.__tiksaveGoogleMapsInit;
    };

    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) resolve(window.google.maps);
      });
      existingScript.addEventListener('error', () => {
        googleMapsPromise = null;
        reject(new Error('Failed to load Google Maps.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=__tiksaveGoogleMapsInit&v=weekly&loading=async`;
    script.onerror = () => {
      googleMapsPromise = null;
      delete window.__tiksaveGoogleMapsInit;
      reject(new Error('Failed to load Google Maps.'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

const fetchRuntimeGoogleMapsApiKey = async (): Promise<string> => {
  const configuredKey = Config.googleMapsApiKey.trim();
  if (configuredKey) return configuredKey;

  try {
    const response = await fetch(`${Config.apiBaseURL}/config/public`);
    if (!response.ok) return '';

    const data = await response.json();
    return typeof data.googleMapsApiKey === 'string' ? data.googleMapsApiKey.trim() : '';
  } catch (error) {
    console.warn('Failed to load public runtime config:', error);
    return '';
  }
};

// -----------------------------------------------------------------------------
// Main screen
// -----------------------------------------------------------------------------

export default function MapScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // --- Refs -----------------------------------------------------------------

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  // --- State ----------------------------------------------------------------

  const [items, setItems] = useState<SaveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // --- Data loading ---------------------------------------------------------

  const loadItems = useCallback(async () => {
    try {
      const allItems = await apiService.getMapItems();
      const itemsWithLocation = allItems.filter(
        (item) => item.latitude != null && item.longitude != null,
      );

      if (__DEV__) {
        console.log('WebMap: loaded items:', allItems.length);
        console.log('WebMap: items with location:', itemsWithLocation.length);
      }

      setItems(itemsWithLocation);
    } catch (error) {
      console.error('Failed to load items for map:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      const googleMapsApiKey = await fetchRuntimeGoogleMapsApiKey();

      if (!googleMapsApiKey) {
        setMapError('Google Maps API key is missing.');
        return;
      }

      try {
        const maps = await loadGoogleMaps(googleMapsApiKey);
        if (isCancelled || !mapElementRef.current) return;

        mapRef.current = new maps.Map(mapElementRef.current, {
          center: { lat: 30, lng: 0 },
          zoom: 2,
          backgroundColor: colors.background,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          styles: isDark ? googleDarkMapStyle : undefined,
          zoomControlOptions: {
            position: maps.ControlPosition.RIGHT_BOTTOM,
          },
        });

        infoWindowRef.current = new maps.InfoWindow();
        setIsMapReady(true);
        setMapError(null);
      } catch (error) {
        console.error('Failed to initialize Google Maps:', error);
        if (!isCancelled) setMapError('Google Maps could not be loaded.');
      }
    };

    initMap();

    return () => {
      isCancelled = true;
    };
  }, [colors.background, isDark]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    mapRef.current.setOptions({
      backgroundColor: colors.background,
      styles: isDark ? googleDarkMapStyle : null,
    });
  }, [colors.background, isDark]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !window.google?.maps) return;

    const maps = window.google.maps;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (items.length === 0) {
      mapRef.current.setCenter({ lat: 30, lng: 0 });
      mapRef.current.setZoom(2);
      return;
    }

    const bounds = new maps.LatLngBounds();

    items.forEach((item) => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const marker = new maps.Marker({
        map: mapRef.current,
        position: { lat, lng },
        title: getDisplayTitle(item),
        icon: item.thumbnailURL
          ? {
              url: item.thumbnailURL,
              scaledSize: new maps.Size(44, 62),
              anchor: new maps.Point(22, 62),
            }
          : {
              path: maps.SymbolPath.CIRCLE,
              fillColor: colors.accent,
              fillOpacity: 1,
              scale: 11,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
      });

      marker.addListener('click', () => {
        if (!infoWindowRef.current) return;
        infoWindowRef.current.setContent(createInfoWindowContent(item));
        infoWindowRef.current.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    });

    if (items.length === 1) {
      mapRef.current.setCenter(bounds.getCenter());
      mapRef.current.setZoom(13);
    } else {
      mapRef.current.fitBounds(bounds, {
        top: 112,
        right: 40,
        bottom: 40,
        left: 40,
      });
    }
  }, [colors.accent, isMapReady, items, navigation]);

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  const createInfoWindowContent = (item: SaveItem) => {
    const container = document.createElement('div');
    container.style.width = '240px';
    container.style.fontFamily =
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    container.style.color = isDark ? '#f5f5f0' : '#1a1a1e';
    container.style.background = isDark ? '#141416' : '#ffffff';
    container.style.borderRadius = '16px';
    container.style.padding = '12px';
    container.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
    container.style.border = `1px solid ${isDark ? 'rgba(245,245,240,0.07)' : 'rgba(26,26,30,0.07)'}`;

    if (item.thumbnailURL) {
      const thumbWrap = document.createElement('div');
      thumbWrap.style.width = '100%';
      thumbWrap.style.height = '120px';
      thumbWrap.style.borderRadius = '12px';
      thumbWrap.style.overflow = 'hidden';
      thumbWrap.style.marginBottom = '10px';
      thumbWrap.style.position = 'relative';
      thumbWrap.style.cursor = 'pointer';

      const thumb = document.createElement('img');
      thumb.src = item.thumbnailURL;
      thumb.style.width = '100%';
      thumb.style.height = '100%';
      thumb.style.objectFit = 'cover';
      thumbWrap.appendChild(thumb);

      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0,0,0,0.20)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      thumbWrap.appendChild(overlay);

      thumbWrap.onclick = () => navigation.navigate('VideoDetail', { item });
      container.appendChild(thumbWrap);
    }

    const title = document.createElement('button');
    title.type = 'button';
    title.textContent = getDisplayTitle(item);
    title.style.display = 'block';
    title.style.width = '100%';
    title.style.padding = '0';
    title.style.margin = '0 0 6px';
    title.style.border = 'none';
    title.style.background = 'transparent';
    title.style.color = isDark ? '#f5f5f0' : '#1a1a1e';
    title.style.cursor = 'pointer';
    title.style.fontSize = '14px';
    title.style.fontWeight = '700';
    title.style.lineHeight = '18px';
    title.style.textAlign = 'left';
    title.style.letterSpacing = '-0.2px';
    title.onclick = () => navigation.navigate('VideoDetail', { item });
    container.appendChild(title);

    if (item.locationName) {
      const location = document.createElement('div');
      location.textContent = item.locationName;
      location.style.fontSize = '12px';
      location.style.fontWeight = '600';
      location.style.marginBottom = '4px';
      location.style.color = isDark ? 'rgba(245,245,240,0.70)' : 'rgba(26,26,30,0.65)';
      container.appendChild(location);
    }

    if (item.address) {
      const address = document.createElement('div');
      address.textContent = item.address;
      address.style.fontSize = '11px';
      address.style.color = isDark ? 'rgba(245,245,240,0.45)' : '#666';
      address.style.lineHeight = '15px';
      address.style.marginBottom = '10px';
      container.appendChild(address);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Open in Google Maps';
    button.style.width = '100%';
    button.style.padding = '10px 0';
    button.style.background = colors.accent;
    button.style.color = '#ffffff';
    button.style.border = 'none';
    button.style.borderRadius = '10px';
    button.style.fontSize = '12px';
    button.style.fontWeight = '700';
    button.style.cursor = 'pointer';
    button.style.letterSpacing = '0.2px';
    button.onclick = () => openInMaps(Number(item.latitude), Number(item.longitude));
    container.appendChild(button);

    return container;
  };

  // --- Render -----------------------------------------------------------------

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Discover</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Skeleton width="100%" height={400} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View ref={mapElementRef as any} style={styles.mapContainer} />

      {mapError && (
        <View
          style={[
            styles.mapMessage,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.mapMessageTitle, { color: colors.text }]}>Map unavailable</Text>
          <Text style={[styles.mapMessageBody, { color: colors.textSecondary }]}>{mapError}</Text>
        </View>
      )}

      <View style={[styles.headerOverlay, { paddingTop: insets.top + 16 }]}>
        <View
          style={[
            styles.headerBlur,
            { backgroundColor: colors.glass, borderColor: colors.glassBorder },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>Discover</Text>
        </View>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    pointerEvents: 'none',
    zIndex: 1000,
  },
  headerBlur: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
    pointerEvents: 'auto',
    borderWidth: 1,
  } as any,
  headerTitle: {
    ...Typography.heading,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'center',
  },
  mapMessage: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    top: '42%',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    zIndex: 1001,
  },
  mapMessageTitle: {
    ...Typography.bodyStrong,
    marginBottom: Spacing.xs,
  },
  mapMessageBody: {
    ...Typography.bodySm,
  },
});
