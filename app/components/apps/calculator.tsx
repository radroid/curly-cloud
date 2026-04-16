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
        if (!isFinite(result)) {
          return { ...initialState, display: 'Error', hasError: true }
        }
        const formatted = formatResult(result)
        if (formatted === 'Error') {
          return { ...initialState, display: 'Error', hasError: true }
        }
        return {
          ...prev,
          display: formatted,
          accumulator: result,
          operator: op,
          waitingForOperand: true,
        }
      }
      return {
        ...prev,
        accumulator: operand,
        operator: op,
        waitingForOperand: true,
      }
    })
  }, [])

  const handleEquals = useCallback(() => {
    setState((prev) => {
      if (prev.hasError) return prev
      if (prev.operator === null) return prev
      const operand = parseFloat(prev.display)
      const result = applyOperator(prev.accumulator, operand, prev.operator)
      if (!isFinite(result)) {
        return { ...initialState, display: 'Error', hasError: true }
      }
      const formatted = formatResult(result)
      if (formatted === 'Error') {
        return { ...initialState, display: 'Error', hasError: true }
      }
      return {
        display: formatted,
        accumulator: result,
        operator: null,
        waitingForOperand: true,
        hasError: false,
      }
    })
  }, [])

  const handleClear = useCallback(() => {
    setState(initialState)
  }, [])

  // Keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
      } else if (e.key === '.') {
        handleDecimal()
      } else if (e.key === '+') {
        handleOperator('+')
      } else if (e.key === '-') {
        handleOperator('-')
      } else if (e.key === '*') {
        handleOperator('*')
      } else if (e.key === '/') {
        e.preventDefault()
        handleOperator('/')
      } else if (e.key === '=' || e.key === 'Enter') {
        handleEquals()
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleDigit, handleDecimal, handleOperator, handleEquals, handleClear])

  const btnBase: React.CSSProperties = {
    fontFamily: 'var(--font-chicago)',
    fontSize: 14,
    background: '#fff',
    color: '#000',
    border: '1px solid #000',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitFontSmoothing: 'none',
    userSelect: 'none',
    // Active invert handled via CSS class
  }

  const opBtnBase: React.CSSProperties = {
    ...btnBase,
    border: '2px solid #000',
  }

  // Button row layout: 4 columns, 5 rows
  // Row 1: C  /  *  +
  // Row 2: 7  8  9  -
  // Row 3: 4  5  6  =
  // Row 4: 1  2  3  .
  // Row 5: 0 (span 2)  [empty]  [empty] — but we do 0 span-2, then blank
  // Actually: 0 spans cols 1-2, then col3=empty, col4=empty (or adjust)
  // Mac OS 1 reference: 0 spans full bottom left two columns

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
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

      {/* Button grid */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(5, 1fr)',
          gap: 2,
          padding: 2,
        }}
      >
        {/* Row 1: C / * + */}
        <button
          className="calc-btn"
          type="button"
          style={btnBase}
          onClick={handleClear}
        >
          C
        </button>
        <button
          className="calc-btn"
          type="button"
          style={opBtnBase}
          onClick={() => handleOperator('/')}
        >
          ÷
        </button>
        <button
          className="calc-btn"
          type="button"
          style={opBtnBase}
          onClick={() => handleOperator('*')}
        >
          ×
        </button>
        <button
          className="calc-btn"
          type="button"
          style={opBtnBase}
          onClick={() => handleOperator('+')}
        >
          +
        </button>

        {/* Row 2: 7 8 9 - */}
        <button className="calc-btn" type="button" style={btnBase} onClick={() => handleDigit('7')}>7</button>
        <button className="calc-btn" type="button" style={btnBase} onClick={() => handleDigit('8')}>8</button>
        <button className="calc-btn" type="button" style={btnBase} onClick={() => handleDigit('9')}>9</button>
        <button className="calc-btn" type="button" style={opBtnBase} onClick={() => handleOperator('-')}>−</button>

        {/* Row 3: 4 5 6 = */}
        <button className="calc-btn" type="button" style={btnBase} onClick={() => handleDigit('4')}>4</button>
        <button className="calc-btn" type="button" style={btnBase} onClick={() => handleDigit('5')}>5</button>
        <button className="calc-btn" type="button" style={btnBase} onClick={() => handleDigit('6')}>6</button>
        <button
          className="calc-btn"
          type="button"
          style={{ ...opBtnBase, gridRow: 'span 2' }}
          onClick={handleEquals}
        >
          =
        </button>

        {/* Row 4: 1 2 3 (= spans from row 3) */}
        <button className="calc-btn" type="button" style={btnBase} onClick={() => handleDigit('1')}>1</button>
        <button className="calc-btn" type="button" style={btnBase} onClick={() => handleDigit('2')}>2</button>
        <button className="calc-btn" type="button" style={btnBase} onClick={() => handleDigit('3')}>3</button>

        {/* Row 5: 0 (span 2 cols) . */}
        <button
          className="calc-btn"
          type="button"
          style={{ ...btnBase, gridColumn: 'span 2' }}
          onClick={() => handleDigit('0')}
        >
          0
        </button>
        <button className="calc-btn" type="button" style={btnBase} onClick={handleDecimal}>.</button>
      </div>
    </div>
  )
}
