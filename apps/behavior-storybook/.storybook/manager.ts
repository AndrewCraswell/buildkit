import { addons } from "storybook/manager-api"
import { create } from "storybook/theming"
addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "Buildkit",
    brandUrl: "?path=/story/getting-started--welcome",
    brandTarget: "_self",
    colorPrimary: "#243552",
    colorSecondary: "#315bd6",
    appBg: "#f8fafc",
    appContentBg: "#ffffff",
    appBorderColor: "#e2e7ee",
    textColor: "#334155",
    barSelectedColor: "#315bd6",
    fontBase: "system-ui, sans-serif"
  }),
  sidebar: { showRoots: true },
  showPanel: false
})
