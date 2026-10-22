"use client"
import { createConfiguration as createCoreConfiguration } from "@buildkitgg/configuration-core"
import type {
  ConfigurationClient,
  ConfigurationOptions,
  ConfigurationSnapshot,
  SettingKey,
  SettingState,
  SettingValue
} from "@buildkitgg/configuration-core"
import { useConfiguration as useClientConfiguration } from "./useConfiguration.js"
import { useSetting as useClientSetting } from "./useSetting.js"

/** Core commands and React subscriptions bound to one isolated client. */
export type ReactConfigurationClient<T extends object, Context extends object> = ConfigurationClient<T, Context> & {
  useSetting<K extends SettingKey<T>>(key: K): SettingState<T[K]>
  useConfiguration(): ConfigurationSnapshot<T, Context>
}

/** Create once at the application boundary; call the bound hooks inside React components. */
export function createConfiguration<T extends object, Context extends object>(
  options: ConfigurationOptions<T, Context> & (T extends { [K in keyof T]: SettingValue } ? unknown : never)
): ReactConfigurationClient<T, Context> {
  const client = createCoreConfiguration<T, Context>(options)
  return Object.assign(client, {
    useSetting<K extends SettingKey<T>>(key: K): SettingState<T[K]> {
      return useClientSetting(client, key)
    },
    useConfiguration(): ConfigurationSnapshot<T, Context> {
      return useClientConfiguration(client)
    }
  })
}
