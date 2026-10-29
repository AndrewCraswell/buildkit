import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import * as authSchema from "../db/auth-schema"
import { db } from "../db/db.server"

/**
 * Email and password sign-in, with users and sessions in the app's database. Better Auth reads BETTER_AUTH_SECRET and
 * BETTER_AUTH_URL from the environment. Keep tanstackStartCookies last, so calls from server functions set cookies.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
  emailAndPassword: { enabled: true },
  plugins: [tanstackStartCookies()]
})
