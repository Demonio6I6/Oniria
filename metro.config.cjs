const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

const existingBlockList = config.resolver.blockList;
const blockList = existingBlockList
  ? [existingBlockList]
  : [];

config.resolver.blockList = exclusionList([
  ...blockList,
  /node_modules[\/\\]@react-native[\/\\]gradle-plugin[\/\\].*[\/\\]build[\/\\].*/,
]);

module.exports = config;
