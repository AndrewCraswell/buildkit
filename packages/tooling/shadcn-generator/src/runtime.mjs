import { Node, SyntaxKind } from "ts-morph"

const labels = new Map(
  Object.entries({
    Close: "close",
    "Toggle Sidebar": "toggleSidebar",
    Sidebar: "sidebar",
    "Displays the mobile sidebar.": "sidebarDescription",
    Loading: "loading",
    "Command Palette": "commandPalette",
    "Search for a command to run...": "commandDescription",
    breadcrumb: "breadcrumb",
    pagination: "pagination",
    "Go to previous page": "previousPage",
    "Go to next page": "nextPage",
    Previous: "previous",
    Next: "next",
    "More pages": "morePages",
    More: "more",
    "Previous slide": "previousSlide",
    "Next slide": "nextSlide",
    carousel: "carousel",
    slide: "slide",
    "Close toast": "closeToast",
    Copy: "copy",
    Copied: "copied"
  })
)
const labelAttributes = new Set(["aria-label", "aria-description", "aria-roledescription", "title", "placeholder"])
const labelParameters = new Set(["title", "description", "text", "label"])

/** Adapt semantic AST nodes, never arbitrary occurrences in source text or class names. */
export function transformRuntime(file) {
  const functions = new Set()
  function owner(node) {
    const fn = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration)
    if (!fn || !/^[A-Z]/.test(fn.getName() ?? "")) {
      throw new Error(`Unsupported localization scope in ${file.getBaseName()}: ${node.getText()}`)
    }
    functions.add(fn)
    return fn
  }
  function lookup(text) {
    const key = labels.get(text)
    if (!key) {
      throw new Error(`Unmapped upstream label in ${file.getBaseName()}: ${text}`)
    }
    return `strings.${key}`
  }
  for (const declaration of [...file.getImportDeclarations(), ...file.getExportDeclarations()]) {
    if (declaration.getModuleSpecifierValue() === "cn") {
      declaration.setModuleSpecifier("@buildkitgg/shadcn-runtime")
    }
  }
  if (file.getBaseName() === "carousel.tsx") {
    file.addImportDeclaration({ moduleSpecifier: "@base-ui/react/direction-provider", namedImports: ["useDirection"] })
    const fn = file.getFunctionOrThrow("Carousel")
    fn.getBodyOrThrow().insertStatements(
      0,
      "const inheritedDirection = useDirection()\nconst direction = opts?.direction ?? inheritedDirection"
    )
    const options = fn
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === "useEmblaCarousel")
      ?.getArguments()[0]
    if (!options || !Node.isObjectLiteralExpression(options)) {
      throw new Error("Review upstream carousel options")
    }
    options.insertPropertyAssignment(0, { name: "direction", initializer: "direction" })
    for (const literal of fn.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      if (literal.getLiteralValue() === "ArrowLeft") {
        literal.replaceWithText('(direction === "rtl" ? "ArrowRight" : "ArrowLeft")')
      } else if (literal.getLiteralValue() === "ArrowRight") {
        literal.replaceWithText('(direction === "rtl" ? "ArrowLeft" : "ArrowRight")')
      }
    }
    const handler = fn
      .getVariableDeclarationOrThrow("handleKeyDown")
      .getInitializerIfKindOrThrow(SyntaxKind.CallExpression)
    handler.getArguments()[1].addElement("direction")
  }
  for (const node of file.getDescendantsOfKind(SyntaxKind.JsxText)) {
    const text = node.getText().trim()
    if (!text) {
      continue
    }
    owner(node)
    const element = node.getParentIfKindOrThrow(SyntaxKind.JsxElement)
    if (element.getJsxChildren().filter((child) => child.getText().trim()).length !== 1) {
      throw new Error(`Review mixed-content label in ${file.getBaseName()}: ${text}`)
    }
    element.setBodyText(`{${lookup(text)}}`)
  }
  for (const attribute of file.getDescendantsOfKind(SyntaxKind.JsxAttribute)) {
    if (!labelAttributes.has(attribute.getNameNode().getText())) {
      continue
    }
    const initializer = attribute.getInitializer()
    if (!initializer) {
      continue
    }
    if (Node.isStringLiteral(initializer)) {
      owner(attribute)
      attribute.setInitializer(`{${lookup(initializer.getLiteralValue())}}`)
    } else {
      for (const literal of initializer.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
        owner(literal)
        literal.replaceWithText(lookup(literal.getLiteralValue()))
      }
    }
  }
  // Parameter defaults cannot call hooks. Resolve them in the component body after reading context.
  for (const binding of file.getDescendantsOfKind(SyntaxKind.BindingElement)) {
    const initializer = binding.getInitializer()
    if (!initializer || !Node.isStringLiteral(initializer) || !labelParameters.has(binding.getName())) {
      continue
    }
    const expression = lookup(initializer.getLiteralValue())
    const fn = owner(binding)
    const name = binding.getName()
    binding.replaceWithText(`${name}: ${name}Prop`)
    fn.getBodyOrThrow().insertStatements(0, `const ${name} = ${name}Prop === undefined ? ${expression} : ${name}Prop`)
  }
  if (file.getBaseName() === "combobox.tsx") {
    for (const [name, tag, expression] of [
      ["ComboboxTrigger", "ComboboxPrimitive.Trigger", "children == null ? strings.showOptions : undefined"],
      ["ComboboxClear", "ComboboxPrimitive.Clear", "strings.clear"],
      [
        "ComboboxChip",
        "ComboboxPrimitive.ChipRemove",
        'removeLabel ?? (typeof children === "string" ? strings.removeItem(children) : strings.remove)'
      ]
    ]) {
      const fn = file.getFunctionOrThrow(name)
      const element = fn
        .getDescendants()
        .find(
          (node) =>
            (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) &&
            node.getTagNameNode().getText() === tag
        )
      if (!element || element.getAttribute("aria-label")) {
        throw new Error(`Review upstream accessible name: ${name}`)
      }
      functions.add(fn)
      element.insertAttribute(0, { name: "aria-label", initializer: `{${expression}}` })
      if (name === "ComboboxChip") {
        const parameter = fn.getParameters()[0]
        parameter.getNameNode().replaceWithText(parameter.getName().replace("{", "{ removeLabel,"))
        parameter.setType(`${parameter.getTypeNodeOrThrow().getText()} & { removeLabel?: string }`)
      }
    }
  }
  if (functions.size) {
    const existing = file.getImportDeclaration("@buildkitgg/shadcn-runtime")
    if (existing) {
      existing.addNamedImport("useShadcnLocalization")
    } else {
      file.addImportDeclaration({
        moduleSpecifier: "@buildkitgg/shadcn-runtime",
        namedImports: ["useShadcnLocalization"]
      })
    }
    for (const fn of functions) {
      fn.getBodyOrThrow().insertStatements(0, "const { strings } = useShadcnLocalization()")
    }
    if (
      !file
        .getStatements()
        .some((statement) => statement.getText() === '"use client"' || statement.getText() === '"use client";')
    ) {
      file.insertStatements(0, '"use client"')
    }
  }
}
