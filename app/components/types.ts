export type ScreenPhase = 'off' | 'flicker' | 'boot' | 'welcome' | 'desktop'

export const SIZING = {
  mobile: {
    maxWidth: 480,
    screenMinHeight: 0,
    menuBarHeight: 18,
    menuBarFont: 9,
    titleFont: 11,
    macLogoWidth: 28,
    topCornerLogoWidth: 34,
    macLogoHeight: 34,
    curlyLogoHeight: 22,
    macIconSize: 60,
    dialogPaddingX: 14,
    dialogPaddingY: 12,
    dialogGap: 8,
  },
  desktop: {
    maxWidth: 640,
    screenMinHeight: 0,
    menuBarHeight: 22,
    menuBarFont: 12,
    titleFont: 16,
    macLogoWidth: 34,
    topCornerLogoWidth: 41,
    macLogoHeight: 67,
    curlyLogoHeight: 40,
    macIconSize: 100,
    dialogPaddingX: 40,
    dialogPaddingY: 28,
    dialogGap: 16,
  },
} as const
