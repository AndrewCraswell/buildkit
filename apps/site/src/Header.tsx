import { ArrowUpRight, Menu, X } from "lucide-react"
import { useState } from "react"
import { Button } from "./components/ui/Button"
import { GithubIcon } from "./GithubIcon"
import { LinkButton } from "./LinkButton"
import { links } from "./links"

export function Header() {
  const [isMenuOpen, setMenuOpen] = useState(false)
  function handleNavigation() {
    setMenuOpen(false)
  }
  return (
    <header className="site-header dark" id="top">
      <div className="container header-inner">
        <a className="brand" href="#top" aria-label="Buildkit home">
          <img src={`${import.meta.env.BASE_URL}mark.svg`} alt="" width="32" height="32" />
          buildkit<span>.gg</span>
        </a>
        <nav className={`main-nav ${isMenuOpen ? "is-open" : ""}`} id="main-navigation" aria-label="Main navigation">
          <a href="#examples" onClick={handleNavigation}>
            Examples
          </a>
          <a href="#architecture" onClick={handleNavigation}>
            Architecture
          </a>
          <a href="#packages" onClick={handleNavigation}>
            Packages
          </a>
          <a href={links.docs}>
            Documentation <ArrowUpRight aria-hidden="true" />
          </a>
        </nav>
        <LinkButton variant="outline" href={links.github} className="github-button">
          <GithubIcon /> GitHub <ArrowUpRight aria-hidden="true" />
        </LinkButton>
        <Button
          variant="ghost"
          size="icon"
          className="menu-button"
          aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
          aria-controls="main-navigation"
          aria-expanded={isMenuOpen}
          onClick={() => setMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X /> : <Menu />}
        </Button>
      </div>
    </header>
  )
}
