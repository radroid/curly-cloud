'use client'

import { useCallback, useEffect, useState } from 'react'
import { btn, Notice, PageHeader, Panel, Spinner } from '@/app/studio/_components/ui'
import { studio, type ApiFailure } from '@/lib/studio/api'
import { fmtDateTime, fmtNum, timeAgo } from '@/lib/studio/shared'
import type { PersonaRebuild, PersonaRecord } from '@/lib/studio/types'

export function PersonaView() {
  const [persona, setPersona] = useState<PersonaRecord | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<ApiFailure | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuilt, setRebuilt] = useState<PersonaRebuild | null>(null)
  const [rebuildError, setRebuildError] = useState<ApiFailure | null>(null)

  const load = useCallback(async () => {
    const res = await studio.persona.get()
    if (res.ok) {
      setPersona(res.data)
      setError(null)
    } else setError(res)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function rebuild() {
    setRebuilding(true)
    setRebuildError(null)
    setRebuilt(null)
    const res = await studio.persona.rebuild()
    setRebuilding(false)
    if (res.ok) {
      setRebuilt(res.data)
      await load()
    } else setRebuildError(res)
  }

  const missing = error?.missing || rebuildError?.missing
  const text = persona?.text ?? rebuilt?.text ?? null

  return (
    <>
      <PageHeader
        index="06"
        section="Persona"
        title="How the clone sounds"
        description="A distilled profile of your voice and principles, built from your private answers and used in every system prompt. Rebuild it after a batch of new answers."
        actions={
          <button type="button" className={btn.primary} onClick={rebuild} disabled={rebuilding || !!error?.missing}>
            {rebuilding ? (
              <>
                <Spinner /> Distilling your answers…
              </>
            ) : (
              'Rebuild from my answers'
            )}
          </button>
        }
      />

      {missing ? (
        <Notice tone="warn" title="Not in this build yet" className="mb-4">
          <code>/api/admin/persona</code> lands with the RAG stream. Until then there’s nothing to show or rebuild here.
        </Notice>
      ) : null}
      {error && !error.missing ? (
        <Notice tone="error" title="Couldn’t load the persona" className="mb-4">
          {error.message}
        </Notice>
      ) : null}
      {rebuildError && !rebuildError.missing ? (
        <Notice tone="error" title="Rebuild failed" className="mb-4">
          {rebuildError.message}
        </Notice>
      ) : null}
      {rebuilt ? (
        <Notice tone="ok" title="Rebuilt" className="mb-4">
          Distilled from {fmtNum(rebuilt.sourcesUsed)} private source{rebuilt.sourcesUsed === 1 ? '' : 's'}.
        </Notice>
      ) : null}

      <Panel
        title="Current persona"
        meta={persona ? `updated ${timeAgo(persona.updatedAt)} · ${fmtNum(persona.text.length)} chars` : undefined}
      >
        {!loaded ? (
          <p className="text-sm text-muted">
            <Spinner className="mr-2" /> Loading…
          </p>
        ) : text ? (
          <>
            <div className="max-w-[70ch] whitespace-pre-wrap text-[15px] leading-7 text-ink">{text}</div>
            {persona ? <p className="mt-4 border-t border-rule pt-3 font-mono text-[11px] text-muted">Last built {fmtDateTime(persona.updatedAt)}</p> : null}
          </>
        ) : !missing && !error ? (
          <p className="text-sm text-muted">No persona yet. Import some interview answers, then rebuild.</p>
        ) : (
          <p className="text-sm text-muted">Nothing to show.</p>
        )}
      </Panel>
    </>
  )
}
