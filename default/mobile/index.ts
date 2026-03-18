import { DEFAULT_REACT_NATIVE_APP_SOURCE } from "./App";
import { NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT } from "@/app/config/publicEnv";

export type PreviewSnackFiles = Record<string, string>;
export type PreviewSnackDependencies = Record<string, string>;

export type PreviewRuntime = "web" | "mobile";

const normalizePreviewRuntimeDefault = (
  runtime?: string | null,
): PreviewRuntime => {
  if (typeof runtime !== "string") return "web";
  return runtime.trim().toLowerCase() === "mobile" ? "mobile" : "web";
};

export const DEFAULT_PREVIEW_RUNTIME: PreviewRuntime =
  normalizePreviewRuntimeDefault(NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT);

export const DEFAULT_PREVIEW_SNACK_NAME = "superblocks-mobile-preview";
export const DEFAULT_PREVIEW_SNACK_DESCRIPTION =
  "Default React Native starter app for Superblocks mobile live preview.";
export const DEFAULT_PREVIEW_SNACK_SDK_VERSION = "54.0.0";

export const PREVIEW_SDK_54_CORE_DEPENDENCIES: PreviewSnackDependencies = {
  expo: "~54.0.0",
  react: "19.1.0",
  "react-native": "0.81.5",
  "react-dom": "19.1.0",
  "react-native-web": "^0.21.0",
};

export const DEFAULT_PREVIEW_SNACK_DEPENDENCIES: PreviewSnackDependencies = {
  ...PREVIEW_SDK_54_CORE_DEPENDENCIES,
};

const DEFAULT_PACKAGE_JSON = `{
  "name": "superblocks-mobile-preview-app",
  "version": "1.0.0",
  "private": true,
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start"
  },
  "dependencies": {
    "expo": "~54.0.0",
    "react": "19.1.0",
    "react-native": "0.81.5",
    "react-dom": "19.1.0",
    "react-native-web": "^0.21.0"
  }
}`;

const DEFAULT_APP_JSON = `{
  "expo": {
    "name": "Superblocks Mobile Preview",
    "slug": "superblocks-mobile-preview",
    "version": "1.0.0"
  }
}`;

const DEFAULT_BABEL_CONFIG = `module.exports = function(api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
`;

const DEFAULT_README = `# Superblocks Mobile Preview

This is the default React Native starter loaded in the mobile live preview.
`;

export const DEFAULT_PREVIEW_SNACK_FILES: PreviewSnackFiles = {
  "App.js": DEFAULT_REACT_NATIVE_APP_SOURCE,
  "package.json": DEFAULT_PACKAGE_JSON,
  "app.json": DEFAULT_APP_JSON,
  "babel.config.js": DEFAULT_BABEL_CONFIG,
  "README.md": DEFAULT_README,
};

// Only treat explicit native frameworks as mobile runtime.
const MOBILE_FRAMEWORK_REGEX = /(react\\s*native|expo)/i;

export const inferPreviewRuntime = (
  framework?: string | null,
): PreviewRuntime => {
  if (!framework) return DEFAULT_PREVIEW_RUNTIME;
  return MOBILE_FRAMEWORK_REGEX.test(framework) ? "mobile" : "web";
};
