import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "./index.js"

afterEach(cleanup)

describe("root component API", () => {
  it("opens a dialog, labels it, closes it with the keyboard, and restores focus", async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger render={<Button />}>Edit profile</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Update your account details.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button />}>Save</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
    const trigger = screen.getByRole("button", { name: "Edit profile" })
    await user.click(trigger)
    const dialog = await screen.findByRole("dialog", { name: "Edit profile" })
    expect(within(dialog).getByText("Update your account details.")).toBeTruthy()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("supports keyboard tab selection and disabled buttons", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Button disabled>Unavailable</Button>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
          <TabsContent value="account">Account settings</TabsContent>
          <TabsContent value="billing">Billing settings</TabsContent>
        </Tabs>
      </>
    )
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Account" }))
    await user.keyboard("{ArrowRight}{Enter}")
    expect(screen.getByRole("tab", { name: "Billing" }).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("tabpanel").textContent).toBe("Billing settings")
  })
})
