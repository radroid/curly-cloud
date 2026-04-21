export type ScreenPhase = 'off' | 'flicker' | 'boot' | 'welcome' | 'desktop'

export const SIZING = {
  mobile:  { maxWidth: 480, titleFont: 11, topCornerLogoWidth: 34, curlyLogoHeight: 22, macIconSize: 42, dialogPaddingX: 14, dialogPaddingY: 12 },
  desktop: { maxWidth: 640, titleFont: 16, topCornerLogoWidth: 41, curlyLogoHeight: 40, macIconSize: 70, dialogPaddingX: 40, dialogPaddingY: 28 },
} as const
