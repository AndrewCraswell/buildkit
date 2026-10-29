import type { ComponentType, ReactNode } from "react"
import { appProviders } from "../generated/buildkit/client"

interface ProviderProps {
  children: ReactNode
}

const providers: ComponentType<ProviderProps>[] = [...appProviders.pre, ...appProviders.framework, ...appProviders.post]

export interface ProvidersProps {
  children: ReactNode
}

/** Wraps every page in the providers add-ons contribute, outermost first. */
export function Providers({ children }: ProvidersProps) {
  return providers.reduceRight<ReactNode>((inner, Provider) => <Provider>{inner}</Provider>, children)
}
