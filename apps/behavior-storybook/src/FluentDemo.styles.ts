import { makeStyles, tokens } from "@fluentui/react-components"
export const useFluentDemoStyles = makeStyles({
  surface: {
    padding: tokens.spacingHorizontalL,
    borderRadius: tokens.borderRadiusMedium,
    "--foreground": tokens.colorNeutralForeground1,
    "--muted-foreground": tokens.colorNeutralForeground2,
    "--border": tokens.colorNeutralStroke2
  },
  content: { display: "grid", gap: tokens.spacingVerticalL, maxWidth: "520px" },
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
