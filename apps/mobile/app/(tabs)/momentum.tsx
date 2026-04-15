import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import {
  TabScreen,
  AvailableToggle,
  MiniActionCard,
  EmptyState,
} from '@sovio/ui';
import {
  useMyAvailability,
  useSetAvailable,
  useRemoveAvailability,
  useNearbyAvailableFriends,
  useAuthStore,
  useLocationStore,
  locationService,
} from '@sovio/core';
import { TopRightActions } from '../../components/TopRightActions';

export default function MomentumTab() {
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);

  // Momentum availability
  const { data: availability } = useMyAvailability();
  const setAvailable = useSetAvailable();
  const removeAvailability = useRemoveAvailability();
  const isAvailable = !!availability;

  const setCurrentCoords = useLocationStore((s) => s.setCurrentCoords);
  const setPermissionStatus = useLocationStore((s) => s.setPermissionStatus);
  const { data: nearbyFriends } = useNearbyAvailableFriends();
  const nearbyCount = nearbyFriends?.length ?? 0;
  const emptyTitle = isAvailable ? 'You are available' : 'No active momentum';
  const emptyBody = isAvailable
    ? 'Sovio is watching for nearby friends who are also open to plans. You can also create a plan now.'
    : 'Toggle available above to let Sovio look for nearby friends who are also open to plans right now.';

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (next) {
        let bucket = 'manual:local';
        let lat: number | null = null;
        let lng: number | null = null;

        try {
          const status = await locationService.requestPermission();
          setPermissionStatus(status);

          if (status === 'granted' && userId) {
            const location = await locationService.getCurrentLocation();
            lat = location.coords.latitude;
            lng = location.coords.longitude;
            setCurrentCoords({ latitude: lat, longitude: lng });
            bucket = locationService.coordsToLocalityBucket({
              latitude: lat,
              longitude: lng,
            });
            await locationService.captureLocationSnapshot(userId, location, 'approx');
          }
        } catch (err) {
          // Keep the flow usable even if location fails, but log so location
          // outages are visible in diagnostics.
          console.warn('[Momentum] Location acquisition failed — using manual bucket.', err instanceof Error ? err.message : err);
        }

        setAvailable.mutate({
          bucket,
          category: null,
          durationMins: 60,
          lat,
          lng,
          availabilityMode: 'open_now',
          confidenceLabel: lat && lng ? 'open_to_plans' : 'availability_unknown',
          source: lat && lng ? 'device_location' : 'manual',
        });
      } else {
        removeAvailability.mutate();
      }
    },
    [removeAvailability, setAvailable, setCurrentCoords, setPermissionStatus, userId],
  );

  return (
    <TabScreen
      title="Momentum"
      subtitle="Spontaneous coordination"
      headerRight={<TopRightActions />}
    >
      {/* Availability toggle */}
      <AvailableToggle
        isAvailable={isAvailable}
        onToggle={handleToggle}
        category={availability?.category ?? undefined}
        expiresAt={availability?.available_until ?? null}
      />

      {/* Safety indicator */}
      {isAvailable && (
        <View style={[styles.safetyRow, { backgroundColor: theme.surfaceAlt }]}>
          <Text style={[styles.safetyText, { color: theme.muted }]}>
            {nearbyCount} friend{nearbyCount !== 1 ? 's' : ''} nearby open to plans
          </Text>
        </View>
      )}

      {isAvailable && nearbyCount > 0 ? (
        <View style={styles.planList}>
          {nearbyFriends?.slice(0, 3).map((friend) => (
            <MiniActionCard
              key={friend.friend_id}
              title={friend.display_name ?? 'Friend nearby'}
              body={`Open to plans${friend.category ? ` for ${friend.category}` : ''}. ${Math.max(1, Math.round(friend.distance_meters / 1609))} mi away.`}
              label={friend.confidence_label.replace(/_/g, ' ')}
              onPress={() => router.push('/(modals)/create-plan')}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="flash-outline"
          title={emptyTitle}
          body={emptyBody}
          actionLabel="Create a plan"
          onAction={() => router.push('/(modals)/create-plan')}
        />
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  safetyRow: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  safetyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  planList: {
    gap: 10,
  },
});
