export type ScreenPhase = 'off' | 'flicker' | 'boot' | 'welcome'

export const SIZING = {
  mobile: {
    maxWidth: 320,
    screenMinHeight: 340,
    menuBarHeight: 18,
    menuBarFont: 9,
    titleFont: 10,
    macLogoWidth: 28,
    macLogoHeight: 34,
    curlyLogoHeight: 36,
    macIconSize: 60,
    dialogPaddingX: 14,
    dialogPaddingY: 12,
    dialogGap: 8,
  },
  desktop: {
    maxWidth: 560,
    screenMinHeight: 420,
    menuBarHeight: 22,
    menuBarFont: 12,
    titleFont: 18,
    macLogoWidth: 56,
    macLogoHeight: 67,
    curlyLogoHeight: 64,
    macIconSize: 100,
    dialogPaddingX: 40,
    dialogPaddingY: 28,
    dialogGap: 16,
  },
} as const
