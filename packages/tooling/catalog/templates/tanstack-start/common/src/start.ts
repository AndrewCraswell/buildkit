import { createCsrfMiddleware, createStart } from "@tanstack/react-start"
import { requestMiddleware } from "./generated/buildkit/server"

// Start checks that server function calls come from this site only while this file doesn't exist, so the check comes
// first here. Add-ons' request middleware follows it.
export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({ filter: ({ handlerType }) => handlerType === "serverFn" }),
    ...requestMiddleware.pre,
    ...requestMiddleware.framework,
    ...requestMiddleware.post
  ]
}))
