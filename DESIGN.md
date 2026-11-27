---
name: Buhj
description: Compact, neutral workspaces for reviewing personal finances.
colors:
  primary: "#242428"
  primary-foreground: "#fafafa"
  background: "#fcfcfd"
  foreground: "#202124"
  card: "#ffffff"
  sidebar: "#f3f3f5"
  sidebar-accent: "#e7e7eb"
  muted-foreground: "#5d5d65"
  border: "#dddde2"
  input: "#bdbdc6"
  ring: "#6247a8"
  selected: "#eee9fb"
  selected-foreground: "#46337e"
  selected-border: "#cbbce9"
  accent-emphasis: "#574093"
  financial-positive: "#246548"
  financial-negative: "#a32d3d"
  chart-1: "#6247a8"
  chart-2: "#286d73"
  chart-3: "#995215"
  chart-4: "#526894"
  chart-5: "#775476"
  dark-primary: "#ededee"
  dark-primary-foreground: "#202124"
  dark-background: "#1b1c1d"
  dark-foreground: "#ededee"
  dark-card: "#202122"
  dark-sidebar: "#161717"
  dark-sidebar-accent: "#252628"
  dark-muted-foreground: "#aaaab1"
  dark-border: "#37383b"
  dark-input: "#54555b"
  dark-ring: "#c0aafa"
  dark-selected: "#302840"
  dark-selected-foreground: "#efe9ff"
  dark-selected-border: "#5d4e76"
  dark-accent-emphasis: "#bda8f5"
  dark-financial-positive: "#8ed5ac"
  dark-financial-negative: "#ffa1a9"
  dark-chart-1: "#bda8f5"
  dark-chart-2: "#7bc8cb"
  dark-chart-3: "#efad72"
  dark-chart-4: "#a3b8e3"
  dark-chart-5: "#d0a5ca"
typography:
  page-title:
    fontFamily: "Geist, sans-serif"
    fontSize: "clamp(1.65rem, 3vw, 2.25rem)"
    fontWeight: 680
    lineHeight: 1.12
    letterSpacing: "-0.037em"
  brand:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 720
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.875rem"
    lineHeight: "1.25rem"
  nav-label:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  location-label:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
rounded:
  md: "0.4rem"
  lg: "0.5rem"
  xl: "0.7rem"
spacing:
  card-compact: "0.75rem"
  card: "1rem"
  rail-inset: "0.8125rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  input:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  workspace-navigation:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.foreground}"
    typography: "{typography.nav-label}"
    padding: "{spacing.rail-inset}"
    width: "12.875rem"
  workspace-topbar:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.location-label}"
    height: "3.375rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
  table:
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
---

# Buhj design system

## Overview

**Creative North Star: "Readable financial records"**

Buhj uses compact layouts, neutral surfaces, and quiet dividers so people can read a month of activity and trace totals to individual records. Keep the date and account scope near the figures they qualify. Give the page title, the next action, and the figures enough weight to establish the reading order.

**Key Characteristics:**

- Matte light and dark surfaces with one lavender accent.
- Compact navigation with a visible label for each destination.
- Tabular amounts and labeled states that read in grayscale.

## Colors

The light theme uses a near-white canvas and white panels. The dark theme uses charcoal for the canvas and a slightly lighter charcoal for panels. Both use a separate neutral for the navigation rail.

Use the semantic CSS variables in [app/globals.css](app/globals.css). Each `dark-` key above records the value of the same CSS role under `.dark`. `--foreground` carries text and figures. `--muted-foreground` carries context such as dates, hints, and secondary labels. Use `--border` for dividers and `--input` for field boundaries. Primary buttons are neutral in both themes.

Lavender marks selected controls, the active navigation icon, keyboard focus, and net cash flow. Use the `--selected` roles for tinted selection, `--accent-emphasis` for the active icon, and `--ring` for focus. Use `--financial-net` for the net figure. It shares the color of `--accent-emphasis`. Keep routine amounts neutral. Reserve `--financial-positive` and `--financial-negative` for signed financial states that need extra emphasis. Put a visible sign or label on every state that depends on direction. Use weight, a border, or a check mark alongside color for selection.

Use `--chart-1` through `--chart-5` for data series and `--chart-track` for the unfilled track. Label series and values, and give multi-series charts a second cue such as a line pattern or marker shape. The chart should read in grayscale.

