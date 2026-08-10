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

      if (Platform.OS === 'android') {
        const background = await Location.getBackgroundPermissionsAsync();
        if (background.status !== 'granted') {
          const shouldContinue = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Allow location all the time',
              'Passengers need your live bus position when the screen is off. Android will open Location settings; choose “Allow all the time”.',
              [
                { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Continue', onPress: () => resolve(true) },
              ],
              { cancelable: false }
            );
          });
          if (!shouldContinue) {
            setLocationGranted(false);
            return false;
          }

          const requested = await Location.requestBackgroundPermissionsAsync();
          if (requested.status !== 'granted') {
            Alert.alert(
              'Background location required',
              'Choose “Allow all the time” in Android settings so passengers can track the bus while your screen is off.',
              [{ text: 'Open Settings', onPress: () => Linking.openSettings() }]
            );
            setLocationGranted(false);
            return false;
          }
        }
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
