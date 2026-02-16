import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { SaveItem, getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../config';
import { AnimatedText, Skeleton } from '../components';

export default function MapScreen({ navigation }: any) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const [items, setItems] = useState<SaveItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadItems = useCallback(async () => {
        try {
            const allItems = await apiService.getMapItems();

            // Filter items that have REAL location data
            const itemsWithLocation = allItems.filter(item =>
                item.latitude != null && item.longitude != null
            );

            console.log('🗺️ WebMap: Loaded items:', allItems.length);
            console.log('📍 WebMap: Items with location:', itemsWithLocation.length);
            // Log first item data for debugging
            if (itemsWithLocation.length > 0) {
                const first = itemsWithLocation[0];
                console.log('   First item:', first.locationName, first.latitude, first.longitude, 'Thumb:', first.thumbnailURL ? 'Yes' : 'No');
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
        }, [loadItems])
    );

    const openInMaps = (lat: number, lng: number, label: string) => {
        // Explicitly use Google Maps web link
        const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        window.open(url, '_blank');
    };

    // Inject Leaflet CSS dynamically to avoid bundler issues
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        return () => {
            // document.head.removeChild(link);
        };
    }, []);

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top }]}>
                    <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Discover</AnimatedText>
                </View>
                <View style={styles.loadingContainer}>
                    <Skeleton width="100%" height={400} />
                </View>
            </View>
        );
    }

    const tileLayerUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tileLayerAttribution = isDark
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    // Inject Custom Leaflet Styles for divIcons
    const leafletStyles = `
    .leaflet-container {
        height: 100%;
        width: 100%;
        z-index: 1;
        background: ${colors.background};
    }
    .leaflet-div-icon {
        background: transparent;
        border: none;
    }
    /* Custom icon style */
    .custom-map-icon {
        transition: transform 0.2s ease;
    }
    .custom-map-icon:hover {
        transform: scale(1.1);
        z-index: 1000 !important;
    }
  `;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <style>{leafletStyles}</style>

            <View style={styles.mapContainer}>
                {/* @ts-ignore - MapContainer types can be tricky with RN */}
                <MapContainer
                    center={[30.0, 0.0]}
                    zoom={2}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        key={isDark ? 'dark' : 'light'}
                        attribution={tileLayerAttribution}
                        url={tileLayerUrl}
                    />

                    {items.map((item) => (
                        <Marker
                            key={`${item.id}-${item.locationId || ''}`}
                            position={[item.latitude!, item.longitude!]}
                            icon={item.thumbnailURL
                                ? L.icon({
                                    iconUrl: item.thumbnailURL,
                                    iconSize: [40, 56],
                                    iconAnchor: [20, 56],
                                    popupAnchor: [0, -56],
                                    className: 'custom-map-icon',
                                })
                                : L.divIcon({
                                    className: 'custom-map-icon',
                                    html: `
                                    <div style="
                                        width: 100%; 
                                        height: 100%; 
                                        background-color: #FF3B30;
                                        border-radius: 50%; 
                                        border: 2px solid white; 
                                        box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        color: white;
                                        font-size: 20px;
                                    ">📍</div>
                                    `,
                                    iconSize: [40, 40],
                                    iconAnchor: [20, 40],
                                    popupAnchor: [0, -40]
                                })}
                        >
                            <Popup>
                                <div style={{ display: 'flex', flexDirection: 'column', width: '200px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                    {/* Thumbnail in popup (optional, maybe redundant since marker is a thumbnail) */}
                                    {/* Content */}
                                    <div style={{ padding: '0px' }}>
                                        <div
                                            style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', cursor: 'pointer' }}
                                            onClick={() => navigation.navigate('VideoDetail', { item })}
                                        >
                                            {getDisplayTitle(item)}
                                        </div>

                                        {item.locationName && (
                                            <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>
                                                📍 {item.locationName}
                                            </div>
                                        )}

                                        {item.address && (
                                            <div style={{ fontSize: '11px', color: '#777', marginBottom: '10px', lineHeight: '1.3' }}>
                                                {item.address}
                                            </div>
                                        )}

                                        {/* Open in Maps Button */}
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                openInMaps(item.latitude!, item.longitude!, item.locationName || 'Location');
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '8px 0',
                                                backgroundColor: colors.primary,
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Open in Google Maps
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </View>

            {/* Header Overlay */}
            <View style={[styles.headerOverlay, { paddingTop: insets.top + 16 }]}>
                <View style={[styles.headerBlur, { backgroundColor: colors.background + 'CC' }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Discover</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Ensure web container fills window
        height: Platform.OS === 'web' ? '100vh' : '100%',
    },
    mapContainer: {
        flex: 1,
        // Fallback for environments where flex isn't propagating well
        height: (Platform.OS === 'web' ? 'calc(100vh - 100px)' : '100%') as any,
        width: '100%',
        minHeight: 400, // Ensure it's never 0 height
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
        padding: Spacing.sm,
        borderRadius: BorderRadius.lg,
        alignSelf: 'flex-start',
        pointerEvents: 'auto',
    },
    headerTitle: {
        ...Typography.heading,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        padding: Spacing.md,
        justifyContent: 'center',
    },
});
