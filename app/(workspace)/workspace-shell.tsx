"use client"

import {
  AudioLinesIcon,
  ChartColumnIncreasingIcon,
  ChartNoAxesCombinedIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  MenuIcon,
  MonitorIcon,
  ReceiptTextIcon,
  TargetIcon,
  WalletCardsIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { SignOutButton } from "./sign-out-button"

const desktopWorkspaceQuery = "(min-width: 64rem)"

const destinations = [
  { href: "/", label: "Overview", icon: LayoutGridIcon },
  { href: "/spending", label: "Spending", icon: ChartColumnIncreasingIcon },
  {
    href: "/financial-accounts",
    label: "Financial accounts",
    icon: WalletCardsIcon,
  },
  { href: "/income", label: "Income", icon: ReceiptTextIcon },
  { href: "/insights", label: "Insights", icon: ChartNoAxesCombinedIcon },
  { href: "/projections", label: "Projections", icon: TargetIcon },
]

function subscribeToWorkspaceSize(onChange: () => void) {
  const desktop = window.matchMedia(desktopWorkspaceQuery)
  desktop.addEventListener("change", onChange)
  return () => desktop.removeEventListener("change", onChange)
}

function isDesktopWorkspace() {
  return window.matchMedia(desktopWorkspaceQuery).matches
}

function useCloseOnWorkspaceResize(setOpen: (open: boolean) => void) {
  useEffect(() => {
    return subscribeToWorkspaceSize(() => setOpen(false))
  }, [setOpen])
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" onNavigate={onNavigate} className="workspace-brand">
      <AudioLinesIcon aria-hidden="true" size={19} />
      Buhj
    </Link>
  )
}

function AppearanceMenu() {
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="workspace-nav-control" />}
      >
        <MonitorIcon data-icon="inline-start" />
        Appearance
        <ChevronDownIcon data-icon="inline-end" className="ml-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" sideOffset={6}>
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          <DropdownMenuRadioItem value="system" closeOnClick>
            System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light" closeOnClick>
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" closeOnClick>
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function WorkspaceNavigation({
  activeHref,
  showAppearance,
  pathname,
  onNavigate,
}: {
  activeHref: string | undefined
  showAppearance: boolean
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <>
      <nav aria-label="Main navigation" className="workspace-nav">
        {destinations.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onNavigate={onNavigate}
            aria-current={
              href === activeHref
                ? href === pathname
                  ? "page"
                  : "location"
                : undefined
            }
            className="workspace-nav-link"
          >
            <Icon aria-hidden="true" size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="workspace-utilities">
        {showAppearance && <AppearanceMenu />}
        <SignOutButton />
      </div>
    </>
  )
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const desktop = useSyncExternalStore(
    subscribeToWorkspaceSize,
    isDesktopWorkspace,
    () => false
  )
  const active = destinations.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`)
  )
  const [navigationOpen, setNavigationOpen] = useState(false)
  const desktopRail = useRef<HTMLElement>(null)

  useCloseOnWorkspaceResize(setNavigationOpen)

  function restoreNavigationFocus() {
    if (!isDesktopWorkspace()) return true
    return (
      desktopRail.current?.querySelector<HTMLAnchorElement>("[aria-current]") ??
      desktopRail.current?.querySelector<HTMLAnchorElement>("a")
    )
  }

  const closeNavigation = () => setNavigationOpen(false)
  const navigationProps = { activeHref: active?.href, pathname }

  return (
    <div className="workspace-shell">
      <a className="workspace-skip-link" href="#workspace-content">
        Skip to content
      </a>

      <aside className="workspace-rail" ref={desktopRail}>
        <div className="workspace-rail-brand">
          <Brand />
        </div>
        <WorkspaceNavigation {...navigationProps} showAppearance={desktop} />
      </aside>

      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="workspace-compact-controls">
            <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
              <SheetTrigger
                aria-label="Open navigation"
                render={<Button variant="ghost" size="icon-lg" />}
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="workspace-sheet"
                finalFocus={restoreNavigationFocus}
              >
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="workspace-rail-brand">
                  <Brand onNavigate={closeNavigation} />
                </div>
                <WorkspaceNavigation
                  {...navigationProps}
                  showAppearance={!desktop}
                  onNavigate={closeNavigation}
                />
              </SheetContent>
            </Sheet>
            <Brand />
          </div>
          <span className="workspace-location">{active?.label}</span>
        </header>

        <div id="workspace-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  )
}
