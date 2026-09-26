# Mobile Experience — iPhone OS 1 (2007) Style

> **Status**: Planning — to be built after desktop experience is complete.

---

## Vision

On mobile viewports, replace the current welcome screen with an iPhone OS 1 (original iPhone, 2007) experience. Same apps as desktop, but wrapped in iPhone-native chrome instead of Mac OS windows.

---

## Key Differences from Desktop

- **No draggable windows** — apps open full-screen, one at a time
- **Springboard** — home screen with rounded app icon grid (4 columns)
- **Slide to unlock** — replaces the boot sequence on mobile
- **Status bar** — top bar with carrier name, time, battery (styled, not real)
- **Home button** — tap to return to springboard
- **No menu bar** — apps have their own navigation (back button, title bar)

---

## Assets

User has assets ready: phone screen frame, logos, icons. To be shared when mobile phase begins.

---

## Shared Components

App content components (Calculator logic, Notepad text area, etc.) should be reusable between desktop and mobile. Only the shell/chrome differs:
- Desktop: `Window` component wraps app content
- Mobile: full-screen view with iPhone OS navigation wraps same app content

---

## Implementation

- Separate phase after desktop is fully merged to `main`
- Own branch: `feat/mobile-iphone-os`
- Responsive detection in `page.tsx` already exists (`isDesktop` state)
