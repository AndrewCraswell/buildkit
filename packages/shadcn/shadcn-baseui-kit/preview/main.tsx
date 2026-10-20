import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "react-error-boundary"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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
  TabsContent,
  Input,
  Label
} from "../dist/index.js"
import "../dist/styles.css"
function App() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 20 }}>
      <Card>
        <CardHeader>
          <CardTitle>shadcn-baseui-kit</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="account">
            <TabsList>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>
            <TabsContent value="account">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" />
            </TabsContent>
            <TabsContent value="billing">Your plan is up to date.</TabsContent>
          </Tabs>
          <Dialog>
            <DialogTrigger render={<Button />}>Edit profile</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit profile</DialogTitle>
                <DialogDescription>Components imported from one package.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button />}>Save</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </main>
  )
}
const root = document.getElementById("root")
if (!root) {
  throw new Error("Missing application root")
}
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary fallback={<p>Unable to load preview.</p>}>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
