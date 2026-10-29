/** `@buildkitgg/scaffolder`: manifests, the resolver and the pure planner. No file system, no git. */
export {
  defineAddon,
  defineCatalog,
  definePack,
  definePoint,
  definePreset,
  defineSlot,
  defineTarget,
  defineTemplate
} from "./manifest/define.js"
export { findAddon, findPreset, findTemplate, lookupAddon, shortName, slotAddons } from "./manifest/catalog.js"
export type { NameLookup } from "./manifest/catalog.js"
export { mergePacks, templateSource } from "./manifest/packs.js"
export type { LoadedPack, TemplateSource } from "./manifest/packs.js"
export type {
  AddonManifest,
  Answers,
  Band,
  CatalogManifest,
  ContributeContext,
  Contribution,
  EntryValue,
  FileClass,
  JsonOp,
  Migration,
  MutableTree,
  Order,
  Ownership,
  PackRecord,
  PointDefinition,
  PointKind,
  PresetManifest,
  ResolveContext,
  SlotDefinition,
  SlotPolicy,
  TargetContext,
  TargetInfo,
  TargetManifest,
  TargetMode,
  TemplateManifest,
  TemplatePack
} from "./manifest/types.js"
export { checkCatalog, pairwiseAnswers } from "./resolve/check.js"
export { describeCatalog, optionQuestions, optionsSchema, templateQuestions } from "./resolve/questions.js"
export type {
  CatalogDescription,
  Choice,
  OptionQuestion,
  SlotQuestion,
  TemplateQuestions
} from "./resolve/questions.js"
export { projectNameProblem } from "./resolve/resolve.js"
export { requestArgv } from "./plan/argv.js"
export { artifactName, exitCode, toEnvelope } from "./plan/envelope.js"
export type { Envelope, EnvelopeStatus } from "./plan/envelope.js"
export { PlanError } from "./plan/errors.js"
export { explain } from "./plan/explain.js"
export type { Explanation } from "./plan/explain.js"
export { pathProblem } from "./plan/paths.js"
export { plan } from "./plan/plan.js"
export { planRequestSchema } from "./plan/request-schema.js"
export type { PlanInput } from "./plan/plan.js"
export { memoryTree } from "./plan/tree.js"
export type { FileState, VirtualTree } from "./plan/tree.js"
export type {
  CommandHint,
  ConflictKind,
  DecisionChoice,
  EnvVar,
  ErrorCode,
  Intent,
  MigrationNote,
  Notice,
  Operation,
  OperationClass,
  PackageChange,
  Plan,
  PlanConflict,
  PlanDecision,
  PlanErrorInfo,
  PlanRequest,
  PlanStatus,
  PulledAddon,
  Resolution,
  UpgradeSummary
} from "./plan/types.js"
export { hashText, normalizeText } from "./ownership/text.js"
export { readConfig, readLock } from "./state/files.js"
export { lockFileEntrySchema, lockSchema, projectConfigSchema } from "./state/schemas.js"
export type { Lock, LockFileEntry, ProjectConfig } from "./state/schemas.js"
export { defineSettings, lockPath } from "./state/settings.js"
export type { ProductSettings } from "./state/settings.js"
export { compareVersions } from "./upgrade/semver.js"
export { engineVersion } from "./version.js"
