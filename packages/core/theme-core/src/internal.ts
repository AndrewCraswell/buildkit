import type { PreferencesStore } from "@buildkitgg/preferences-core"
import type { Theme } from "./index.js"

// Key by the stable snapshot function so adapters can wrap the public store.
export const themePreferences = new WeakMap<object, PreferencesStore<{ theme: Theme }>>()
