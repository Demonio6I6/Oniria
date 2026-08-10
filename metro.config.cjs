const { getDefaultConfig } = require('expo/metro-config');
const { default: exclusionList } = require('metro-config/private/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

const existingBlockList = config.resolver.blockList;
const blockList = Array.isArray(existingBlockList)
  ? existingBlockList
  : existingBlockList
    ? [existingBlockList]
    : [];

config.resolver.blockList = exclusionList([
  ...blockList,
  /node_modules[\/\\]@react-native[\/\\]gradle-plugin[\/\\].*[\/\\]build[\/\\].*/,
]);

module.exports = config;
