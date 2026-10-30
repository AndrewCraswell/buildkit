import { expect, it, vi } from "vite-plus/test"
import { configSchema } from "../config/schema.js"
import { resolveEndpoints } from "../domains/resolve.js"
import { runProcess } from "../runtime/process.js"
import { routeStore } from "../runtime/state.js"
import { startGateway } from "./gateway.js"
import { runTunnel } from "./tunnel.js"

vi.mock("../runtime/state.js", () => ({ routeStore: vi.fn<typeof routeStore>() }))
vi.mock("../runtime/process.js", () => ({ runProcess: vi.fn<typeof runProcess>() }))
vi.mock("./gateway.js", () => ({ startGateway: vi.fn<typeof startGateway>() }))
it("requires explicit exposure, binds the restricted target, and always closes it", async () => {
  const config = configSchema.parse({ project: "demo", endpoints: { app: { command: ["node"] } } })
  const project = { config, root: ".", worktree: null, file: undefined }
  const endpoint = resolveEndpoints(project)[0]!
  await expect(runTunnel(project, endpoint)).rejects.toThrow("No tunnel")
  endpoint.endpoint.tunnel = { command: ["tunnel"], paths: ["/hooks"] }
  await expect(runTunnel(project, endpoint)).rejects.toThrow("{url}")
  endpoint.endpoint.tunnel.command.push("{url}")
  // Use the real route-store type, overriding only the read operation.
  const { RouteStore } = await import("portless")
  const store = new RouteStore("unused")
  vi.spyOn(store, "loadRoutes").mockReturnValue([])
  vi.mocked(routeStore).mockReturnValue(store)
  await expect(runTunnel(project, endpoint)).rejects.toThrow("Start app")
  vi.mocked(store.loadRoutes).mockReturnValue([{ hostname: endpoint.hostname, pid: process.pid, port: 4444 }])
  const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  vi.mocked(startGateway).mockResolvedValue({ url: "http://127.0.0.1:12345", close })
  vi.mocked(runProcess).mockRejectedValue(new Error("provider missing"))
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  await expect(runTunnel(project, endpoint)).rejects.toThrow("provider missing")
  expect(close).toHaveBeenCalledOnce()
  expect(startGateway).toHaveBeenCalledWith(expect.objectContaining({ paths: ["/hooks"], hostname: endpoint.hostname }))
  expect(vi.mocked(startGateway).mock.calls[0]![0].target()).toBe(4444)
  vi.restoreAllMocks()
})
