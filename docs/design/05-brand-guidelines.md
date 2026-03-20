# Jarvis — Brand Guidelines (Draft v0.2)

---

## 1. Brand Essence

**What is Jarvis?**
Jarvis is a personal AI command center — a single-user assistant that helps one person (Filman) stay on top of 10 life domains: work, wealth, side projects, health, fitness, spiritual, family, learning, networking, and personal branding.

**Brand in one sentence:**
Jarvis is the calm, competent intelligence behind the scenes that makes your life feel orchestrated rather than chaotic.

**Brand personality (pick 3 that define us):**
- **Composed** — Never frantic. Jarvis speaks with quiet confidence. Even when flagging something urgent, the tone is measured.
- **Perceptive** — Jarvis notices patterns you don't. It connects dots across domains — your sleep data affects your training readiness, your calendar density affects your stress score.
- **Present** — Jarvis feels alive, not like a static dashboard. It breathes, it responds, it has a visual heartbeat.

**What Jarvis is NOT:**
- Not playful or cute (no emojis, no mascot)
- Not corporate or sterile (not a generic SaaS dashboard)
- Not aggressive or flashy (not a gaming UI)

---

## 2. Name & Wordmark

**Name:** JARVIS (always styled as "JARVIS" in all caps)

**Wordmark style:**
- Clean sans-serif, medium weight, all caps
- No logo icon needed — the Arc Reactor IS the identity mark
- The reactor + "JARVIS" together form the complete brand mark

**Usage rules:**
- "JARVIS" standalone in text (always all caps)
- Reactor (small) + "JARVIS" in the header/navigation
- Never use a tagline in the UI itself

---

## 3. Color Palette

### Primary palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background | Dark navy blue | `#0f1729` | Page background, base layer |
| Surface | Navy slate | `#162036` | Cards, panels, elevated surfaces |
| Elevated | Light navy | `#1c2a44` | Hover states, active surfaces, nested elements |

### Accent palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary accent | Bold blue | `#2563eb` | Links, active states, primary actions, key highlights |
| Light accent | Bright blue | `#3b82f6` | Hover states, secondary highlights |
| Accent glow | Blue radiance | `#2563eb → #1d4ed8` | Reactor glow, premium highlights, hero elements |
| Neon green | Electric green | `#39ff14` | Live/active indicators, system online status, reactor energy sparks |
| Green glow | Neon radiance | `#39ff14 → #22c55e` | Live pulse dots, active connection glow, streak highlights |

### Semantic colors

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Success | Emerald | `#34d399` | Healthy domains, positive trends, completion |
| Warning | Amber | `#f59e0b` | Aging domains, approaching thresholds |
| Danger | Red | `#f87171` | Neglected domains, overdue items, errors |

### Text colors

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary | White | `#f8fafc` | Headings, body text, primary content |
| Secondary | Light blue-gray | `#cbd5e1` | Supporting text, labels, descriptions |
| Muted | Mid blue-gray | `#64748b` | Tertiary info, timestamps, inactive states |
| Dim | Dark blue-gray | `#475569` | Placeholders, disabled text, version numbers |
| Accent text | Bold blue | `#2563eb` | Key words, highlights, interactive text |

### Border colors

| Role | Color | Usage |
|------|-------|-------|
| Default | `rgba(255,255,255,0.08)` | Card borders, dividers |
| Active | `rgba(37,99,235,0.3)` | Focus states, hover borders (blue-tinted) |

**Color principles:**
- Background is dark navy blue, NOT pure black — gives warmth and depth
- Text contrast is white + bold blue — clean and high-contrast
- No cyan anywhere — the accent palette is pure blue
- Dark backgrounds create depth through layering (bg → surface → elevated), not through borders
- Accents are used sparingly — they should draw the eye, not overwhelm
- The blue glow gradient is reserved for the reactor and premium moments only
- Semantic colors are small and contextual (dots, badges, indicators), never large blocks
- Neon green is the "alive" signal — used for live/active/connected states and subtle reactor energy accents. Always small (dots, pulses, sparks), never backgrounds or large elements
- Blue is the brain, green is the heartbeat — blue dominates, green punctuates

