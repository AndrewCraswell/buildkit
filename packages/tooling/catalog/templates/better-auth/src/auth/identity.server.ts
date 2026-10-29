import { betterAuthIdentity } from "@better-apps/better-auth"
import { auth } from "./auth.server"

/**
 * Who a request acts for, through Better Apps' identity interface. Your server code and Better Apps features read the
 * signed-in user from here, so changing the sign-in provider changes this file, not the code that reads it.
 */
export const identity = betterAuthIdentity(auth)
