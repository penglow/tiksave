import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Image, Dimensions, Platform, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ExpoLocation from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';

import { SaveItem, getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../config';
import { AnimatedText, AnimatedPressable, Skeleton } from '../components';

const { width } = Dimensions.get('window');

// Google Maps style for dark mode to match the app theme
const darkMapStyle = [
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

export default function MapScreen({ navigation }: any) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const [items, setItems] = useState<SaveItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<SaveItem | null>(null);

    // User Location State
    const [userLocation, setUserLocation] = useState<ExpoLocation.LocationObject | null>(null);
    const [hasZoomedToUser, setHasZoomedToUser] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // Reanimated Heading
    const heading = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { rotate: `${heading.value}deg` }
            ],
        };
    });

    // Map Region State for Scaling
    const [regionDelta, setRegionDelta] = useState(0.01);

    // Card Animation State
    const cardY = useSharedValue(150); // Start off-screen (reduced from 200)
    const cardOpacity = useSharedValue(0);
    const [displayItem, setDisplayItem] = useState<SaveItem | null>(null);

    // Sync display item with selected item for entry/exit animation
    useEffect(() => {
        if (selectedItem) {
            setDisplayItem(selectedItem);
            // Only animate if we're not already in a gesture-based dismissal
            if (cardY.value > 10) {
                cardY.value = withSpring(0, { damping: 40, stiffness: 300 });
            }
            cardOpacity.value = withTiming(1, { duration: 100 });
        } else {
            // Only animate if we haven't already swiped it away
            if (cardY.value < 50) {
                cardY.value = withSpring(150, { damping: 40, stiffness: 300 }, () => {
                    runOnJS(setDisplayItem)(null);
                });
            } else {
                // If it was swiped away, just clear the display item after a delay
                runOnJS(setDisplayItem)(null);
            }
            cardOpacity.value = withTiming(0, { duration: 100 });
        }
    }, [selectedItem]);

    const cardAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: cardY.value }],
            opacity: cardOpacity.value,
        };
    });

    const isDismissing = useSharedValue(false);

    const panGesture = Gesture.Pan()
        .activeOffsetY(5)
        .onUpdate((event) => {
            if (event.translationY > 0) {
                cardY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (event.translationY > 50 || event.velocityY > 500) {
                // Instantly finish to avoid state-change collision
                cardY.value = withTiming(300, { duration: 50 }, () => {
                    runOnJS(setSelectedItem)(null);
                });
            } else {
                cardY.value = withSpring(0, { damping: 20, stiffness: 1000 });
            }
        });

    // Setup Location Watchers
    useEffect(() => {
        let locationSubscription: ExpoLocation.LocationSubscription | null = null;
        let headingSubscription: ExpoLocation.LocationSubscription | null = null;

        const startWatching = async () => {
            try {
                const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    return;
                }
                setPermissionGranted(true);

                // Watch Position for Auto-Zoom and Recenter button
                locationSubscription = await ExpoLocation.watchPositionAsync(
                    {
                        accuracy: ExpoLocation.Accuracy.BestForNavigation,
                        timeInterval: 1000,
                        distanceInterval: 1,
                    },
                    (location) => {
                        setUserLocation(location);
                    }
                );

                // Watch Heading
                headingSubscription = await ExpoLocation.watchHeadingAsync((newHeading) => {
                    const nextHeading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magHeading;

                    // Logic to prevent 360 spin by finding the shortest path
                    const currentHeading = heading.value;
                    let diff = (nextHeading - currentHeading) % 360;

                    if (diff > 180) {
                        diff -= 360;
                    } else if (diff < -180) {
                        diff += 360;
                    }

                    heading.value = withSpring(currentHeading + diff, { damping: 30, stiffness: 400 });
                });

            } catch (error) {
                console.error("Error starting location services:", error);
            }
        };

        startWatching();

        return () => {
            if (locationSubscription) locationSubscription.remove();
            if (headingSubscription) headingSubscription.remove();
        };
    }, []);

    // Auto Zoom to User Effect - Removed as per user request
    useEffect(() => {
        if (userLocation && !hasZoomedToUser) {
            // We still track that we found the location once, but don't force move the map
            setHasZoomedToUser(true);
        }
    }, [userLocation, hasZoomedToUser]);


    const loadItems = useCallback(async () => {
        try {
            const allItems = await apiService.getMapItems();
            const itemsWithLocation = allItems.filter(item =>
                item.latitude != null && item.longitude != null
            );
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

    const lastSelectedIdRef = useRef<string | null>(null);
    const markerTouchTimestamp = useRef<number>(0);

    const handleMarkerPress = (item: SaveItem) => {
        markerTouchTimestamp.current = Date.now();

        // If already selected, navigate immediately
        if (selectedItem?.id === item.id) {
            navigation.navigate('VideoDetail', { item });
            return;
        }

        // Otherwise, select and zoom
        setSelectedItem(item);

        if (mapRef.current) {
            mapRef.current.animateCamera({
                center: {
                    latitude: Number(item.latitude),
                    longitude: Number(item.longitude),
                },
                zoom: 17, // Closer zoom for focus
            }, { duration: 400 });
        }
    };

    const handleMapPress = () => {
        // If a marker was recently touched, don't clear the selection
        // This prevents Apple Maps from bubbling the tap and closing the card
        if (Date.now() - markerTouchTimestamp.current < 500) {
            return;
        }
        setSelectedItem(null);
    };

    const openInMaps = (item: SaveItem) => {
        const lat = item.latitude;
        const lng = item.longitude;
        const label = item.locationName || 'Location';

        const url = Platform.select({
            ios: `maps:0,0?q=${label}@${lat},${lng}`,
            android: `geo:0,0?q=${lat},${lng}(${label})`
        });

        if (url) {
            Linking.openURL(url);
        }
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
                initialRegion={{
                    latitude: 35.0,
                    longitude: 0.0,
                    latitudeDelta: 90.0,
                    longitudeDelta: 180.0,
                }}
                onPress={handleMapPress}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                userInterfaceStyle="dark"
                customMapStyle={isDark ? darkMapStyle : undefined}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
            >
                {/* Custom Animated User Marker */}
                {userLocation && (
                    <Marker
                        coordinate={{
                            latitude: userLocation.coords.latitude,
                            longitude: userLocation.coords.longitude
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        zIndex={999}
                    >
                        <View style={styles.userMarkerContainer}>
                            <Animated.View style={[styles.visionConeContainer, animatedStyle]}>
                                <View style={styles.directionCone} />
                            </Animated.View>
                            <View style={styles.userDotMain} />
                        </View>
                    </Marker>
                )}

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
                        <View pointerEvents="none">
                            {item.thumbnailURL ? (
                                <Image
                                    source={{ uri: item.thumbnailURL }}
                                    style={styles.markerImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={[styles.defaultMarker, { backgroundColor: colors.primary }]}>
                                    <Ionicons name="location" size={24} color="white" />
                                </View>
                            )}
                        </View>
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
            {displayItem && (
                <GestureDetector gesture={panGesture}>
                    <Animated.View
                        style={[styles.cardContainer, cardAnimatedStyle, {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            bottom: insets.bottom + 85
                        }]}
                    >
                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={styles.cardTouchable}
                            onPress={() => navigation.navigate('VideoDetail', { item: displayItem })}
                        >
                            {/* Swipe Handle */}
                            <View style={styles.swipeHandleContainer}>
                                <View style={[styles.swipeHandle, { backgroundColor: colors.border }]} />
                            </View>
                            <View style={styles.cardContent}>
                                <View style={styles.cardImageContainer}>
                                    {displayItem.thumbnailURL ? (
                                        <Image
                                            source={{ uri: displayItem.thumbnailURL }}
                                            style={styles.cardImage}
                                        />
                                    ) : (
                                        <View style={[styles.cardPlaceholder, { backgroundColor: colors.accentSubtle }]}>
                                            <Ionicons name="play" size={24} color={colors.textTertiary} />
                                        </View>
                                    )}
                                    <View style={styles.cardDuration}>
                                        <Text style={styles.cardDurationText}>
                                            {displayItem.duration ?
                                                `${Math.floor(displayItem.duration / 60)}:${String(Math.floor(displayItem.duration % 60)).padStart(2, '0')}`
                                                : '0:00'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.cardInfo}>
                                    <View>
                                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                                            {getDisplayTitle(displayItem)}
                                        </Text>

                                        {displayItem.locationName && (
                                            <View style={styles.locationRow}>
                                                <Ionicons name="location-sharp" size={12} color={colors.primary} />
                                                <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
                                                    {displayItem.locationName}
                                                </Text>
                                            </View>
                                        )}

                                        {displayItem.address && (
                                            <Text style={[styles.addressText, { color: colors.textTertiary }]} numberOfLines={1}>
                                                {displayItem.address}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={styles.cardFooter}>
                                        <TouchableOpacity
                                            onPress={() => openInMaps(displayItem)}
                                            style={[styles.mapButton, { backgroundColor: colors.surface }]}
                                        >
                                            <Ionicons name="map" size={12} color={colors.textSecondary} />
                                            <Text style={[styles.mapButtonText, { color: colors.textSecondary }]}>Maps</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => displayItem.sourceURL && Linking.openURL(displayItem.sourceURL)}
                                            style={[styles.playButton, { backgroundColor: colors.text }]}
                                        >
                                            <Ionicons name="logo-tiktok" size={14} color={colors.background} />
                                            <Text style={[styles.playButtonText, { color: colors.background }]}>TikTok</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </GestureDetector>
            )}

            {/* Re-center Button */}
            {userLocation && (
                <AnimatedPressable
                    style={[
                        styles.recenterButton,
                        {
                            backgroundColor: colors.surface,
                            bottom: selectedItem ? (insets.bottom + 225) : (insets.bottom + 100)
                        }
                    ]}
                    onPress={() => {
                        mapRef.current?.animateCamera({
                            center: {
                                latitude: userLocation.coords.latitude,
                                longitude: userLocation.coords.longitude,
                            },
                            pitch: 0,
                            heading: 0,
                            zoom: 15,
                        }, { duration: 500 });
                    }}
                >
                    <Ionicons name="navigate" size={24} color={colors.primary} />
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
    // Custom User Marker
    userMarkerContainer: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    visionConeContainer: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
    },
    directionCone: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 30,
        borderRightWidth: 30,
        borderTopWidth: 45,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: 'rgba(0, 122, 255, 0.25)',
        position: 'absolute',
        bottom: 50,
        borderRadius: 20,
    },
    userDotMain: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#007AFF', // iOS Blue
        borderWidth: 2,
        borderColor: 'white',
        zIndex: 20,
    },
    recenterButton: {
        position: 'absolute',
        right: Spacing.md,
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    // Markers
    markerImage: {
        width: 50,
        height: 70,
        borderRadius: 6,
        borderColor: 'white',
        borderWidth: 2,
        backgroundColor: '#ddd'
    },
    defaultMarker: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white'
    },
    // Card
    cardContainer: {
        position: 'absolute',
        left: Spacing.md,
        right: Spacing.md,
        height: 130, // Taller to accommodate handle and prevent cutoff
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
    },
    swipeHandleContainer: {
        height: 12, // Reduced height
        width: '100%',
        alignItems: 'center',
        paddingTop: 6,
    },
    swipeHandle: {
        width: 30, // Narrower handle
        height: 3, // Thinner handle
        borderRadius: 2,
    },
    cardContent: {
        flexDirection: 'row',
        flex: 1, // Use remaining space
    },
    cardImageContainer: {
        width: 100, // Slightly wider thumbnail
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
        ...Typography.bodyStrong,
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
        ...Typography.caption,
        fontSize: 12,
    },
    addressText: {
        ...Typography.caption,
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
        ...Typography.caption,
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
        fontSize: 10,
        fontWeight: '600',
    },
    cardTouchable: {
        flex: 1,
    }
});
