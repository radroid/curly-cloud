'use client'

import { useEffect, useState } from 'react'
import { Diagnostics } from './diagnostics'
import { useLocation } from '@/app/lib/use-location'

export function MobileDigitalClock() {
    const [localTime, setLocalTime] = useState<string>('')
    const [date, setDate] = useState<string>('')
    const [showDiagnostics, setShowDiagnostics] = useState(false)
    const location = useLocation()

    useEffect(() => {
        const updateTimeAndDate = () => {
            const now = new Date()
            const hours = now.getHours().toString().padStart(2, '0')
            const minutes = now.getMinutes().toString().padStart(2, '0')
            const seconds = now.getSeconds().toString().padStart(2, '0')
            setLocalTime(`${hours}:${minutes}:${seconds}`)

            const dateStr = now.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            })
            setDate(dateStr)
        }

        updateTimeAndDate()
        const interval = setInterval(updateTimeAndDate, 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <>
            <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="fixed top-4 right-4 z-40 rounded-lg p-3 text-xs font-mono text-right transition-all duration-300 hover:scale-105 active:scale-95"
                style={{ backgroundColor: 'rgb(var(--card))' }}
                aria-label="Open diagnostics"
            >
                <div className="flex flex-col items-end space-y-1">
                    <div
                        className="text-[10px] font-semibold"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                        {location.city}
                    </div>
                    <div
                        className="text-base font-bold"
                        style={{ color: 'rgb(var(--foreground))' }}
                    >
                        {localTime}
                    </div>
                    <div
                        className="text-[10px]"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                        {date}
                    </div>
                </div>
            </button>

            <Diagnostics isOpen={showDiagnostics} onClose={() => setShowDiagnostics(false)} />
        </>
    )
}
