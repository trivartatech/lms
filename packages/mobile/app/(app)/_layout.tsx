import { Drawer } from 'expo-router/drawer'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Bell } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { DrawerContent } from '@/components/layout/DrawerContent'
import { OfflineStatusPill } from '@/components/shared/OfflineStatusPill'
import { C } from '@/lib/colors'
import { api } from '@/lib/api'
import type { WorkspacePage } from '@lms/shared'

function HeaderRight() {
  const router = useRouter()
  const { data } = useQuery<WorkspacePage>({
    queryKey: ['workspace', 'inbox', '', '', ''],
    meta: { skipPersist: true },
    queryFn: () => api.get('/workspace/inbox').then((r) => r.data),
    staleTime: 60_000,
  })
  const count = data?.sections.find(section => section.title === 'Unread')?.cards.length ?? 0

  return (
    <View style={s.headerRight}>
      <OfflineStatusPill />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notification inbox"
        onPress={() => router.push('/(app)/workspace?module=inbox' as never)}
        hitSlop={10}
        style={({ pressed }) => [s.bellWrap, pressed && { opacity: 0.6 }]}
      >
        <Bell size={22} color={C.textSecondary} />
        {count > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        )}
      </Pressable>
    </View>
  )
}

export default function AppLayout() {
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: C.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerRight: () => <HeaderRight />,
        drawerStyle: { width: 280 },
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="index"       options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="leads"       options={{ title: 'Leads & Pipeline' }} />
      <Drawer.Screen name="schools"     options={{ title: 'Schools' }} />
      <Drawer.Screen name="quotations"  options={{ title: 'Quotations' }} />
      <Drawer.Screen name="agreements"  options={{ title: 'Agreements' }} />
      <Drawer.Screen name="sync" options={{ title: 'Sync queue' }} />
      <Drawer.Screen name="workspace" options={{ title: 'Account workspace' }} />
      <Drawer.Screen name="operations" options={{ title: 'School operations' }} />
      <Drawer.Screen name="tasks"       options={{ title: 'Tasks' }} />
      <Drawer.Screen name="reports"     options={{ title: 'Reports' }} />
      <Drawer.Screen name="activity"    options={{ title: 'Activity Log' }} />
      <Drawer.Screen name="settings"    options={{ title: 'Settings' }} />
    </Drawer>
  )
}

const s = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  bellWrap: { padding: 4 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: C.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
})
