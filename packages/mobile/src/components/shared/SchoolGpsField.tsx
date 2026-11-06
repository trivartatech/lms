import { useRef, useEffect, useState } from 'react'
import { View, Text, Pressable, Alert, Linking } from 'react-native'
import * as Location from 'expo-location'

export type GpsPin = { latitude: number | null; longitude: number | null }

export function SchoolGpsField({ value, onChange }: { value: GpsPin; onChange: (pin: GpsPin) => void }) {
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const capture = async () => {
    setBusy(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) throw new Error('Allow location access in Settings to capture the school GPS pin.')
      if (!await Location.hasServicesEnabledAsync()) throw new Error('Turn on device location services and try again.')
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GPS timed out. Try again outdoors at the school.')), 20000)),
      ])
      if (mounted.current) onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude })
    } catch (error) {
      if (mounted.current) Alert.alert('School location', error instanceof Error ? error.message : 'Unable to get GPS. Please try again.')
    } finally { if (mounted.current) setBusy(false) }
  }
  return <View style={{ gap: 10, paddingVertical: 12 }}>
    <Text style={{ fontWeight: '600' }}>School GPS pin</Text>
    <Text>Capture while at the school. Save the form to keep this pin.</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={capture}><Text style={{ color: '#2563eb' }}>{busy ? 'Getting location…' : 'Use current location'}</Text></Pressable>
    {value.latitude != null && value.longitude != null && <>
      <Text>{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</Text>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${value.latitude},${value.longitude}`).catch(() => Alert.alert('Maps', 'Unable to open Google Maps.'))}><Text style={{ color: '#2563eb' }}>Open Google Maps</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => onChange({ latitude: null, longitude: null })}><Text>Remove pin</Text></Pressable>
    </>}
  </View>
}
