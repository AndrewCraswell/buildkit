import type { ModalDefaultFooterProps } from "@buildkitgg/react-modals"
import type { ModalContentComponents } from "./types.js"

export function createDefaultFooter(Button: ModalContentComponents["Button"]) {
  return function DefaultFooter({ kind, labels, isPending, dismiss, confirm }: ModalDefaultFooterProps) {
    return (
      <>
        <Button type="button" variant="outline" onClick={dismiss} disabled={isPending}>
          {kind === "confirm" ? labels.cancel : labels.close}
        </Button>
        {kind === "confirm" && (
          <Button type="button" onClick={confirm} disabled={isPending}>
            {labels.confirm}
          </Button>
        )}
      </>
    )
  }
}
