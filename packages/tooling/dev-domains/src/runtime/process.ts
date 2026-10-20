import { execFile } from "node:child_process"
import { promisify } from "node:util"
import spawn from "cross-spawn"

const exec = promisify(execFile)

/** Own only the process tree we started. Never stop a shared proxy. */
export async function runProcess(
  command: string[],
  options: {
    cwd: string
    env?: NodeJS.ProcessEnv
    signal?: AbortSignal
    onSpawn?: (pid: number) => void
    quiet?: boolean
  }
) {
  const [executable, ...args] = command
  if (!executable) {
    throw new Error("A command is required")
  }
  options.signal?.throwIfAborted()
  return new Promise<{ code: number; stderr: string; pid?: number }>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["inherit", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true
    })
    let stderr = ""
    let timer: NodeJS.Timeout | undefined
    let isDone = false
    const kill = async (force: boolean) => {
      if (!child.pid || isDone) {
        return
      }
      try {
        if (process.platform === "win32") {
          await exec("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 5000 })
        } else {
          process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM")
        }
      } catch (error) {
        if (
          !isDone &&
          child.exitCode === null &&
          !(error instanceof Error && "code" in error && error.code === "ESRCH")
        ) {
          child.kill("SIGKILL")
        }
      }
    }
    const abort = () => {
      void kill(false)
      timer ??= setTimeout(() => {
        void kill(true)
      }, 5000)
      timer.unref()
    }
    const finish = () => {
      isDone = true
      if (timer) {
        clearTimeout(timer)
      }
      options.signal?.removeEventListener("abort", abort)
    }
    child.stdout?.on("data", (chunk: Buffer) => {
      if (!options.quiet) {
        process.stdout.write(chunk)
      }
    })
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-8192)
      if (!options.quiet) {
        process.stderr.write(chunk)
      }
    })
    child.once("spawn", () => {
      if (child.pid) {
        options.onSpawn?.(child.pid)
      }
    })
    child.once("error", (error) => {
      finish()
      reject(new Error(`Cannot start ${executable}: ${error.message}`, { cause: error }))
    })
    child.once("close", (code, signal) => {
      finish()
      resolve({ code: code ?? (signal === "SIGINT" ? 130 : 143), stderr, pid: child.pid })
    })
    options.signal?.addEventListener("abort", abort, { once: true })
    if (options.signal?.aborted) {
      abort()
    }
  })
}

export async function withSignals<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  process.on("SIGINT", abort)
  process.on("SIGTERM", abort)
  process.on("SIGHUP", abort)
  try {
    return await operation(controller.signal)
  } finally {
    process.off("SIGINT", abort)
    process.off("SIGTERM", abort)
    process.off("SIGHUP", abort)
  }
}
