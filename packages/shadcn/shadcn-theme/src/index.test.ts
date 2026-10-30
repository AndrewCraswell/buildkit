import { afterEach, expect, it, vi } from "vite-plus/test"
import { createShadcnTheme, getThemeInitScript } from "./index.js"

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.className = ""
  document.documentElement.style.colorScheme = ""
  localStorage.clear()
})

it("applies persisted preferences to the portal ancestor and cleans up the last owner", () => {
  document.documentElement.className = "brand"
  document.documentElement.style.colorScheme = "normal"
  localStorage.setItem("brand-theme", '{"theme":"dark"}')
  const theme = createShadcnTheme({ storageKey: "brand-theme" })
  expect(document.documentElement.classList.contains("dark")).toBe(false)
  const stop = theme.start()
  const stopSecond = theme.start()
  expect(document.documentElement.className).toBe("brand dark")
  expect(document.documentElement.style.colorScheme).toBe("dark")
  theme.setTheme("light")
  expect(localStorage.getItem("brand-theme")).toBe('{"theme":"light"}')
  expect(document.documentElement.className).toBe("brand")
  stop()
  stop()
  theme.setTheme("dark")
  expect(document.documentElement.className).toBe("brand dark")
  stopSecond()
  expect(document.documentElement.className).toBe("brand")
  expect(document.documentElement.style.colorScheme).toBe("normal")
  theme.start()()
})

it("constructs and starts harmlessly on the server", () => {
  vi.stubGlobal("window", undefined)
  const theme = createShadcnTheme()
  expect(theme.getServerSnapshot().theme).toBe("system")
  theme.start()()
})

it("generates an early script with safely encoded configuration", () => {
  expect(getThemeInitScript()).toContain('"defaultTheme":"system"')
  const script = getThemeInitScript({ storageKey: "</script><script>alert(1)</script>", defaultTheme: "dark" })
  expect(script).not.toContain("</script>")
  expect(script).toContain("\\u003c/script>")
  expect(script).toContain('"defaultTheme":"dark"')
})