---

## 4. Typography

### Font families

| Role | Family | Fallback | Usage |
|------|--------|----------|-------|
| Body | Inter | System sans-serif | All UI text, labels, paragraphs |
| Data | JetBrains Mono | System monospace | Numbers, metrics, timestamps, KPIs, code |

### Type scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Page title | 20px | Semibold (600) | Page headers (rare — Jarvis prefers subtlety) |
| Section header | 15px | Medium (500) | Card titles, section names |
| Body | 14px | Regular (400) | Paragraph text, descriptions, briefing content |
| Label | 13px | Medium (500) | Navigation items, form labels |
| Caption | 12px | Regular (400) | Timestamps, secondary metadata |
| Micro | 11px | Medium (500) | Badges, status text, domain labels |

### Typography principles:
- Primary text is white (`#f8fafc`) — high contrast against navy backgrounds
- Key words and interactive elements use bold blue (`#2563eb`) for emphasis
- Jarvis does NOT shout. No ALL CAPS section headers (exception: very small micro labels ≤11px)
- Data should feel precise — always use monospace for numbers, metrics, and timestamps
- **Every KPI needs context** — never show a number alone. Always include: label (what it is), value (the number), and meaning (what it means for the user). Example: "Body Battery · 71% · Moderate — go easy today"
- Body text should breathe — use 1.6 line-height for readability
- Heading hierarchy is subtle — size differences are small, weight does the differentiation

---

## 5. The Arc Reactor — Visual Identity

The Jarvis reactor is the most distinctive brand element. Inspired by the Iron Man arc reactor, it represents Jarvis's presence, power, and intelligence.

**What it represents:**
The reactor is Jarvis's "face." It communicates that there's a powerful intelligence behind the interface. When the reactor is visible, Jarvis feels alive and present.

**Visual characteristics:**
- **Glowing core** at the center — bright white-blue, almost white-hot
- **Concentric rotating rings** with geometric segments and technical details
- **Radial energy lines** emanating outward like a starburst
- **Particle/spark trails** along the rings, giving a sense of energy flow
- **Blue color palette** — deep blue outer rings fading to bright white-blue core
- **Soft outer glow** that bleeds into the dark navy background

**States:**

| State | Visual | When |
|-------|--------|------|
| Idle | Slow rotation of rings, gentle core pulse (4s cycle) | Default — Jarvis is present but quiet |
| Speaking | Faster rotation, brighter core, energy lines intensify, **near full-screen takeover** | Reading briefing or delta updates aloud |
| Listening | Rings expand outward, core shifts brighter, pulse rings | Voice input active |
| Thinking | Rings spin faster, particles accelerate, core flickers | Processing a request |

**Reactor sizes:**
- Small (32px) — TopBar presence indicator, inline with text. Simplified to a glowing ring icon.
- Medium (64px) — Dashboard greeting, card-level usage. Shows core + one ring.
- Large (near full-screen) — Hero moments: speaking state, login screen, voice interaction overlay. Full reactor with all rings, particles, and energy lines.

**Reactor placement rules:**
- Always visible somewhere on the screen (at minimum, small reactor in TopBar)
- **During audio playback, the reactor expands to near full-screen** — this is the signature Jarvis moment
- The reactor should never feel decorative — it should always communicate state
- When full-screen during speaking, no text overlay — the reactor IS the experience (pure cinematic moment)

---

## 6. Tone of Voice

Jarvis communicates through briefings, status labels, empty states, and notifications. The voice should be:

**Tone attributes:**
- **Direct** — "3 tasks overdue" not "It looks like you might have some tasks that need attention"
- **Informed** — "Sleep score dropped 15 pts from yesterday" not "Your sleep wasn't great"
- **Calm** — "Calendar is clear after 2pm" not "Great news! You're free this afternoon! 🎉"
- **Human enough** — "Good morning, Filman" not "SYSTEM INITIALIZED"

