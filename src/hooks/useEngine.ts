import { useCallback, useEffect, useRef, useState } from 'react'
import type { Analysis } from '../engine/types.ts'

type AnalyzeRequest = {
  black: bigint
  white: bigint
  side: 0 | 1
  timeMs: number
  maxDepth: number
}

type WorkerMessage = {
  type: 'progress' | 'done'
  id: number
  analysis: Analysis
}

export function useEngine() {
  const workerRef = useRef<Worker | null>(null)
  const generation = useRef(0)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [busy, setBusy] = useState(false)

  const bind = useCallback((worker: Worker) => {
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const payload = event.data
      if (!payload?.analysis) return
      if (payload.id !== generation.current) return
      setAnalysis(payload.analysis)
      if (payload.type === 'done') setBusy(false)
    }
  }, [])

  const spawn = useCallback(() => {
    const worker = new Worker(new URL('../engine/worker.ts', import.meta.url), {
      type: 'module',
    })
    bind(worker)
    workerRef.current = worker
    return worker
  }, [bind])

  useEffect(() => {
    spawn()
    return () => {
      generation.current += 1
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [spawn])

  const analyze = useCallback(
    (request: AnalyzeRequest) => {
      generation.current += 1
      const id = generation.current
      workerRef.current?.terminate()
      const worker = spawn()
      setBusy(true)
      setAnalysis(null)
      worker.postMessage({
        type: 'analyze',
        id,
        black: request.black.toString(),
        white: request.white.toString(),
        side: request.side,
        timeMs: request.timeMs,
        maxDepth: request.maxDepth,
      })
    },
    [spawn],
  )

  const cancel = useCallback(() => {
    generation.current += 1
    workerRef.current?.terminate()
    spawn()
    setBusy(false)
  }, [spawn])

  const clear = useCallback(() => {
    setAnalysis(null)
  }, [])

  return { analysis, busy, analyze, cancel, clear }
}
