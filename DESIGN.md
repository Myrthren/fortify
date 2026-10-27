---
name: Fortify
description: Graphite and silver business workspace with precise controls and restrained dimensional signals.
colors:
  graphite: "#050505"
  graphite-subtle: "#0c0c0c"
  panel: "#111111"
  elevated: "#161616"
  border: "#1f1f1f"
  border-strong: "#2a2a2a"
  text: "#fafafa"
  text-muted: "#b0b0b9"
  text-dim: "#898994"
  silver: "#ffffff"
  silver-deep: "#e5e5e5"
typography:
  display:
    fontFamily: "Archivo, Inter Tight, system-ui, sans-serif"
    fontWeight: 850
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Inter Tight, Archivo, system-ui, sans-serif"
    fontSize: "15px"
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "10px"
    letterSpacing: "0.13em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  original-control: "10px"
  original-card: "16px"
components:
  button-primary-original:
    backgroundColor: "linear-gradient(160deg, #ffffff 0%, #e8e8e8 60%, #d8d8d8 100%)"
    textColor: "{colors.graphite}"
    rounded: "{rounded.original-control}"
    padding: "11px 19px"
    height: "44px"
  button-primary-scifi:
    backgroundColor: "linear-gradient(160deg, #ffffff, #e8e8e8)"
    textColor: "{colors.graphite}"
    rounded: "{rounded.sm}"
    height: "42px"
  input-original:
    backgroundColor: "#0d0d0d"
    textColor: "{colors.text}"
    rounded: "{rounded.original-control}"
  input-scifi:
    backgroundColor: "#0f0f0f"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
---

# Design System: Fortify

## Overview

**Creative North Star: "The Business Signal"**

Fortify presents business work as something observable and actionable. A near-black graphite field, silver type and carefully lit surfaces give the interface the feel of an instrument panel. Archivo carries the brand voice and decisions; Inter Tight keeps explanations and dense controls readable. The original theme is more softly layered and product first. The sci-fi theme is more diagrammatic and compact. Both share the same visual vocabulary.

The homepage uses two restrained dimensional illustrations: a connected signal at the hero and context-to-plan-to-action slabs at the final call to action. Each has a useful still frame. Ruled rows carry the tool and feature story, while framed previews identify actual product examples.

**Key Characteristics:**

- Graphite and silver with muted cool text, subtle borders and occasional white light.
- Dotted signals, fine rules and precise control states.
- Archivo emphasis with Inter Tight support.
- Dimensional illustration only where it explains the product story.

## Colors

The palette is monochromatic at its base: bright silver draws attention against graphite, while cool muted text and hairline borders organize the rest.

### Primary

- **Signal Silver** (`silver`): principal action fill, focus contrast, highlights and signal points.
- **Soft Silver** (`silver-deep`): the lower end of primary control gradients and quieter bright surfaces.

### Neutral

- **Deep Graphite** (`graphite`) and **Graphite Recess** (`graphite-subtle`): page and recessed canvas.
- **Panel Graphite** (`panel`) and **Raised Graphite** (`elevated`): workspace layers and control backgrounds.
- **Fine Rule** (`border`) and **Strong Rule** (`border-strong`): separators, control edges and panel structure.
- **Bright Text** (`text`), **Cool Muted Text** (`text-muted`) and **Cool Dim Text** (`text-dim`): reading hierarchy. The theme styles locally adjust muted values; the final shared font layer supplies the current cool defaults.

**The Silver Signal Rule.** Use the brightest values for actions, selected states, focus and meaningful signal points; let graphite carry the larger surfaces.

## Typography

**Display Font:** Archivo, self-hosted variable upright and italic files, with Inter Tight and system sans fallbacks. Archivo is the approved open-license substitute for the Naked Power reference.

**Body Font:** Inter Tight for supporting copy and dense product controls, with Archivo and system sans fallbacks. Body defaults to Archivo where the shared theme layer has no denser role selector.

**Label/Mono Font:** System monospace for sci-fi coordinates, rails, small status labels and instrument-like metadata.

### Hierarchy

- **Display:** Hero titles use heavy Archivo (`850`), close tracking (`-0.035em`) and a compact line height (`1.04`). The original theme sizes the hero with `clamp(42px, 4.6vw, 64px)`; sci-fi uses `clamp(40px, 5.2vw, 68px)`. The shared layer controls their final weight and rhythm.
- **Headline:** Section and dashboard headings use Archivo with tight tracking; the final call to action uses weight (`800`), tracking (`-0.03em`) and line height (`1.08`).
- **Title:** Navigation brands and key dashboard titles use weight (`750`) and tracking (`-0.025em`).
- **Body:** Hero supporting copy is (`15px`) with generous line height (`1.85`) and a short measure (about `400–410px`). The final call to action uses Inter Tight (`16px`, line height `1.7`).
- **Label:** Instrument labels use monospace (`10px`) with expanded tracking (`0.13em`); compact overlines and status text stay subordinate to body copy.

