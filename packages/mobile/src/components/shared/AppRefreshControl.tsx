import { RefreshControl, RefreshControlProps } from 'react-native'
import { C } from '../../lib/colors'

/**
 * Pull-to-refresh wrapper that pins iOS spinner tint and Android spinner colors
 * to the app's primary palette so every list looks consistent. Drop-in for
 * `<RefreshControl refreshing={...} onRefresh={...} />` — accepts all the usual
 * props and lets callers override.
 */
export function AppRefreshControl(props: RefreshControlProps) {
  return <RefreshControl tintColor={C.primary} colors={[C.primary]} {...props} />
}
