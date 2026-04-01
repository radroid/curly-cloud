export type ScreenPhase = 'off' | 'flicker' | 'boot' | 'welcome'

export const SIZING = {
  mobile: {
    maxWidth: 320,
    screenMinHeight: 340,
    menuBarHeight: 18,
    menuBarFont: 9,
    titleFont: 13,
    macLogoWidth: 40,
    macLogoHeight: 48,
    curlyLogoHeight: 14,
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
    titleFont: 22,
    macLogoWidth: 80,
    macLogoHeight: 96,
    curlyLogoHeight: 28,
    macIconSize: 100,
    dialogPaddingX: 40,
    dialogPaddingY: 28,
    dialogGap: 16,
  },
} as const
