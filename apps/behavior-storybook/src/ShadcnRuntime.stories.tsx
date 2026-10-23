import {
  Button,
  ShadcnLocalizationProvider,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Combobox,
  ComboboxInput,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription
} from "@buildkitgg/shadcn-baseui-kit"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import "@buildkitgg/shadcn-baseui-kit/styles.css"

function RuntimeExample() {
  const [isRtl, setIsRtl] = useState(false)
  const direction = isRtl ? "rtl" : "ltr"
  return (
    <ShadcnLocalizationProvider
      direction={direction}
      strings={isRtl ? { close: "بند کریں", showOptions: "اختیارات دکھائیں", clear: "صاف کریں" } : {}}
    >
      <main dir={direction} style={{ padding: 24, display: "grid", gap: 20, maxWidth: 640 }}>
        <Button onClick={() => setIsRtl(!isRtl)}>Switch direction and language</Button>
        <Tabs defaultValue="first">
          <TabsList>
            <TabsTrigger value="first">First</TabsTrigger>
            <TabsTrigger value="second">Second</TabsTrigger>
          </TabsList>
          <TabsContent value="first">First panel</TabsContent>
          <TabsContent value="second">Second panel</TabsContent>
        </Tabs>
        <Combobox defaultValue="Tea">
          <ComboboxInput aria-label="Drink" showClear />
        </Combobox>
        <Dialog>
          <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
          <DialogContent dir={direction}>
            <DialogTitle>Localized controls</DialogTitle>
            <DialogDescription>Close labels follow the provider.</DialogDescription>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger render={<Button />}>Open sheet</SheetTrigger>
          <SheetContent side={isRtl ? "right" : "left"} dir={direction}>
            <SheetTitle>Direction</SheetTitle>
            <SheetDescription>The sheet follows the reading direction.</SheetDescription>
          </SheetContent>
        </Sheet>
        <div className="dark" style={{ padding: 16 }}>
          <div className="light" style={{ padding: 16 }}>
            <Button variant="outline">Light island</Button>
          </div>
        </div>
      </main>
    </ShadcnLocalizationProvider>
  )
}
const meta = { title: "shadcn/Runtime", component: RuntimeExample } satisfies Meta<typeof RuntimeExample>
export default meta
type Story = StoryObj<typeof meta>
export const LocalizationAndDirection: Story = {}
export const Mobile: Story = {
  render: () => (
    <iframe
      title="Mobile runtime example"
      src="./iframe.html?id=shadcn-runtime--localization-and-direction&viewMode=story"
      style={{ width: 375, maxWidth: "100%", height: 720, border: 0 }}
    />
  )
}
