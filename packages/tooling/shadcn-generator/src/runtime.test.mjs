import assert from "node:assert/strict"
import { test } from "node:test"
import { transformDirection, transformStyle, createStyleMap } from "shadcn/utils"
import { Project } from "ts-morph"
import { transformRuntime } from "./runtime.mjs"
import { snapshot } from "./shared.mjs"

function adapt(name, source) {
  const file = new Project({ useInMemoryFileSystem: true }).createSourceFile(name, source)
  transformRuntime(file)
  return file.getText()
}

test("every upstream style receives localization and RTL without direct cn imports", async () => {
  const data = snapshot()
  for (const [style, css] of Object.entries(data.styles)) {
    const styleMap = createStyleMap(css)
    for (const [name, source] of Object.entries(data.sources)) {
      const result = adapt(name, await transformDirection(await transformStyle(source, { styleMap }), true))
      assert.doesNotMatch(result, /from ["']cn["']/)
      if (name === "ui/dialog.tsx") {
        assert.match(result, /start-1\/2/)
        assert.match(result, /rtl:translate-x-1\/2/)
        assert.match(result, /strings.close/)
      }
      if (name === "ui/sheet.tsx" || name === "ui/sidebar.tsx") {
        // shadcn's side is a physical edge. The kit ships the converter's output with no direction rewrites of its own.
        assert.match(result, /data-\[side=left\]:left-0/)
        assert.match(result, /data-\[side=right\]:right-0/)
      }
      if (name === "ui/combobox.tsx") {
        assert.match(result, /strings.showOptions/)
        assert.match(result, /strings.clear/)
        assert.match(result, /strings.removeItem\(children\)/)
      }
      assert.ok(result.length, `${style}/${name}`)
    }
  }
})

test("unknown upstream labels stop updates rather than silently shipping English", () => {
  assert.throws(
    () => adapt("new.tsx", 'function New({title = "New title"}) { return <h1>{title}</h1> }'),
    /Unmapped upstream label/
  )
  assert.throws(
    () => adapt("new.tsx", 'function New() { return <button aria-label="New action" /> }'),
    /Unmapped upstream label/
  )
  assert.throws(
    () => adapt("new.tsx", "function New() { return <button>New action</button> }"),
    /Unmapped upstream label/
  )
})

test("parameter defaults resolve after the hook without overriding caller values", () => {
  const result = adapt(
    "command.tsx",
    'function Command({title = "Command Palette"}: {title?: string}) { return <h1>{title}</h1> }'
  )
  assert.match(result, /title: titleProp/)
  assert.ok(result.indexOf("const { strings }") < result.indexOf("const title ="))
  assert.match(result, /titleProp === undefined/)
})
