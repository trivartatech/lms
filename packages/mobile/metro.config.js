const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

// Monorepo root (two levels up from packages/mobile)
const monorepoRoot = path.resolve(__dirname, '../..')

const config = getDefaultConfig(__dirname)

// 1. Watch the whole monorepo so Metro can see @lms/shared
config.watchFolders = [monorepoRoot]

// 2. Tell Metro where to look for node_modules
//    — first check the package's own node_modules, then the root
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

module.exports = config
