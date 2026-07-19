const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(workspaceRoot, "shared")];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  "@shared": path.resolve(workspaceRoot, "shared"),
};
config.resolver.assetExts = [...config.resolver.assetExts, "html"];

module.exports = withNativeWind(config, { input: "./global.css" });
