// Metro entry shim for Android release bundling.
//
// The expo gradle plugin invokes `@expo/cli export:embed` with its cwd at the
// monorepo root (where the workspace package.json lives), not at
// packages/mobile. Metro then resolves the entry file relative to that cwd and
// fails because there's no index.js here. This shim redirects the bundler to
// the actual mobile entry so release APK builds don't break.
//
// Dev/Metro-dev-server runs use packages/mobile/index.js directly via the
// expo-router preset; this file is only touched during `gradlew assembleRelease`.
require('./packages/mobile/index.js')
