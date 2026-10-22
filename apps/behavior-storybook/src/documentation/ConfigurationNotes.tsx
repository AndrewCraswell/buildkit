export function ConfigurationNotes() {
  return (
    <>
      <h2>Configuration or preferences?</h2>
      <p>
        Configuration represents decisions supplied by an application or provider: rollout eligibility, experiment
        variants, or an app&apos;s default language. Preferences represents choices made by a user, such as their
        selected language or theme.
      </p>
      <p>
        For language, resolve the user&apos;s preference first, then fall back to the configured default. Changing or
        resetting that preference does not change configuration. Developer configuration overrides use preferences
        internally for storage, but remain a separate namespace and purpose.
      </p>
      <h2>Provider adapters</h2>
      <p>
        A provider receives typed context and an abort signal, returns evaluated settings, and can notify the client
        when values change. An adapter can translate a flighting or configuration service into that contract. No vendor
        SDK is included; the adapter owns SDK initialization, context mapping, and experiment tracking.
      </p>
    </>
  )
}
