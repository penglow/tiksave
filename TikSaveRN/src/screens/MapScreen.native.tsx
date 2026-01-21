import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Image, Dimensions, Platform, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import { SaveItem, getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../config';
import { AnimatedText, AnimatedPressable, Skeleton } from '../components';

const { width } = Dimensions.get('window');

export default function MapScreen({ navigation }: any) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const [items, setItems] = useState<SaveItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<SaveItem | null>(null);

    const loadItems = useCallback(async () => {
        try {
            const allItems = await apiService.getMapItems();

            // Filter items that have REAL location data only
            const itemsWithLocation = allItems.filter(item =>
                item.latitude != null && item.longitude != null
            );

            console.log('📍 NativeMap: Items with location:', itemsWithLocation.length);
            // Log first item data for debugging
            if (itemsWithLocation.length > 0) {
                const first = itemsWithLocation[0];
                console.log('   First item:', first.locationName, first.latitude, first.longitude, 'Thumb:', first.thumbnailURL ? 'Yes' : 'No');
            }

            setItems(itemsWithLocation);

            // Auto-zoom to first item for now if available (basic centering)
            if (itemsWithLocation.length > 0 && mapRef.current) {
                const item = itemsWithLocation[0];
                mapRef.current.animateToRegion({
                    latitude: Number(item.latitude),
                    longitude: Number(item.longitude),
                    latitudeDelta: 10,
                    longitudeDelta: 10,
                }, 1000);
            }
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

    const handleMarkerPress = (item: SaveItem) => {
        setSelectedItem(item);
    };

    const handleMapPress = () => {
        setSelectedItem(null);
    };

    const openInMaps = (item: SaveItem) => {
        const lat = item.latitude;
        const lng = item.longitude;
        const label = item.locationName || 'Location';

        // Apple Maps (iOS) vs Google Maps (Android)
        const url = Platform.select({
            ios: `maps:0,0?q=${label}@${lat},${lng}`,
            android: `geo:0,0?q=${lat},${lng}(${label})`
        });

        if (url) {
            Linking.openURL(url);
        }
    };

    const initialRegion = {
        latitude: 35.0,
        longitude: 0.0,
        latitudeDelta: 90.0,
        longitudeDelta: 180.0,
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top }]}>
                    <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Discover</AnimatedText>
                </View>
                <View style={styles.loadingContainer}>
                    <Skeleton width={width - 32} height={200} style={{ borderRadius: 12 }} />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                onPress={handleMapPress}
                userInterfaceStyle={colors.background === '#000000' ? 'dark' : 'light'}
            >
                {items.map((item) => (
                    <Marker
                        key={`${item.id}-${item.locationId || ''}`}
                        coordinate={{
                            latitude: Number(item.latitude),
                            longitude: Number(item.longitude),
                        }}
                        onPress={() => handleMarkerPress(item)}
                        tracksViewChanges={false}
                    >
                        {item.thumbnailURL ? (
                            <Image
                                source={{ uri: item.thumbnailURL }}
                                style={{
                                    width: 50,
                                    height: 70,
                                    borderRadius: 6,
                                    borderColor: 'white',
                                    borderWidth: 2,
                                    backgroundColor: '#ddd'
                                }}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: colors.primary,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 2,
                                borderColor: 'white'
                            }}>
                                <Ionicons name="location" size={24} color="white" />
                            </View>
                        )}
                    </Marker>
                ))}
            </MapView>

            {/* Header Overlay */}
            <View style={[styles.headerOverlay, { paddingTop: insets.top }]}>
                <View style={[styles.headerBlur, { backgroundColor: colors.background + 'CC' }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Discover</Text>
                </View>
            </View>

            {/* Selected Item Card */}
            {selectedItem && (
                <AnimatedPressable
                    style={[styles.cardContainer, {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        bottom: insets.bottom + 80 // Above tab bar
                    }]}
                    onPress={() => navigation.navigate('VideoDetail', { item: selectedItem })}
                >
                    <View style={styles.cardContent}>
                        <View style={styles.cardImageContainer}>
                            {selectedItem.thumbnailURL ? (
                                <Image
                                    source={{ uri: selectedItem.thumbnailURL }}
                                    style={styles.cardImage}
                                />
                            ) : (
                                <View style={[styles.cardPlaceholder, { backgroundColor: colors.accentSubtle }]}>
                                    <Ionicons name="play" size={24} color={colors.textTertiary} />
                                </View>
                            )}
                            <View style={styles.cardDuration}>
                                <Text style={styles.cardDurationText}>
                                    {selectedItem.duration ?
                                        `${Math.floor(selectedItem.duration / 60)}:${String(Math.floor(selectedItem.duration % 60)).padStart(2, '0')}`
                                        : '0:00'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.cardInfo}>
                            <View>
                                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                                    {getDisplayTitle(selectedItem)}
                                </Text>

                                {selectedItem.locationName && (
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location-sharp" size={12} color={colors.primary} />
                                        <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
                                            {selectedItem.locationName}
                                        </Text>
                                    </View>
                                )}

                                {selectedItem.address && (
                                    <Text style={[styles.addressText, { color: colors.textTertiary }]} numberOfLines={1}>
                                        {selectedItem.address}
                                    </Text>
                                )}
                            </View>

                            <View style={styles.cardFooter}>
                                <TouchableOpacity
                                    onPress={() => openInMaps(selectedItem)}
                                    style={[styles.mapButton, { backgroundColor: colors.surface }]}
                                >
                                    <Ionicons name="map" size={12} color={colors.textSecondary} />
                                    <Text style={[styles.mapButtonText, { color: colors.textSecondary }]}>Maps</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => selectedItem.sourceURL && Linking.openURL(selectedItem.sourceURL)}
                                    style={[styles.playButton, { backgroundColor: colors.primary }]}
                                >
                                    <Ionicons name="play" size={12} color="white" />
                                    <Text style={styles.playButtonText}>Play</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </AnimatedPressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
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
    },
    headerBlur: {
        padding: Spacing.sm,
        borderRadius: BorderRadius.lg,
        alignSelf: 'flex-start',
        marginTop: Spacing.sm,
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

    // Card
    cardContainer: {
        position: 'absolute',
        left: Spacing.md,
        right: Spacing.md,
        height: 100,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    cardContent: {
        flexDirection: 'row',
        height: '100%',
    },
    cardImageContainer: {
        width: 80,
        height: '100%',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    cardPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardDuration: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
    },
    cardDurationText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
    },
    cardInfo: {
        flex: 1,
        padding: Spacing.sm,
        justifyContent: 'space-between',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 2,
    },
    locationText: {
        fontSize: 12,
    },
    addressText: {
        fontSize: 11,
        marginTop: 2,
        marginBottom: 4,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 100,
        gap: 4,
    },
    mapButtonText: {
        fontSize: 10,
        fontWeight: '600',
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 100,
        gap: 4,
    },
    playButtonText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
    },
});
