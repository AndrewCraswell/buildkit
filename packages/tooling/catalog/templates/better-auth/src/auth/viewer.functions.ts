import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { identity } from "./identity.server"

/** Who a page is for. */
export interface Viewer {
  id: string
  name: string | null
}

/** Reads who the request is for, or `null` when nobody is signed in. Loaders call it on the server and in the browser. */
export const getViewer = createServerFn({ method: "GET" }).handler(async (): Promise<Viewer | null> => {
  const actor = await identity.getActor(getRequest())
  if (!actor) {
    return null
  }
  const [user] = (await identity.getUsers?.([actor.userId])) ?? []
  return { id: actor.userId, name: user?.name ?? null }
})
