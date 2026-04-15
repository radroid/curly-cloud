'use client'

import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'

// Mac OS System 1 themed context menu — same API surface as the stock
// shadcn/ui component, restyled with inline styles (Chicago font, white
// background, 1px black border, hover = inverted).

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuGroup = ContextMenuPrimitive.Group
const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuSub = ContextMenuPrimitive.Sub
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

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

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ inset, children, style, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    data-mac-item
    style={{ ...itemBaseStyle, paddingLeft: inset ? 28 : 16, ...style }}
    {...props}
  >
    {children}
    <span style={{ marginLeft: 'auto', paddingLeft: 16 }}>▶</span>
  </ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ style, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    style={{ ...contentStyle, ...style }}
    {...props}
  />
))
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName

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

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ children, checked, style, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    data-mac-item
    style={{ ...itemBaseStyle, paddingLeft: 28, paddingRight: 8, ...style }}
    checked={checked}
    {...props}
  >
    <span
      style={{
        position: 'absolute',
        left: 8,
        width: 12,
        height: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
      }}
    >
      <ContextMenuPrimitive.ItemIndicator>✓</ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ children, style, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    data-mac-item
    style={{ ...itemBaseStyle, paddingLeft: 28, paddingRight: 8, ...style }}
    {...props}
  >
    <span
      style={{
        position: 'absolute',
        left: 8,
        width: 12,
        height: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
      }}
    >
      <ContextMenuPrimitive.ItemIndicator>●</ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

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

const ContextMenuShortcut = ({
  style,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      style={{
        marginLeft: 'auto',
        paddingLeft: 24,
        fontSize: 11,
        opacity: 0.6,
        ...style,
      }}
      {...props}
    />
  )
}
ContextMenuShortcut.displayName = 'ContextMenuShortcut'

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
