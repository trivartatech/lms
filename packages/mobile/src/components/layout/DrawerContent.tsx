import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer'
import { useRouter, useSegments } from 'expo-router'
import {
  LayoutDashboard, Users, School, FileText, Handshake,
  CheckSquare, BarChart2, Activity, Settings, LogOut,
} from 'lucide-react-native'
import { C } from '@/lib/colors'
import { getInitials } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { clearPushTokenOnLogout } from '@/lib/push-notifications'

const NAV_ITEMS = [
  { label: 'Dashboard',      icon: LayoutDashboard, route: '/(app)' as const },
  { label: 'Leads & Pipeline', icon: Users,          route: '/(app)/leads' as const },
  { label: 'Schools',        icon: School,           route: '/(app)/schools' as const },
  { label: 'Quotations',     icon: FileText,         route: '/(app)/quotations' as const },
  { label: 'Agreements',     icon: Handshake,        route: '/(app)/agreements' as const },
  { label: 'Tasks',          icon: CheckSquare,      route: '/(app)/tasks' as const },
  { label: 'Reports',        icon: BarChart2,        route: '/(app)/reports' as const },
  { label: 'Activity Log',   icon: Activity,         route: '/(app)/activity' as const },
  { label: 'Settings',       icon: Settings,         route: '/(app)/settings' as const },
]

export function DrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  const currentPath = '/' + segments.join('/')

  function isActive(route: string) {
    if (route === '/(app)') return currentPath === '/(app)' || currentPath === '/(app)/index'
    return currentPath.startsWith(route)
  }

  function navigate(route: string) {
    props.navigation.closeDrawer()
    router.push(route as never)
  }

  async function handleLogout() {
    props.navigation.closeDrawer()
    // Clear push token BEFORE logout so the DELETE call still carries a valid
    // access token. Best-effort — if it fails (offline, 401) we still log out
    // locally; the stale token on the server will get cleaned up when the
    // backend next hits DeviceNotRegistered during a push send.
    await clearPushTokenOnLogout()
    logout()
  }

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={s.container}>
      {/* User profile */}
      <View style={s.profile}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{getInitials(user?.name ?? 'U')}</Text>
        </View>
        <View style={s.profileInfo}>
          <Text style={s.profileName} numberOfLines={1}>{user?.name}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{user?.role?.replace(/_/g, ' ')}</Text>
          </View>
        </View>
      </View>

      <View style={s.divider} />

      {/* Navigation items */}
      <View style={s.nav}>
        {NAV_ITEMS.map(({ label, icon: Icon, route }) => {
          const active = isActive(route)
          return (
            <Pressable
              key={route}
              style={[s.navItem, active && s.navItemActive]}
              onPress={() => navigate(route)}
            >
              <Icon size={20} color={active ? C.primary : C.textSecondary} />
              <Text style={[s.navLabel, active && s.navLabelActive]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Logout */}
      <View style={s.footer}>
        <View style={s.divider} />
        <Pressable style={s.navItem} onPress={handleLogout}>
          <LogOut size={20} color={C.error} />
          <Text style={[s.navLabel, { color: C.error }]}>Logout</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface, paddingBottom: 16 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  roleBadge: {
    backgroundColor: C.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  roleText: { fontSize: 10, fontWeight: '600', color: C.primary },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16, marginVertical: 4 },
  nav: { paddingHorizontal: 8, paddingTop: 8 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  navItemActive: { backgroundColor: C.primaryLight },
  navLabel: { fontSize: 14, fontWeight: '500', color: C.textSecondary },
  navLabelActive: { color: C.primary, fontWeight: '600' },
  footer: { marginTop: 'auto', paddingHorizontal: 8 },
})
