import * as U from "@buildkitgg/shadcn-baseui-kit"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Bar, BarChart, XAxis } from "recharts"
import { toast as notify } from "sonner"
import { expect, userEvent, within, waitFor } from "storybook/test"

const meta = { title: "Components", parameters: { controls: { disable: true } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Accordion: Story = {
  parameters: { docs: { description: { story: "Expandable answers with one section open by default." } } },
  render: () => (
    <U.Accordion defaultValue={["one"]}>
      <U.AccordionItem value="one">
        <U.AccordionTrigger>What is included?</U.AccordionTrigger>
        <U.AccordionContent>Every installable Base UI component, available from one package.</U.AccordionContent>
      </U.AccordionItem>
      <U.AccordionItem value="two">
        <U.AccordionTrigger>Do I need a registry?</U.AccordionTrigger>
        <U.AccordionContent>No. Import components and the compiled stylesheet.</U.AccordionContent>
      </U.AccordionItem>
    </U.Accordion>
  )
}
export const Alert: Story = {
  parameters: { docs: { description: { story: "Persistent status messages in standard and error states." } } },
  render: () => (
    <div className="demo-stack">
      <U.Alert>
        <U.AlertTitle>Changes saved</U.AlertTitle>
        <U.AlertDescription>Your workspace is up to date.</U.AlertDescription>
      </U.Alert>
      <U.Alert variant="destructive">
        <U.AlertTitle>Upload failed</U.AlertTitle>
        <U.AlertDescription>Check your connection and try again.</U.AlertDescription>
      </U.Alert>
    </div>
  )
}
export const AlertDialog: Story = {
  parameters: { docs: { description: { story: "Confirm a destructive action before proceeding." } } },
  render: () => (
    <U.AlertDialog>
      <U.AlertDialogTrigger render={<U.Button variant="destructive" />}>Delete draft</U.AlertDialogTrigger>
      <U.AlertDialogContent>
        <U.AlertDialogHeader>
          <U.AlertDialogTitle>Delete this draft?</U.AlertDialogTitle>
          <U.AlertDialogDescription>This is a demonstration. No data will be deleted.</U.AlertDialogDescription>
        </U.AlertDialogHeader>
        <U.AlertDialogFooter>
          <U.AlertDialogCancel>Cancel</U.AlertDialogCancel>
          <U.AlertDialogAction>Delete</U.AlertDialogAction>
        </U.AlertDialogFooter>
      </U.AlertDialogContent>
    </U.AlertDialog>
  )
}
export const AspectRatio: Story = {
  parameters: { docs: { description: { story: "Keep media at a consistent aspect ratio as the container resizes." } } },
  render: () => (
    <div style={{ width: "min(100%, 560px)" }}>
      <U.AspectRatio ratio={16 / 9}>
        <div
          style={{
            height: "100%",
            display: "grid",
            placeItems: "center",
            background: "var(--muted)",
            borderRadius: 12
          }}
        >
          16:9 media area
        </div>
      </U.AspectRatio>
    </div>
  )
}
export const Attachment: Story = {
  parameters: { docs: { description: { story: "File metadata in a compact attachment row." } } },
  render: () => (
    <U.Attachment>
      <U.AttachmentContent>
        <U.AttachmentTitle>project-brief.pdf</U.AttachmentTitle>
        <U.AttachmentDescription>PDF, 240 KB</U.AttachmentDescription>
      </U.AttachmentContent>
    </U.Attachment>
  )
}
export const Avatar: Story = {
  parameters: { docs: { description: { story: "Initials when a profile image is unavailable." } } },
  render: () => (
    <div className="demo-row">
      <U.Avatar>
        <U.AvatarFallback>AJ</U.AvatarFallback>
      </U.Avatar>
      <U.Avatar>
        <U.AvatarFallback>BK</U.AvatarFallback>
      </U.Avatar>
    </div>
  )
}
export const Badge: Story = {
  parameters: { docs: { description: { story: "Compact labels for status and lifecycle states." } } },
  render: () => (
    <div className="demo-row">
      <U.Badge>Active</U.Badge>
      <U.Badge variant="secondary">Draft</U.Badge>
      <U.Badge variant="outline">Archived</U.Badge>
      <U.Badge variant="destructive">Failed</U.Badge>
    </div>
  )
}
export const Breadcrumb: Story = {
  parameters: { docs: { description: { story: "Show the current page within a navigation hierarchy." } } },
  render: () => (
    <U.Breadcrumb>
      <U.BreadcrumbList>
        <U.BreadcrumbItem>
          <U.BreadcrumbLink href="#home">Home</U.BreadcrumbLink>
        </U.BreadcrumbItem>
        <U.BreadcrumbSeparator />
        <U.BreadcrumbItem>
          <U.BreadcrumbLink href="#projects">Projects</U.BreadcrumbLink>
        </U.BreadcrumbItem>
        <U.BreadcrumbSeparator />
        <U.BreadcrumbItem>
          <U.BreadcrumbPage>Website</U.BreadcrumbPage>
        </U.BreadcrumbItem>
      </U.BreadcrumbList>
    </U.Breadcrumb>
  )
}
export const Bubble: Story = {
  parameters: { docs: { description: { story: "Incoming and outgoing messages in a conversation." } } },
  render: () => (
    <U.BubbleGroup>
      <U.Bubble variant="muted">
        <U.BubbleContent>Can you review the draft?</U.BubbleContent>
      </U.Bubble>
      <U.Bubble align="end">
        <U.BubbleContent>Yes, I will take a look.</U.BubbleContent>
      </U.Bubble>
    </U.BubbleGroup>
  )
}
export const Button: Story = {
  parameters: { docs: { description: { story: "Primary, secondary, destructive, and disabled actions." } } },
  render: () => (
    <div className="demo-row">
      <U.Button>Continue</U.Button>
      <U.Button variant="secondary">Secondary</U.Button>
      <U.Button variant="outline">Outline</U.Button>
      <U.Button variant="ghost">Ghost</U.Button>
      <U.Button variant="destructive">Delete</U.Button>
      <U.Button disabled>Disabled</U.Button>
    </div>
  )
}
export const ButtonGroup: Story = {
  parameters: { docs: { description: { story: "Related document actions in a single control group." } } },
  render: () => (
    <U.ButtonGroup aria-label="Document actions">
      <U.Button variant="outline">Save</U.Button>
      <U.Button variant="outline">Duplicate</U.Button>
      <U.Button variant="outline">Archive</U.Button>
    </U.ButtonGroup>
  )
}
function CalendarExample() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 16))
  return <U.Calendar mode="single" selected={date} onSelect={setDate} defaultMonth={new Date(2026, 9, 1)} />
}
export const Calendar: Story = {
  parameters: { docs: { description: { story: "Choose a date using pointer or keyboard navigation." } } },
  render: () => <CalendarExample />
}
export const Card: Story = {
  parameters: { docs: { description: { story: "A workspace summary with one primary action." } } },
  render: () => (
    <U.Card style={{ maxWidth: 400 }}>
      <U.CardHeader>
        <U.CardTitle>Team workspace</U.CardTitle>
        <U.CardDescription>Everything you need for your next project.</U.CardDescription>
      </U.CardHeader>
      <U.CardContent>Invite colleagues and keep your work together.</U.CardContent>
      <U.CardFooter>
        <U.Button>Open workspace</U.Button>
      </U.CardFooter>
    </U.Card>
  )
}
export const Carousel: Story = {
  parameters: { docs: { description: { story: "Browse a small collection with previous and next controls." } } },
  render: () => (
    <U.Carousel style={{ maxWidth: 400, margin: "0 40px" }}>
      <U.CarouselContent>
        {[1, 2, 3].map((n) => (
          <U.CarouselItem key={n}>
            <U.Card>
              <U.CardContent className="demo-panel demo-carousel-card">
                {["Research notes", "Design proposal", "Launch checklist"][n - 1]}
              </U.CardContent>
            </U.Card>
          </U.CarouselItem>
        ))}
      </U.CarouselContent>
      <U.CarouselPrevious />
      <U.CarouselNext />
    </U.Carousel>
  )
}
export const Chart: Story = {
  parameters: { docs: { description: { story: "Monthly visitors with an accessible tooltip." } } },
  render: () => (
    <U.ChartContainer
      style={{ height: 260, width: "100%", maxWidth: 560 }}
      config={{ visitors: { label: "Visitors", color: "var(--primary)" } }}
    >
      <BarChart
        accessibilityLayer
        data={[
          { month: "Jan", visitors: 120 },
          { month: "Feb", visitors: 180 },
          { month: "Mar", visitors: 150 }
        ]}
      >
        <XAxis dataKey="month" />
        <U.ChartTooltip content={<U.ChartTooltipContent />} />
        <Bar dataKey="visitors" fill="var(--color-visitors)" radius={4} />
      </BarChart>
    </U.ChartContainer>
  )
}
export const Checkbox: Story = {
  parameters: { docs: { description: { story: "A selected preference alongside an unavailable option." } } },
  render: () => (
    <div className="demo-row">
      <U.Checkbox id="updates" defaultChecked />
      <U.Label htmlFor="updates">Receive project updates</U.Label>
      <U.Checkbox aria-label="Unavailable option" disabled />
    </div>
  )
}
export const CodeBlock: Story = {
  parameters: { docs: { description: { story: "A code sample with a copy action." } } },
  render: () => (
    <U.CodeBlock>
      <U.CodeBlockHeader>
        <U.CodeBlockTitle>example.tsx</U.CodeBlockTitle>
        <U.CodeBlockActions>
          <U.CodeBlockCopyButton value={'import { Button } from "@buildkitgg/shadcn-baseui-kit"'} />
        </U.CodeBlockActions>
      </U.CodeBlockHeader>
      <U.CodeBlockContent>
        <U.CodeBlockLine>{'import { Button } from "@buildkitgg/shadcn-baseui-kit"'}</U.CodeBlockLine>
        <U.CodeBlockLine>{"<Button>Continue</Button>"}</U.CodeBlockLine>
      </U.CodeBlockContent>
    </U.CodeBlock>
  )
}
export const Collapsible: Story = {
  parameters: { docs: { description: { story: "Reveal supporting project information on demand." } } },
  render: () => (
    <U.Collapsible>
      <U.CollapsibleTrigger render={<U.Button variant="outline" />}>Show project details</U.CollapsibleTrigger>
      <U.CollapsibleContent>
        <p>Owner: Alex. Status: In progress.</p>
      </U.CollapsibleContent>
    </U.Collapsible>
  )
}
export const Combobox: Story = {
  parameters: { docs: { description: { story: "Filter a list and select a framework." } } },
  render: () => (
    <U.Combobox items={["React", "Vue", "Svelte"]}>
      <U.ComboboxInput aria-label="Framework" placeholder="Select a framework" />
      <U.ComboboxContent>
        <U.ComboboxEmpty>No frameworks found.</U.ComboboxEmpty>
        <U.ComboboxList>
          {(item: string) => (
            <U.ComboboxItem key={item} value={item}>
              {item}
            </U.ComboboxItem>
          )}
        </U.ComboboxList>
      </U.ComboboxContent>
    </U.Combobox>
  )
}
export const Command: Story = {
  parameters: { docs: { description: { story: "Search the available workspace actions." } } },
  render: () => (
    <U.Command style={{ maxWidth: 400 }}>
      <U.CommandInput placeholder="Search actions" />
      <U.CommandList>
        <U.CommandEmpty>No actions found.</U.CommandEmpty>
        <U.CommandGroup heading="Actions">
          <U.CommandItem>Open project</U.CommandItem>
          <U.CommandItem>Invite member</U.CommandItem>
          <U.CommandItem>Settings</U.CommandItem>
        </U.CommandGroup>
      </U.CommandList>
    </U.Command>
  )
}
export const ContextMenu: Story = {
  parameters: { docs: { description: { story: "Contextual actions for a project file." } } },
  render: () => (
    <U.ContextMenu>
      <U.ContextMenuTrigger>
        <div style={{ padding: 48, border: "1px dashed var(--border)" }}>Project brief — right-click for actions</div>
      </U.ContextMenuTrigger>
      <U.ContextMenuContent>
        <U.ContextMenuItem>Copy</U.ContextMenuItem>
        <U.ContextMenuItem>Duplicate</U.ContextMenuItem>
        <U.ContextMenuSeparator />
        <U.ContextMenuItem disabled>Delete</U.ContextMenuItem>
      </U.ContextMenuContent>
    </U.ContextMenu>
  )
}
export const Dialog: Story = {
  parameters: { docs: { description: { story: "Edit a profile and return focus to the trigger." } } },
  render: () => (
    <U.Dialog>
      <U.DialogTrigger render={<U.Button />}>Edit profile</U.DialogTrigger>
      <U.DialogContent>
        <U.DialogHeader>
          <U.DialogTitle>Edit profile</U.DialogTitle>
          <U.DialogDescription>Update your display name.</U.DialogDescription>
        </U.DialogHeader>
        <U.Label htmlFor="profile-name">Name</U.Label>
        <U.Input id="profile-name" defaultValue="Alex" />
        <U.DialogFooter>
          <U.DialogClose render={<U.Button />}>Save changes</U.DialogClose>
        </U.DialogFooter>
      </U.DialogContent>
    </U.Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Edit profile" })
    await userEvent.click(trigger)
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole("dialog", { name: "Edit profile" })).toBeVisible()
    await userEvent.click(body.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(trigger).toHaveFocus())
  }
}
export const Direction: Story = {
  parameters: { docs: { description: { story: "Right-to-left navigation using the direction provider." } } },
  render: () => (
    <U.DirectionProvider direction="rtl">
      <div dir="rtl">
        <U.Breadcrumb>
          <U.BreadcrumbList>
            <U.BreadcrumbItem>
              <U.BreadcrumbLink href="#home">الرئيسية</U.BreadcrumbLink>
            </U.BreadcrumbItem>
            <U.BreadcrumbSeparator />
            <U.BreadcrumbItem>
              <U.BreadcrumbPage>المشاريع</U.BreadcrumbPage>
            </U.BreadcrumbItem>
          </U.BreadcrumbList>
        </U.Breadcrumb>
      </div>
    </U.DirectionProvider>
  )
}
export const Drawer: Story = {
  parameters: { docs: { description: { story: "A compact progress summary in a bottom drawer." } } },
  render: () => (
    <U.Drawer>
      <U.DrawerTrigger render={<U.Button />}>Open drawer</U.DrawerTrigger>
      <U.DrawerContent>
        <U.DrawerHeader>
          <U.DrawerTitle>Daily goal</U.DrawerTitle>
          <U.DrawerDescription>Review your progress for today.</U.DrawerDescription>
        </U.DrawerHeader>
        <p className="demo-panel">You completed 8 of 10 tasks.</p>
        <U.DrawerFooter>
          <U.DrawerClose render={<U.Button />}>Done</U.DrawerClose>
        </U.DrawerFooter>
      </U.DrawerContent>
    </U.Drawer>
  )
}
export const DropdownMenu: Story = {
  parameters: { docs: { description: { story: "Account actions in an anchored menu." } } },
  render: () => (
    <U.DropdownMenu>
      <U.DropdownMenuTrigger render={<U.Button variant="outline" />}>Account menu</U.DropdownMenuTrigger>
      <U.DropdownMenuContent>
        <U.DropdownMenuLabel>My account</U.DropdownMenuLabel>
        <U.DropdownMenuSeparator />
        <U.DropdownMenuItem>Profile</U.DropdownMenuItem>
        <U.DropdownMenuItem>Settings</U.DropdownMenuItem>
        <U.DropdownMenuItem disabled>Billing</U.DropdownMenuItem>
      </U.DropdownMenuContent>
    </U.DropdownMenu>
  )
}
export const Empty: Story = {
  parameters: { docs: { description: { story: "An empty collection with a clear next action." } } },
  render: () => (
    <U.Empty>
      <U.EmptyHeader>
        <U.EmptyTitle>No projects yet</U.EmptyTitle>
        <U.EmptyDescription>Create a project to start collaborating.</U.EmptyDescription>
      </U.EmptyHeader>
      <U.EmptyContent>
        <U.Button>Create project</U.Button>
      </U.EmptyContent>
    </U.Empty>
  )
}
export const Field: Story = {
  parameters: { docs: { description: { story: "A labeled input with supporting text and a validation error." } } },
  render: () => (
    <U.FieldGroup>
      <U.Field>
        <U.FieldLabel htmlFor="email">Email</U.FieldLabel>
        <U.Input id="email" type="email" placeholder="alex@example.com" />
        <U.FieldDescription>We use this address for project updates.</U.FieldDescription>
      </U.Field>
      <U.Field data-invalid>
        <U.FieldLabel htmlFor="username">Username</U.FieldLabel>
        <U.Input id="username" aria-invalid defaultValue="a" />
        <U.FieldError>Use at least three characters.</U.FieldError>
      </U.Field>
    </U.FieldGroup>
  )
}
export const HoverCard: Story = {
  parameters: { docs: { description: { story: "Additional profile information on hover or keyboard focus." } } },
  render: () => (
    <U.HoverCard>
      <U.HoverCardTrigger render={<U.Button variant="link" />}>@buildkit</U.HoverCardTrigger>
      <U.HoverCardContent>
        <strong>Buildkit</strong>
        <p>Reusable tools for building applications.</p>
      </U.HoverCardContent>
    </U.HoverCard>
  )
}
export const Input: Story = {
  parameters: { docs: { description: { story: "Default, disabled, and invalid text inputs." } } },
  render: () => (
    <div className="demo-stack">
      <U.Label htmlFor="input-email">Email address</U.Label>
      <U.Input id="input-email" type="email" placeholder="alex@example.com" />
      <U.Input aria-label="Disabled input" disabled placeholder="Disabled" />
      <U.Input aria-label="Invalid input" aria-invalid defaultValue="Invalid value" />
    </div>
  )
}
export const InputGroup: Story = {
  parameters: { docs: { description: { story: "A website input with a fixed protocol prefix." } } },
  render: () => (
    <U.InputGroup>
      <U.InputGroupAddon>
        <U.InputGroupText>https://</U.InputGroupText>
      </U.InputGroupAddon>
      <U.InputGroupInput aria-label="Website" placeholder="example.com" />
    </U.InputGroup>
  )
}
export const InputOtp: Story = {
  parameters: { docs: { description: { story: "A six-digit verification code, grouped for readability." } } },
  name: "Input OTP",
  render: () => (
    <U.InputOTP maxLength={6} aria-label="Verification code">
      <U.InputOTPGroup>
        {[0, 1, 2].map((n) => (
          <U.InputOTPSlot key={n} index={n} />
        ))}
      </U.InputOTPGroup>
      <U.InputOTPSeparator />
      <U.InputOTPGroup>
        {[3, 4, 5].map((n) => (
          <U.InputOTPSlot key={n} index={n} />
        ))}
      </U.InputOTPGroup>
    </U.InputOTP>
  )
}
export const Item: Story = {
  parameters: { docs: { description: { story: "A document summary with a trailing action." } } },
  render: () => (
    <U.Item variant="outline">
      <U.ItemContent>
        <U.ItemTitle>Project report</U.ItemTitle>
        <U.ItemDescription>Updated today by Alex</U.ItemDescription>
      </U.ItemContent>
      <U.ItemActions>
        <U.Button variant="outline">Open</U.Button>
      </U.ItemActions>
    </U.Item>
  )
}
export const Kbd: Story = {
  parameters: { docs: { description: { story: "Keyboard shortcuts displayed alongside their action." } } },
  render: () => (
    <p>
      Open search with{" "}
      <U.KbdGroup>
        <U.Kbd>Ctrl</U.Kbd>
        <U.Kbd>K</U.Kbd>
      </U.KbdGroup>
    </p>
  )
}
export const Label: Story = {
  parameters: { docs: { description: { story: "A visible label associated with its input." } } },
  render: () => (
    <div className="demo-stack">
      <U.Label htmlFor="display-name">Display name</U.Label>
      <U.Input id="display-name" defaultValue="Alex" />
    </div>
  )
}
export const Marker: Story = {
  parameters: { docs: { description: { story: "Separate messages by date." } } },
  render: () => (
    <U.Marker variant="separator">
      <U.MarkerContent>Today</U.MarkerContent>
    </U.Marker>
  )
}
export const Menubar: Story = {
  parameters: { docs: { description: { story: "Document commands organized by menu." } } },
  render: () => (
    <U.Menubar>
      <U.MenubarMenu>
        <U.MenubarTrigger>File</U.MenubarTrigger>
        <U.MenubarContent>
          <U.MenubarItem>New document</U.MenubarItem>
          <U.MenubarItem>Open</U.MenubarItem>
          <U.MenubarSeparator />
          <U.MenubarItem>Print</U.MenubarItem>
        </U.MenubarContent>
      </U.MenubarMenu>
      <U.MenubarMenu>
        <U.MenubarTrigger>Edit</U.MenubarTrigger>
        <U.MenubarContent>
          <U.MenubarItem>Undo</U.MenubarItem>
          <U.MenubarItem>Redo</U.MenubarItem>
        </U.MenubarContent>
      </U.MenubarMenu>
    </U.Menubar>
  )
}
export const Message: Story = {
  parameters: { docs: { description: { story: "A short exchange with author information and timestamps." } } },
  render: () => (
    <U.MessageGroup>
      <U.Message>
        <U.MessageAvatar>
          <U.Avatar>
            <U.AvatarFallback>AJ</U.AvatarFallback>
          </U.Avatar>
        </U.MessageAvatar>
        <U.MessageContent>
          <U.MessageHeader>Alex</U.MessageHeader>
          <U.Bubble variant="muted">
            <U.BubbleContent>The draft is ready for review.</U.BubbleContent>
          </U.Bubble>
          <U.MessageFooter>10:30 AM</U.MessageFooter>
        </U.MessageContent>
      </U.Message>
      <U.Message align="end">
        <U.MessageContent>
          <U.Bubble>
            <U.BubbleContent>Thanks, I will review it today.</U.BubbleContent>
          </U.Bubble>
        </U.MessageContent>
      </U.Message>
    </U.MessageGroup>
  )
}
export const MessageScroller: Story = {
  parameters: { docs: { description: { story: "A scrollable conversation with a jump-to-latest control." } } },
  render: () => (
    <U.MessageScrollerProvider>
      <U.MessageScroller style={{ height: 300 }}>
        <U.MessageScrollerViewport>
          <U.MessageScrollerContent>
            {Array.from({ length: 15 }, (_, n) => (
              <U.MessageScrollerItem key={n} messageId={String(n)}>
                <U.Bubble variant="muted">
                  <U.BubbleContent>Project update {n + 1}: the team has made progress.</U.BubbleContent>
                </U.Bubble>
              </U.MessageScrollerItem>
            ))}
          </U.MessageScrollerContent>
        </U.MessageScrollerViewport>
        <U.MessageScrollerButton />
      </U.MessageScroller>
    </U.MessageScrollerProvider>
  )
}
export const NativeSelect: Story = {
  parameters: { docs: { description: { story: "A native select for a short list of time zones." } } },
  render: () => (
    <U.NativeSelect aria-label="Time zone" defaultValue="pacific">
      <U.NativeSelectOption value="pacific">Pacific time</U.NativeSelectOption>
      <U.NativeSelectOption value="eastern">Eastern time</U.NativeSelectOption>
      <U.NativeSelectOption value="utc">UTC</U.NativeSelectOption>
    </U.NativeSelect>
  )
}
export const NavigationMenu: Story = {
  parameters: { docs: { description: { story: "Top-level navigation with a resource menu." } } },
  render: () => (
    <U.NavigationMenu>
      <U.NavigationMenuList>
        <U.NavigationMenuItem>
          <U.NavigationMenuTrigger>Resources</U.NavigationMenuTrigger>
          <U.NavigationMenuContent>
            <U.NavigationMenuLink href="#guides">Guides</U.NavigationMenuLink>
            <U.NavigationMenuLink href="#examples">Examples</U.NavigationMenuLink>
          </U.NavigationMenuContent>
        </U.NavigationMenuItem>
        <U.NavigationMenuItem>
          <U.NavigationMenuLink href="#about">About</U.NavigationMenuLink>
        </U.NavigationMenuItem>
      </U.NavigationMenuList>
    </U.NavigationMenu>
  )
}
function PaginationExample() {
  const [page, setPage] = useState(1)
  return (
    <div className="demo-stack">
      <U.Pagination>
        <U.PaginationContent>
          <U.PaginationItem>
            <U.PaginationPrevious
              href="#page"
              onClick={(event) => {
                event.preventDefault()
                setPage(Math.max(1, page - 1))
              }}
            />
          </U.PaginationItem>
          {[1, 2, 3].map((n) => (
            <U.PaginationItem key={n}>
              <U.PaginationLink
                href="#page"
                isActive={n === page}
                onClick={(event) => {
                  event.preventDefault()
                  setPage(n)
                }}
              >
                {n}
              </U.PaginationLink>
            </U.PaginationItem>
          ))}
          <U.PaginationItem>
            <U.PaginationNext
              href="#page"
              onClick={(event) => {
                event.preventDefault()
                setPage(Math.min(3, page + 1))
              }}
            />
          </U.PaginationItem>
        </U.PaginationContent>
      </U.Pagination>
      <p aria-live="polite">Page {page} of 3</p>
    </div>
  )
}
export const Pagination: Story = {
  parameters: { docs: { description: { story: "Move between pages while keeping the current page visible." } } },
  render: () => <PaginationExample />
}
export const Popover: Story = {
  parameters: { docs: { description: { story: "Supporting project details in an anchored panel." } } },
  render: () => (
    <U.Popover>
      <U.PopoverTrigger render={<U.Button variant="outline" />}>Project details</U.PopoverTrigger>
      <U.PopoverContent>
        <U.PopoverHeader>
          <U.PopoverTitle>Website launch</U.PopoverTitle>
          <U.PopoverDescription>Due October 30. Assigned to Alex.</U.PopoverDescription>
        </U.PopoverHeader>
      </U.PopoverContent>
    </U.Popover>
  )
}
export const Progress: Story = {
  parameters: { docs: { description: { story: "A labeled, determinate upload indicator." } } },
  render: () => (
    <U.Progress value={65}>
      <U.ProgressLabel>Upload progress</U.ProgressLabel>
      <U.ProgressValue />
    </U.Progress>
  )
}
function QuestionnaireExample() {
  const [submitted, setSubmitted] = useState(false)
  return submitted ? (
    <U.Alert>
      <U.AlertTitle>Preferences saved</U.AlertTitle>
      <U.AlertDescription>Your selection has been recorded in this example.</U.AlertDescription>
    </U.Alert>
  ) : (
    <U.Questionnaire
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
      }}
    >
      <U.QuestionnaireItem name="role" required>
        <U.QuestionnaireTitle>What do you work on?</U.QuestionnaireTitle>
        <U.QuestionnaireDescription>Choose your primary role.</U.QuestionnaireDescription>
        <U.QuestionnaireChoices>
          <U.QuestionnaireChoice value="design">
            <span>Design</span>
          </U.QuestionnaireChoice>
          <U.QuestionnaireChoice value="engineering">
            <span>Engineering</span>
          </U.QuestionnaireChoice>
        </U.QuestionnaireChoices>
      </U.QuestionnaireItem>
      <U.Button type="submit">Save preferences</U.Button>
    </U.Questionnaire>
  )
}
export const Questionnaire: Story = {
  parameters: { docs: { description: { story: "Choose a role and submit a single-question form." } } },
  render: () => <QuestionnaireExample />
}
export const RadioGroup: Story = {
  parameters: { docs: { description: { story: "Choose one delivery option." } } },
  render: () => (
    <U.RadioGroup defaultValue="standard" aria-label="Delivery speed">
      <div className="demo-row">
        <U.RadioGroupItem id="standard" value="standard" />
        <U.Label htmlFor="standard">Standard delivery</U.Label>
      </div>
      <div className="demo-row">
        <U.RadioGroupItem id="express" value="express" />
        <U.Label htmlFor="express">Express delivery</U.Label>
      </div>
    </U.RadioGroup>
  )
}
export const Resizable: Story = {
  parameters: { docs: { description: { story: "Adjust the space between navigation and content." } } },
  render: () => (
    <U.ResizablePanelGroup style={{ height: 250, border: "1px solid var(--border)" }}>
      <U.ResizablePanel defaultSize="50%">
        <div className="demo-panel">Navigation</div>
      </U.ResizablePanel>
      <U.ResizableHandle withHandle />
      <U.ResizablePanel defaultSize="50%">
        <div className="demo-panel">Content</div>
      </U.ResizablePanel>
    </U.ResizablePanelGroup>
  )
}
export const ScrollArea: Story = {
  parameters: { docs: { description: { story: "A bounded project list with scrollable content." } } },
  render: () => (
    <U.ScrollArea style={{ height: 250, width: 300, maxWidth: "100%", border: "1px solid var(--border)" }}>
      <div className="demo-panel">
        {Array.from({ length: 20 }, (_, n) => (
          <p key={n}>Project {n + 1}</p>
        ))}
      </div>
    </U.ScrollArea>
  )
}
export const Select: Story = {
  parameters: { docs: { description: { story: "Choose a workspace, with an unavailable plan shown disabled." } } },
  render: () => (
    <U.Select defaultValue="personal" items={{ personal: "Personal", team: "Team", enterprise: "Enterprise" }}>
      <U.SelectTrigger aria-label="Workspace">
        <U.SelectValue />
      </U.SelectTrigger>
      <U.SelectContent>
        <U.SelectItem value="personal">Personal</U.SelectItem>
        <U.SelectItem value="team">Team</U.SelectItem>
        <U.SelectItem value="enterprise" disabled>
          Enterprise
        </U.SelectItem>
      </U.SelectContent>
    </U.Select>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("combobox", { name: "Workspace" }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole("option", { name: "Team" }))
    await expect(canvas.getByRole("combobox", { name: "Workspace" })).toHaveTextContent("Team")
  }
}
export const Separator: Story = {
  parameters: { docs: { description: { story: "Divide related sections without adding visual weight." } } },
  render: () => (
    <div className="demo-stack">
      <p>Account settings</p>
      <U.Separator />
      <p>Manage your profile and preferences.</p>
    </div>
  )
}
export const Sheet: Story = {
  parameters: { docs: { description: { story: "Edit workspace settings in a side panel." } } },
  render: () => (
    <U.Sheet>
      <U.SheetTrigger render={<U.Button />}>Open settings</U.SheetTrigger>
      <U.SheetContent>
        <U.SheetHeader>
          <U.SheetTitle>Settings</U.SheetTitle>
          <U.SheetDescription>Manage your workspace preferences.</U.SheetDescription>
        </U.SheetHeader>
        <div className="demo-panel">
          <U.Label htmlFor="workspace-name">Workspace name</U.Label>
          <U.Input id="workspace-name" defaultValue="Buildkit" />
        </div>
        <U.SheetFooter>
          <U.SheetClose render={<U.Button />}>Done</U.SheetClose>
        </U.SheetFooter>
      </U.SheetContent>
    </U.Sheet>
  )
}
export const Sidebar: Story = {
  parameters: { docs: { description: { story: "Collapsible application navigation with a content area." } } },

  render: () => (
    <U.SidebarProvider style={{ minHeight: 280 }}>
      <U.Sidebar collapsible="icon" className="demo-contained-sidebar">
        <U.SidebarHeader>Buildkit</U.SidebarHeader>
        <U.SidebarContent>
          <U.SidebarGroup>
            <U.SidebarGroupLabel>Workspace</U.SidebarGroupLabel>
            <U.SidebarGroupContent>
              <U.SidebarMenu>
                <U.SidebarMenuItem>
                  <U.SidebarMenuButton isActive>Projects</U.SidebarMenuButton>
                </U.SidebarMenuItem>
                <U.SidebarMenuItem>
                  <U.SidebarMenuButton>Members</U.SidebarMenuButton>
                </U.SidebarMenuItem>
              </U.SidebarMenu>
            </U.SidebarGroupContent>
          </U.SidebarGroup>
        </U.SidebarContent>
        <U.SidebarFooter>Personal workspace</U.SidebarFooter>
      </U.Sidebar>
      <U.SidebarInset>
        <div className="demo-panel demo-sidebar-content">
          <div className="demo-sidebar-heading">
            <U.SidebarTrigger />
            <h2>Projects</h2>
          </div>
          <div className="demo-projects">
            <div className="demo-project">
              <div>
                <strong>Website refresh</strong>
                <p>Design and content</p>
              </div>
              <U.Badge variant="secondary">Active</U.Badge>
            </div>
            <div className="demo-project">
              <div>
                <strong>Component library</strong>
                <p>Shared foundations</p>
              </div>
              <U.Badge variant="outline">Planning</U.Badge>
            </div>
          </div>
        </div>
      </U.SidebarInset>
    </U.SidebarProvider>
  )
}
export const Skeleton: Story = {
  parameters: { docs: { description: { story: "A profile placeholder while data is loading." } } },
  render: () => (
    <div className="demo-row">
      <U.Skeleton style={{ width: 48, height: 48, borderRadius: "50%" }} />
      <div className="demo-stack" style={{ width: 220 }}>
        <U.Skeleton style={{ height: 16, width: "80%" }} />
        <U.Skeleton style={{ height: 16, width: "100%" }} />
      </div>
    </div>
  )
}
export const Slider: Story = {
  parameters: { docs: { description: { story: "Adjust a continuous value with pointer or arrow keys." } } },
  render: () => <U.Slider aria-label="Volume" defaultValue={[40]} max={100} />
}
export const Sonner: Story = {
  parameters: { docs: { description: { story: "Show a notification using the included Sonner component." } } },
  render: () => (
    <>
      <U.SonnerToaster />
      <U.Button onClick={() => notify.success("Changes saved")}>Show notification</U.Button>
    </>
  )
}
export const Spinner: Story = {
  parameters: { docs: { description: { story: "An indeterminate loading state with a visible label." } } },
  render: () => (
    <div className="demo-row">
      <U.Spinner />
      <span>Loading projects</span>
    </div>
  )
}
export const Switch: Story = {
  parameters: { docs: { description: { story: "Turn a preference on or off." } } },
  render: () => (
    <div className="demo-row">
      <U.Switch id="notifications" />
      <U.Label htmlFor="notifications">Enable notifications</U.Label>
    </div>
  )
}
export const Table: Story = {
  parameters: { docs: { description: { story: "A small invoice table with readable status and amounts." } } },
  render: () => (
    <U.Table>
      <U.TableCaption>Recent invoices</U.TableCaption>
      <U.TableHeader>
        <U.TableRow>
          <U.TableHead>Invoice</U.TableHead>
          <U.TableHead>Status</U.TableHead>
          <U.TableHead className="demo-amount">Amount</U.TableHead>
        </U.TableRow>
      </U.TableHeader>
      <U.TableBody>
        {[
          { id: "INV-001", status: "Paid", amount: "$250.00" },
          { id: "INV-002", status: "Pending", amount: "$150.00" }
        ].map((row) => (
          <U.TableRow key={row.id}>
            <U.TableCell>{row.id}</U.TableCell>
            <U.TableCell>
              <U.Badge variant={row.status === "Paid" ? "secondary" : "outline"}>{row.status}</U.Badge>
            </U.TableCell>
            <U.TableCell className="demo-amount">{row.amount}</U.TableCell>
          </U.TableRow>
        ))}
      </U.TableBody>
    </U.Table>
  )
}
export const Tabs: Story = {
  parameters: { docs: { description: { story: "Switch between related settings panels." } } },
  render: () => (
    <U.Tabs defaultValue="account">
      <U.TabsList aria-label="Settings">
        <U.TabsTrigger value="account">Account</U.TabsTrigger>
        <U.TabsTrigger value="billing">Billing</U.TabsTrigger>
      </U.TabsList>
      <U.TabsContent value="account">Manage your account details.</U.TabsContent>
      <U.TabsContent value="billing">Your plan is up to date.</U.TabsContent>
    </U.Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("tab", { name: "Account" }))
    await userEvent.keyboard("{ArrowRight}{Enter}")
    await expect(canvas.getByRole("tab", { name: "Billing" })).toHaveAttribute("aria-selected", "true")
  }
}
export const Textarea: Story = {
  parameters: { docs: { description: { story: "A labeled, multiline message input." } } },
  render: () => (
    <div className="demo-stack">
      <U.Label htmlFor="message">Message</U.Label>
      <U.Textarea id="message" placeholder="Write a message" />
    </div>
  )
}
export const Toast: Story = {
  parameters: { docs: { description: { story: "Display feedback using the included Base UI toast component." } } },
  render: () => (
    <U.Toaster>
      <U.Button
        onClick={() =>
          U.toast.add({ title: "Changes saved", description: "Your workspace is up to date.", type: "success" })
        }
      >
        Show toast
      </U.Button>
    </U.Toaster>
  )
}
export const Toggle: Story = {
  parameters: { docs: { description: { story: "A single formatting option with pressed state." } } },
  render: () => (
    <U.Toggle aria-label="Bold" variant="outline">
      B
    </U.Toggle>
  )
}
export const ToggleGroup: Story = {
  parameters: { docs: { description: { story: "Independent formatting options in a control group." } } },
  render: () => (
    <U.ToggleGroup aria-label="Text formatting" variant="outline">
      <U.ToggleGroupItem value="bold" aria-label="Bold">
        B
      </U.ToggleGroupItem>
      <U.ToggleGroupItem value="italic" aria-label="Italic">
        I
      </U.ToggleGroupItem>
      <U.ToggleGroupItem value="underline" aria-label="Underline">
        U
      </U.ToggleGroupItem>
    </U.ToggleGroup>
  )
}
export const Tooltip: Story = {
  parameters: { docs: { description: { story: "A brief hint available on hover and focus." } } },
  render: () => (
    <U.Tooltip>
      <U.TooltipTrigger render={<U.Button variant="outline" />}>Save draft</U.TooltipTrigger>
      <U.TooltipContent>Save without publishing</U.TooltipContent>
    </U.Tooltip>
  )
}
export const Trace: Story = {
  parameters: { docs: { description: { story: "A sequence of steps with expandable details." } } },
  render: () => (
    <U.Trace>
      <U.TraceLine>
        <U.TraceTitle>Read project files</U.TraceTitle>
        <U.TraceDescription>Complete</U.TraceDescription>
      </U.TraceLine>
      <U.TraceCollapsible>
        <U.TraceCollapsibleTrigger>
          <U.TraceLine>
            <U.TraceTitle>Review changes</U.TraceTitle>
          </U.TraceLine>
        </U.TraceCollapsibleTrigger>
        <U.TraceCollapsibleContent>
          <p>Checked three files. No issues found.</p>
        </U.TraceCollapsibleContent>
      </U.TraceCollapsible>
      <U.TraceLine status="running">
        <U.TraceTitle>Prepare summary</U.TraceTitle>
      </U.TraceLine>
    </U.Trace>
  )
}
