import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { Platform, Alert, Linking } from 'react-native';

export function usePermissions() {
  const [locationGranted, setLocationGranted] = useState<boolean>(false);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'GPS location is required for the Trotro Driver app to work. Please enable location access in your settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS !== 'web') {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        setLocationGranted(false);
        return false;
      }
      setLocationGranted(true);
      console.log('[Permissions] Location permission granted');
      return true;
    } catch (err) {
      console.log('[Permissions] Error requesting location:', err);
      setLocationGranted(false);
      return false;
    }
  }, []);

  return { locationGranted, requestLocationPermission };
}