**Greeting convention:** Time-based greetings that change throughout the day:
- Before 12:00 → "Good morning, Filman"
- 12:00–17:00 → "Good afternoon, Filman"
- After 17:00 → "Good evening, Filman"

**Examples:**

| Context | Do | Don't |
|---------|-------|---------|
| Morning greeting | "Good morning, Filman" | "Welcome back, User!" |
| Empty state | "No briefing yet. Generate one or check back after 07:30." | "Oops! Nothing here yet 😅" |
| Overdue task | "2 tasks overdue" | "⚠️ WARNING: You have overdue tasks!!!" |
| Health insight | "Body battery at 28. Consider lighter training today." | "Your body battery is critically low!!!" |
| Success | "Briefing generated." | "✅ Success! Your briefing has been generated!" |

---

## 7. Iconography

**Style:** Outline icons, 1.5px stroke weight (matching Inter's visual weight)
**Source:** Heroicons (outline set) — already used in the codebase
**Size:** 16px (w-4 h-4) for inline, 20px (w-5 h-5) for standalone

**Icon principles:**
- Icons are functional, not decorative
- Always paired with text labels in navigation (no icon-only nav items except on mobile)
- Use semantic color on icons only when communicating status (green checkmark, red alert)
- Default icon color: `text-jarvis-text-muted`, active: `text-jarvis-accent`

---

## 8. Motion Principles

**Philosophy:** Jarvis moves like a calm intelligence — smooth, purposeful, never frantic.

| Principle | Implementation |
|-----------|---------------|
| **Smooth entry** | Content fades in with slight upward drift (0.3s ease-out) |
| **Breathing rhythm** | The reactor's idle animation is 4s — this sets the "heartbeat" of the UI |
| **State transitions** | Color and opacity changes use 0.2s transitions |
| **No bouncing** | Never use spring/bounce physics — Jarvis is composed, not playful |
| **Dramatic presence** | When Jarvis speaks, the reactor goes full-screen — this is intentionally cinematic |
| **Respect user preference** | All animations disabled under `prefers-reduced-motion: reduce` |

**Timing tokens:**
- Micro: 150ms (hover states, focus rings)
- Standard: 200ms (color transitions, opacity changes)
- Smooth: 300ms (entry animations, content reveals)
- Breathing: 4000ms (reactor idle cycle)
- Cinematic: 800ms (reactor expand/collapse to full-screen)

---

## 9. Layout Principles

**Density:** Medium — Jarvis shows a lot of data but shouldn't feel cramped. Generous padding inside cards, moderate gaps between cards.

**Depth model:**
```
Background (#0f1729)  →  Surface (#162036)  →  Elevated (#1c2a44)
     Page                  Cards                 Hover/Active
```
Depth is communicated through background color stepping, NOT through shadows or borders. Borders are minimal dividers, not depth indicators.

**Grid:**
- Desktop: Sidebar (260px) + main content area
- Main content: max 2-column grid for cards
- Mobile: single column, sidebar becomes overlay

**Spacing scale:**
- 4px, 8px, 12px, 16px, 20px, 24px, 32px, 48px
- Card padding: 20px
- Gap between cards: 20px
- Section gap: 32px

---

## Open Questions for Review

1. ~~**Accent color**~~ — Resolved: Bold blue (`#2563eb`), no cyan, no violet.
2. ~~**Reactor complexity**~~ — Resolved: Canvas/WebGL for organic, particle-heavy reactor.
3. ~~**Name styling**~~ — Resolved: "JARVIS" (all caps).
4. ~~**Greeting tone**~~ — Resolved: Time-based greetings ("Good morning/afternoon/evening, Filman").
5. ~~**Brand gradient**~~ — Resolved: Blue only. No violet, no cyan.
6. ~~**Speaking UX**~~ — Resolved: Reactor goes full-screen with no briefing text overlay — pure cinematic moment.
