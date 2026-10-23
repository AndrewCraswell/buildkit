# Framework integration

[Documentation](README.md)

## Vite and other client applications

Import `@buildkitgg/shadcn-baseui-kit/styles.css` once in the app entry before your theme CSS. Import components from
`@buildkitgg/shadcn-baseui-kit`. No dependency transpilation or registry configuration is needed. Enable your app's
React Compiler and retain its normal StrictMode and error-boundary shell.

For applications already using Tailwind, use the [source CSS setup](theming.md#an-app-that-already-uses-tailwind-4).

## Next.js App Router

Import the CSS in your root layout:

```tsx
import "@buildkitgg/shadcn-baseui-kit/styles.css"
import "./theme.css"
import type { ReactNode } from "react"

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

The package root preserves `"use client"`. A Server Component may render exported components with serializable props:

```tsx
import { Button } from "@buildkitgg/shadcn-baseui-kit"

export default function Page() {
  return <Button>Continue</Button>
}
```

Place state, event handlers, function props, and compositions using `render` inside your own `"use client"` module. Do
not call exported hooks or `toast` in a Server Component. The package is already compiled; do not add it to
`transpilePackages` merely to consume it. Configure the React Compiler for your application separately.

## Troubleshooting

| Symptom                               | Check                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Components are unstyled               | Import one of the package's CSS entries at the application root.                                 |
| Custom utility classes do nothing     | Compile those classes in your application's Tailwind build or write plain CSS.                   |
| Dialog uses the wrong theme           | Set theme variables and `.dark` on `<html>`, not only an app wrapper.                            |
| Existing page appearance changes      | Use the no-reset entry and keep the app's base styles. Global utilities still share the cascade. |
| Server/client serialization error     | Move event handlers and function-valued props into a client component.                           |
| TypeScript cannot resolve CSS imports | Use a bundler-aware module resolution mode; both CSS exports include declarations.               |

The package does not fetch registry files at runtime. Application-supplied image URLs and other remote resources remain
the application's responsibility.