**The Two-Voice Rule.** Use Archivo for brand emphasis and primary decisions, Inter Tight when the interface needs sustained reading or dense controls.

## Layout

The public hero has a centered maximum width (`1152px`) and two columns on desktop, then one column at the mobile breakpoint (`767px`). The sci-fi hero gives slightly more width to the copy; the original theme pairs copy with a framed product illustration. The homepage replacement strip starts as five columns, becomes three at (`900px`) and two at (`767px`). The feature area changes from an asymmetric two-column ruled layout to one column at (`767px`). The final call to action also stacks at (`900px`).

Use open, ruled rows for the replacement and feature story. Reserve enclosed frames for interface previews and workspace surfaces. Interior spacing follows the implemented control and section patterns rather than a separate invented global spacing scale.

## Elevation & Depth

Fortify mixes tonal layers with restrained highlights and dark shadows. Sci-fi cards stay comparatively flat at rest, gaining a small lift on interaction. The original theme gives product previews and cards a softer, deeper frame. The two 3D marketing scenes are explanatory accents, not a general background treatment.

### Shadow Vocabulary

- **Tactile primary:** an inset top glint and a short dark drop shadow; hover increases lift and surface light.
- **Sci-fi card:** a nearly imperceptible inset top line (`inset 0 1px 0 #ffffff03`), with hover depth (`0 8px 26px #0003`).
- **Original card:** a soft inset highlight and broad dark shadow (`inset 0 1px 0 #ffffff06, 0 12px 35px #0002`).
- **Product preview:** a deeper shadow on the original theme's framed workspace illustration (`0 30px 70px #0008`).

**The Purposeful Depth Rule.** Raise a surface to identify a control, a product example or an interactive state; keep ordinary explanatory rows open and ruled.

## Shapes

Geometry stays precise. The sci-fi theme uses compact corners (typically `6–8px`) and the original theme uses gentler control (`10px`) and card (`16px`) corners. Fine borders and inset top edges define surfaces. Small dots, circular signal paths and coordinates appear as information motifs. The workflow illustration uses three tilted slabs with fine silver outlines.

## Components

### Buttons

- **Shape:** Silver primary actions and graphite secondary actions use the theme's control radius (`6px` sci-fi; `10px` original). The original primary has a minimum height (`44px`); sci-fi uses (`42px`).
- **Primary:** A light silver gradient with dark text and a top glint. Hover lifts (`2px`) under the shared finish layer and sweeps a short light across the surface; active presses down (`1px`) and scales slightly (`0.985`).
- **Secondary / Ghost:** Secondary is dark, edged and brightens on hover. Ghost remains text led. Shared transitions run (`180ms`); the press state runs (`90ms`).
- **Focus:** A visible light outline (`2px`) with offset (`3px`) applies to buttons and other interactive controls.

### Cards / Containers

- **Original:** Layered graphite gradient, subtle light edge and soft depth, with a gentler corner (`16px`).
- **Sci-fi:** Darker, flatter graphite gradient with a tighter corner (`8px`). Interactive cards gain a small lift and stronger border on hover.
- **Product examples:** Keep their enclosing window frame and example label so visitors can identify them as previews.

### Inputs / Fields

- **Original:** Recessed graphite field with a gentle corner (`10px`), strong rule edge and subdued inset shadow.
- **Sci-fi:** Flatter field with a compact corner (`6px`). Focus brightens the edge and adds a restrained light ring. Placeholder text uses the cool dim text token; the caret remains bright.

### Navigation and Segmented Controls

Navigation uses concise labels, fine borders and a visible active state. Sci-fi labels can use the instrument-like monospace style where the theme does so. Segmented controls sit on raised graphite, with a silver-tinted selected fill and stronger border. On small screens, navigation and rails contract around the primary task.

### Signal and Workflow Scenes

The hero signal communicates connection through orbiting paths; the final three slabs carry the sequence from context through plan to action. A still illustration is present before WebGL loads and whenever rendering is unavailable. Canvas loading begins near the viewport and stops when the scene is offscreen, the tab is hidden, site motion is paused or reduced motion applies.

## Do's and Don'ts

### Do:

- **Do** keep the graphite and silver hierarchy across both themes.
- **Do** use Archivo for headings and primary actions, and Inter Tight for supporting text and dense controls.
- **Do** preserve visible keyboard focus and useful still frames for dimensional scenes.
- **Do** use ruled rows for the public feature story and framed windows for product examples.

### Don't:

- **Don't** turn every marketing feature into a floating card.
- **Don't** make the dimensional scenes a prerequisite for understanding or operating the page.
- **Don't** add continuous spatial motion to reduced-motion visits; retain color and focus feedback.
