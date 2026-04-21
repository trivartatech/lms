const { withAndroidManifest } = require('@expo/config-plugins')

/**
 * Android 11+ (API 30) requires apps to declare which external packages or URL
 * schemes they will interact with in a <queries> block. Without this declaration
 * Linking.canOpenURL() returns `false` even when the target app is installed —
 * which silently breaks our WhatsApp / dialer / mail handoffs.
 *
 * Expo's app.json schema doesn't support custom queries directly, so we do it
 * via a config plugin that mutates the AndroidManifest during prebuild.
 */
module.exports = function withExternalAppQueries(config) {
  const SCHEMES = ['whatsapp', 'tel', 'mailto', 'sms']

  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest
    if (!manifest.queries) manifest.queries = [{}]
    const q = manifest.queries[0]
    if (!q.intent) q.intent = []

    for (const scheme of SCHEMES) {
      const already = q.intent.some((i) =>
        i.data?.some((d) => d.$?.['android:scheme'] === scheme),
      )
      if (already) continue
      q.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      })
    }

    return cfg
  })
}
