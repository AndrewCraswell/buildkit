# Change Log - @buildkitgg/shadcn-baseui-vega

<!-- This log was last generated on Fri, 23 Oct 2026 09:15:08 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.4.0

Fri, 23 Oct 2026 09:15:08 GMT

### Minor changes

- In RTL, a Sheet's `side` is the physical edge again, as in shadcn: `side="left"` opens on the left. To open from the
  start edge, pass `side={direction === "rtl" ? "right" : "left"}`. A Sidebar's mobile Sheet now opens from the same
  edge as the desktop Sidebar. (ajcraswell@gmail.com)

## 0.3.0

Fri, 23 Oct 2026 04:27:43 GMT

### Minor changes

- Add shared localization, RTL support, configurable class merging, and separate compiled and Tailwind source CSS
  entries. (acraswell@users.noreply.github.com)
- Bump @buildkitgg/shadcn-runtime to v0.1.0

## 0.2.1

Thu, 22 Oct 2026 21:22:51 GMT

### Patches

- Document token metadata and migration in the published package README; validate GitHub trusted publishing.
  (41898282+github-actions[bot]@users.noreply.github.com)

## 0.2.0

Thu, 22 Oct 2026 20:48:39 GMT

### Minor changes

- Generate upstream Base UI style packages with a shared public API, dependency alias support, and derived token
  metadata. (41898282+github-actions[bot]@users.noreply.github.com)
