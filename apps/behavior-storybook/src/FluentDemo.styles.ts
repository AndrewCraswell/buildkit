import { makeStyles, tokens } from "@fluentui/react-components"
export const useFluentDemoStyles = makeStyles({
  surface: { padding: tokens.spacingHorizontalXXL, borderRadius: tokens.borderRadiusLarge },
  content: { display: "grid", gap: tokens.spacingVerticalL, maxWidth: "640px" },
  actions: {
    border: 0,
    margin: 0,
    padding: 0,
    minWidth: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS
  }
})
