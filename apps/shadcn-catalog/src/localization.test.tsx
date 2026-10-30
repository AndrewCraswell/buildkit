import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  ShadcnLocalizationProvider,
  PaginationPrevious,
  PaginationNext,
  Combobox,
  ComboboxInput,
  ComboboxChips,
  ComboboxChip,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  setCn
} from "@buildkitgg/shadcn-baseui-kit"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createCn } from "cn/config"
import { afterEach, expect, it } from "vite-plus/test"

afterEach(() => {
  cleanup()
  setCn()
})

it("localizes internal portaled controls and updates an open dialog", async () => {
  function Example({ close }: { close: string }) {
    return (
      <ShadcnLocalizationProvider strings={{ close }}>
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Example</DialogTitle>
            <DialogDescription>Details</DialogDescription>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>
      </ShadcnLocalizationProvider>
    )
  }
  const user = userEvent.setup()
  const view = render(<Example close="Fermer" />)
  await user.click(screen.getByRole("button", { name: "Open" }))
  expect(screen.getAllByRole("button", { name: "Fermer" })).toHaveLength(2)
  view.rerender(<Example close="Schließen" />)
  expect(screen.getAllByRole("button", { name: "Schließen" })).toHaveLength(2)
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("names internal combobox buttons and respects component label overrides", () => {
  render(
    <ShadcnLocalizationProvider
      strings={{
        showOptions: "Options",
        clear: "Effacer",
        removeItem: (label) => `Retirer ${label}`,
        loading: "Chargement",
        previous: "Avant",
        previousPage: "Page précédente"
      }}
    >
      <Combobox defaultValue="Tea">
        <ComboboxInput aria-label="Drink" showClear />
      </Combobox>
      <Combobox multiple defaultValue={["Tea"]}>
        <ComboboxChips>
          <ComboboxChip>Tea</ComboboxChip>
        </ComboboxChips>
      </Combobox>
      <PaginationPrevious />
      <PaginationNext text="Custom next" aria-label="Custom page" />
      <Spinner />
    </ShadcnLocalizationProvider>
  )
  expect(screen.getByRole("button", { name: "Options" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Effacer" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Retirer Tea" })).toBeTruthy()
  expect(screen.getByLabelText("Page précédente").textContent).toContain("Avant")
  expect(screen.getByLabelText("Custom page").textContent).toContain("Custom next")
  expect(screen.getByRole("status", { name: "Chargement" })).toBeTruthy()
})

it("uses the configured merger inside components", () => {
  setCn(createCn({ extend: { classGroups: { "font-size": [{ text: ["meta"] }] } } }))
  render(<Button className="text-meta text-red-500">Custom</Button>)
  const button = screen.getByRole("button")
  expect(button.className).toContain("text-meta")
  expect(button.className).toContain("text-red-500")
  expect(button.classList.contains("text-sm")).toBe(false)
})

it("uses RTL arrow-key navigation through the shared direction export", async () => {
  const user = userEvent.setup()
  render(
    <ShadcnLocalizationProvider direction="rtl">
      <div dir="rtl">
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">First</TabsContent>
          <TabsContent value="two">Second</TabsContent>
        </Tabs>
      </div>
    </ShadcnLocalizationProvider>
  )
  await user.click(screen.getByRole("tab", { name: "One" }))
  await user.keyboard("{ArrowLeft}{Enter}")
  expect(screen.getByRole("tab", { name: "Two" }).getAttribute("aria-selected")).toBe("true")
})
