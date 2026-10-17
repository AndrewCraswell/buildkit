import { addons } from "storybook/manager-api"
import { create } from "storybook/theming"
addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "Buildkit",
    brandUrl: "?path=/story/getting-started--welcome",
    brandTarget: "_self",
    colorPrimary: "#183c56",
    colorSecondary: "#1769aa",
    fontBase: "system-ui, sans-serif"
  }),
  sidebar: { showRoots: true },
  showPanel: false
})
