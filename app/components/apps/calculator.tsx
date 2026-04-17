'use client'

import { useState, useEffect, useCallback } from 'react'

type CalcState = {
  display: string
  accumulator: number
  operator: string | null
  waitingForOperand: boolean
  hasError: boolean
}

const initialState: CalcState = {
  display: '0',
  accumulator: 0,
  operator: null,
  waitingForOperand: false,
  hasError: false,
}

const MAX_DISPLAY_LENGTH = 9

function formatResult(n: number): string {
  if (!isFinite(n)) return 'Error'
  // Try integer first
  const intStr = String(Math.round(n))
  if (Number(intStr) === n && intStr.length <= MAX_DISPLAY_LENGTH) {
    return intStr
  }
  // Float: use toPrecision to fit within MAX_DISPLAY_LENGTH chars
  const str = String(n)
  if (str.length <= MAX_DISPLAY_LENGTH) return str
  // Try toPrecision shrinking until it fits (or use Error)
  for (let p = MAX_DISPLAY_LENGTH - 1; p >= 1; p--) {
    const s = Number(n.toPrecision(p)).toString()
    if (s.length <= MAX_DISPLAY_LENGTH) return s
  }
  return 'Error'
}

function applyOperator(acc: number, operand: number, operator: string): number {
  switch (operator) {
    case '+': return acc + operand
    case '-': return acc - operand
    case '*': return acc * operand
    case '/': return operand === 0 ? Infinity : acc / operand
    default: return operand
  }
}

export function CalculatorApp() {
  const [state, setState] = useState<CalcState>(initialState)

  const handleDigit = useCallback((digit: string) => {
    setState((prev) => {
      if (prev.hasError) return prev
      if (prev.waitingForOperand) {
        return {
          ...prev,
          display: digit === '0' ? '0' : digit,
          waitingForOperand: false,
        }
      }
      // Leading zero: replace single '0' with digit unless digit is '0'
      if (prev.display === '0') {
        return { ...prev, display: digit === '0' ? '0' : digit }
      }
      if (prev.display.replace('-', '').replace('.', '').length >= MAX_DISPLAY_LENGTH) {
        return prev
      }
      return { ...prev, display: prev.display + digit }
    })
  }, [])

  const handleDecimal = useCallback(() => {
    setState((prev) => {
      if (prev.hasError) return prev
      if (prev.waitingForOperand) {
        return { ...prev, display: '0.', waitingForOperand: false }
      }
      if (prev.display.includes('.')) return prev
      return { ...prev, display: prev.display + '.' }
    })
  }, [])

  const handleOperator = useCallback((op: string) => {
    setState((prev) => {
      if (prev.hasError) return prev
      const operand = parseFloat(prev.display)
      if (prev.operator !== null && !prev.waitingForOperand) {
        // Chain: apply previous operator left-to-right
        const result = applyOperator(prev.accumulator, operand, prev.operator)
        const formatted = isFinite(result) ? formatResult(result) : 'Error'
        if (formatted === 'Error') return { ...initialState, display: 'Error', hasError: true }
        return { ...prev, display: formatted, accumulator: result, operator: op, waitingForOperand: true }
      }
      return { ...prev, accumulator: operand, operator: op, waitingForOperand: true }
    })
  }, [])

  const handleEquals = useCallback(() => {
    setState((prev) => {
      if (prev.hasError || prev.operator === null) return prev
      const result = applyOperator(prev.accumulator, parseFloat(prev.display), prev.operator)
      const formatted = isFinite(result) ? formatResult(result) : 'Error'
      if (formatted === 'Error') return { ...initialState, display: 'Error', hasError: true }
      return { display: formatted, accumulator: result, operator: null, waitingForOperand: true, hasError: false }
    })
  }, [])

  const handleClear = useCallback(() => {
    setState(initialState)
  }, [])

  // Keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key
      if (k >= '0' && k <= '9') handleDigit(k)
      else if (k === '.') handleDecimal()
      else if (k === '+' || k === '-' || k === '*') handleOperator(k)
      else if (k === '/') { e.preventDefault(); handleOperator('/') }
      else if (k === '=' || k === 'Enter') handleEquals()
      else if (k === 'Escape' || k === 'c' || k === 'C') handleClear()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleDigit, handleDecimal, handleOperator, handleEquals, handleClear])

  const btnBase: React.CSSProperties = {
    fontFamily: 'var(--font-chicago)', fontSize: 14, background: '#fff', color: '#000',
    border: '1px solid #000', padding: 0, margin: 0, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitFontSmoothing: 'none', userSelect: 'none',
  }
  const opBtnBase: React.CSSProperties = { ...btnBase, border: '2px solid #000' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      {/* Inline style block for active state */}
      <style>{`
        .calc-btn:active,
        .calc-btn.active {
          background: #000 !important;
          color: #fff !important;
        }
      `}</style>

      {/* Display */}
      <div
        style={{
          borderBottom: '2px solid #000',
          padding: '6px 8px',
          fontFamily: 'var(--font-chicago)',
          fontSize: 22,
          textAlign: 'right',
          background: '#fff',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          letterSpacing: 0.5,
          WebkitFontSmoothing: 'none',
          minHeight: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {state.display}
      </div>

      {/* Button grid — 4 cols × 5 rows. `=` spans 2 rows, `0` spans 2 cols. */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(5, 1fr)', gap: 2, padding: 2 }}>
        {([
          ['C', handleClear, false],
          ['÷', () => handleOperator('/'), true],
          ['×', () => handleOperator('*'), true],
          ['+', () => handleOperator('+'), true],
          ['7', () => handleDigit('7'), false],
          ['8', () => handleDigit('8'), false],
          ['9', () => handleDigit('9'), false],
          ['−', () => handleOperator('-'), true],
          ['4', () => handleDigit('4'), false],
          ['5', () => handleDigit('5'), false],
          ['6', () => handleDigit('6'), false],
          ['=', handleEquals, true, { gridRow: 'span 2' }],
          ['1', () => handleDigit('1'), false],
          ['2', () => handleDigit('2'), false],
          ['3', () => handleDigit('3'), false],
          ['0', () => handleDigit('0'), false, { gridColumn: 'span 2' }],
          ['.', handleDecimal, false],
        ] as const).map(([label, onClick, isOp, extra], i) => (
          <button
            key={i}
            className="calc-btn"
            type="button"
            style={{ ...(isOp ? opBtnBase : btnBase), ...(extra as React.CSSProperties | undefined) }}
            onClick={onClick}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