System is the default and follows the device's color scheme. The **Appearance** menu offers the named radio choices **System**, **Light**, and **Dark**, with a visible selection indicator. It lives with the workspace utilities on desktop and inside the navigation sheet on mobile.

## Typography

Geist is the interface typeface. Workspace page titles scale with the viewport (`1.65rem` to `2.25rem`). Use the page title for the current task or report, and smaller section headings to group related data and actions. Keep table text and menu labels at the compact body size (`0.875rem`).

Right-align comparable monetary amounts and use tabular figures so digits line up. Keep the amount together with its currency symbol, decimal places, and sign where applicable. Descriptions and account names can wrap onto additional lines.

## Layout

At `64rem` and wider, a sticky navigation rail sits beside the workspace. The sticky top bar shows the current destination. Below `64rem`, the top bar adds the Buhj wordmark and a menu button named **Open navigation**. The left navigation sheet uses the same destinations and utilities in the same order. Its link rows have a minimum height of `2.75rem`.

Use the shared workspace padding and a page width up to `82rem` for wide content. Use the `50rem` measure for narrower flows. Keep a page's scope near its heading as filters wrap. Allow long text to wrap and let wide tables scroll inside their own region while the page remains within the viewport.

The approved spending preview puts the category list beside its filtered transactions on desktop and stacks them on mobile. The month, account, and cash-flow summary sit above both. This is the reference for MAD-162, which owns the spending page redesign.

## Elevation & Depth

Resting surfaces use tonal changes and thin dividers to show structure. Cards have a fine outline. Menus and sheets sit above the page with a shadow, and sheets add a dimmed backdrop.

## Shapes

Use restrained corner radii for controls and containers. Standard fields and buttons use `rounded.lg`. Cards use the larger `rounded.xl`. Rail links use `rounded.md`. The navigation sheet meets the viewport edge.

## Components

### Controls and fields

Use the shared shadcn/ui Base Nova components backed by Base UI. The default button identifies the main action. Outline buttons suit secondary actions and filters. Ghost buttons suit workspace utilities. Pair inputs with a readable label and use the field boundary and focus ring from the theme.

Use Lucide for functional interface icons. Pair icons with visible text where space allows and give icon-only controls accessible names. For third-party logos, add the appropriate `@svgl` item through the shadcn CLI, for example `npx shadcn@latest add @svgl/github`.

### Navigation and focus

Keep utilities at the bottom of the rail and sheet. Mark the active destination with `aria-current`, a background, a border, and stronger text. The sheet closes when a destination opens and supports keyboard dismissal. At desktop width it closes and returns focus to the active rail link. Keep keyboard focus visible on the navigation and the main workspace. The shared workspace outline uses `--ring` with a `2px` width and `2px` offset. Keep **Skip to content** available before the navigation.

### Tables and states

Use readable column headers and light dividers to support scanning. Keep amounts at the right edge, add a visible label to selection and transaction states, and let long descriptions grow vertically. If table columns need extra width, provide a scroll region with an accessible name and keyboard access.

Show empty states inline at the scope that has no results. When a filter yields no transactions, show the active scope and offer a way to broaden it. When a user has no data to start with, offer the next available setup action.

Keep the shell in place during workspace navigation and loading. After authorization and any required existence checks, show a skeleton in the section that is loading. Let inaccessible or missing resources follow the route's existing 404 behavior.

Place errors near the action or section that failed. Name what failed and give the next recovery step. Offer a retry when repeating the operation can help, and preserve entered values when possible.

### Generated reports

Spending Insights establishes these presentation patterns for Savings Projections (MAD-168).

- Put the inputs and generate action first. Keep pending feedback, actionable errors, and any provider disclosure with the form. Preserve the inputs so the user can retry.
- Put saved results in a separate list. Each row opens the report and shows its source scope and save time. Drafts stay out of this list.
- Give a draft and its saved result the same detail layout. Lead with the source scope, show **Draft** or **Saved** in text, and put the save action in the draft header. Show the save time on the saved result.
- Keep generated explanations next to the saved evidence that supports them. Reopening the report shows the original inputs, evidence, and explanation. On narrow screens, put the evidence immediately above its explanation.

## Do's and Don'ts

- **Do** check light and dark rendering, keyboard focus, and narrow layouts when adding a shared component or page.
- **Do** check that users can identify selections, inflows, and outflows in grayscale.
- **Don't** assign new page-specific colors to a role already covered by the shared theme.
