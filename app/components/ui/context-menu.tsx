'use client'

import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger

const contentStyle: React.CSSProperties = {
  minWidth: 160,
  background: '#fff',
  border: '1px solid #000',
  boxShadow: '2px 2px 0 #000',
  padding: '2px 0',
  fontFamily: 'var(--font-chicago)',
  fontSize: 12,
  color: '#000',
  zIndex: 10000,
}

const itemBaseStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  padding: '3px 16px',
  outline: 'none',
  userSelect: 'none',
  cursor: 'default',
  fontFamily: 'var(--font-chicago)',
  fontSize: 12,
  lineHeight: 1.25,
}

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ style, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      style={{ ...contentStyle, ...style }}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ inset, style, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    data-mac-item
    style={{ ...itemBaseStyle, paddingLeft: inset ? 28 : 16, ...style }}
    {...props}
  />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ inset, style, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    style={{
      padding: '3px 16px',
      paddingLeft: inset ? 28 : 16,
      fontFamily: 'var(--font-chicago)',
      fontSize: 12,
      fontWeight: 'bold',
      color: '#000',
      ...style,
    }}
    {...props}
  />
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ style, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    style={{ height: 1, margin: '2px 0', background: '#000', opacity: 0.5, ...style }}
    {...props}
  />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
}
