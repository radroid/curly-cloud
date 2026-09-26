import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'

import * as badgeIcons from '../app/components/technology-badges'

type IconComponent = (props: { className?: string; variant?: 'light' | 'dark' }) => React.ReactElement

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/badges/png')

function toKebabCase(value: string): string {
  return value
    .replace(/Icon$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function normalizeSvg(svg: string): string {
  let normalized = svg.trim()

  // Replace CSS var() with fallback values for better SVG renderer compatibility.
  normalized = normalized.replace(/var\([^,]+,\s*([^)]+)\)/g, '$1')

  if (!normalized.includes('xmlns=')) {
    normalized = normalized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  return normalized
}

async function renderPng(iconName: string, svg: string, suffix = ''): Promise<string> {
  const filename = `${toKebabCase(iconName)}${suffix}.png`
  const outputPath = path.join(OUTPUT_DIR, filename)

  await sharp(Buffer.from(svg)).png().toFile(outputPath)

  return outputPath
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true })

  const iconEntries = Object.entries(badgeIcons).filter(([name, exported]) => {
    return name.endsWith('Icon') && typeof exported === 'function'
  }) as Array<[string, IconComponent]>

  let generatedCount = 0

  for (const [iconName, Icon] of iconEntries) {
    const lightSvg = normalizeSvg(renderToStaticMarkup(React.createElement(Icon, { variant: 'light' })))
    const darkSvg = normalizeSvg(renderToStaticMarkup(React.createElement(Icon, { variant: 'dark' })))

    await renderPng(iconName, lightSvg)
    generatedCount += 1

    if (darkSvg !== lightSvg) {
      await renderPng(iconName, darkSvg, '-dark')
      generatedCount += 1
    }
  }

  console.log(`Generated ${generatedCount} PNG badge assets in ${OUTPUT_DIR}`)
}

main().catch((error: unknown) => {
  console.error('Failed to export badge PNGs:', error)
  process.exitCode = 1
})
