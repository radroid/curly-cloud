import type { ReactNode } from 'react'
import { CalculatorApp } from '../apps/calculator'
import { NotePadApp } from '../apps/note-pad'

export type Rect = { x: number; y: number; width: number; height: number }

export type MenuItem =
  | { type: 'divider' }
  | {
      type?: 'item'
      label: string
      action?: () => void
      disabled?: boolean
      shortcut?: string
    }

export type MenuConfig = {
  label: string
  items: MenuItem[]
}

export type WindowSize = {
  width: string
  height: string
}

export type AppDefinition = {
  id: string
  name: string
  iconSrc: string
  defaultSize: WindowSize
  menuItems: MenuConfig[]
  component: React.FC
  showScrollbar?: boolean
  statusBar?: ReactNode
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 20,
        fontFamily: 'var(--font-chicago)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 'bold' }}>{name}</div>
      <div style={{ fontSize: 11, color: '#555' }}>Coming soon</div>
    </div>
  )
}

const makePlaceholder = (name: string) => () => <ComingSoon name={name} />

const defaultMenus: MenuConfig[] = []

export const APP_REGISTRY: AppDefinition[] = [
  {
    id: 'browser',
    name: 'Curly Browser',
    iconSrc: '/app-icons/browser.svg',
    defaultSize: {
      width: 'clamp(300px, 78cqw, 600px)',
      height: 'clamp(250px, 75cqh, 450px)',
    },
    menuItems: defaultMenus,
    component: makePlaceholder('Curly Browser'),
    showScrollbar: true,
  },
  {
    id: 'notepad',
    name: 'Note Pad',
    iconSrc: '/app-icons/notepad.svg',
    defaultSize: {
      width: 'clamp(180px, 40cqw, 300px)',
      height: 'clamp(220px, 60cqh, 380px)',
    },
    menuItems: [
      {
        label: 'File',
        items: [
          { label: 'Clear Note', disabled: true },
          { type: 'divider' },
          { label: 'Close', disabled: true },
        ],
      },
      {
        label: 'Edit',
        items: [
          { label: 'Undo', disabled: true },
          { type: 'divider' },
          { label: 'Cut', disabled: true },
          { label: 'Copy', disabled: true },
          { label: 'Paste', disabled: true },
        ],
      },
    ],
    component: NotePadApp,
  },
  {
    id: 'control-panel',
    name: 'Control Panel',
    iconSrc: '/app-icons/control-panel.svg',
    defaultSize: {
      width: 'clamp(250px, 55cqw, 420px)',
      height: 'clamp(200px, 55cqh, 350px)',
    },
    menuItems: defaultMenus,
    component: makePlaceholder('Control Panel'),
  },
  {
    id: 'calculator',
    name: 'Calculator',
    iconSrc: '/app-icons/calculator.svg',
    defaultSize: {
      width: 'clamp(120px, 25cqw, 200px)',
      height: 'clamp(180px, 45cqh, 280px)',
    },
    menuItems: [
      {
        label: 'File',
        items: [{ label: 'Close', disabled: true }],
      },
      {
        label: 'Edit',
        items: [
          { label: 'Copy Display', disabled: true },
          { type: 'divider' },
          { label: 'Clear', disabled: true },
        ],
      },
    ],
    component: CalculatorApp,
  },
  {
    id: 'finder',
    name: 'Documents',
    iconSrc: '/app-icons/finder.svg',
    defaultSize: {
      width: 'clamp(220px, 48cqw, 380px)',
      height: 'clamp(180px, 50cqh, 320px)',
    },
    menuItems: defaultMenus,
    component: makePlaceholder('Documents'),
    statusBar: <span>0 items</span>,
  },
  {
    id: 'scrapbook',
    name: 'Journal',
    iconSrc: '/app-icons/journal.svg',
    defaultSize: {
      width: 'clamp(250px, 55cqw, 420px)',
      height: 'clamp(220px, 60cqh, 380px)',
    },
    menuItems: defaultMenus,
    component: makePlaceholder('Journal'),
  },
  {
    id: 'world-map',
    name: 'World Map',
    iconSrc: '/app-icons/world-map.svg',
    defaultSize: {
      width: 'clamp(280px, 70cqw, 540px)',
      height: 'clamp(220px, 60cqh, 380px)',
    },
    menuItems: defaultMenus,
    component: makePlaceholder('World Map'),
  },
  {
    id: 'music',
    name: 'Music',
    iconSrc: '/app-icons/music.svg',
    defaultSize: {
      width: 'clamp(180px, 40cqw, 300px)',
      height: 'clamp(220px, 60cqh, 380px)',
    },
    menuItems: defaultMenus,
    component: makePlaceholder('Music'),
  },
  {
    id: 'trash',
    name: 'Trash',
    iconSrc: '/app-icons/trash.svg',
    defaultSize: {
      width: 'clamp(200px, 45cqw, 340px)',
      height: 'clamp(140px, 40cqh, 220px)',
    },
    menuItems: defaultMenus,
    component: makePlaceholder('Trash'),
    statusBar: <span>0 items, 0K in trash, 0K available</span>,
  },
]

export const APP_MAP: Record<string, AppDefinition> = Object.fromEntries(
  APP_REGISTRY.map((app) => [app.id, app]),
)

export const FINDER_DEFAULT_MENUS: MenuConfig[] = [
  {
    label: 'File',
    items: [
      { label: 'New Folder', disabled: true },
      { label: 'Open', disabled: true },
      { type: 'divider' },
      { label: 'Close', disabled: true },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', disabled: true },
      { type: 'divider' },
      { label: 'Cut', disabled: true },
      { label: 'Copy', disabled: true },
      { label: 'Paste', disabled: true },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'by Icon', disabled: true },
      { label: 'by Name', disabled: true },
    ],
  },
  {
    label: 'Special',
    items: [
      { label: 'Clean Up', disabled: true },
      { label: 'Empty Trash', disabled: true },
    ],
  },
]
