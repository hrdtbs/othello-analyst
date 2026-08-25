import { analyze, type Analysis } from './search.ts'

type Incoming =
  | {
      type: 'analyze'
      id: number
      black: string
      white: string
      side: 0 | 1
      timeMs: number
      maxDepth: number
    }
  | { type: 'stop' }

let cancelled = false
let activeId = 0

function pack(id: number, analysis: Analysis, type: 'progress' | 'done') {
  return { type, id, analysis }
}

self.onmessage = (event: MessageEvent<Incoming>) => {
  const message = event.data
  if (message.type === 'stop') {
    cancelled = true
    return
  }
  if (message.type !== 'analyze') return

  cancelled = false
  activeId = message.id
  const result = analyze({
    black: BigInt(message.black),
    white: BigInt(message.white),
    side: message.side,
    timeMs: message.timeMs,
    maxDepth: message.maxDepth,
    onProgress: (analysis) => {
      if (!cancelled && activeId === message.id) {
        self.postMessage(pack(message.id, analysis, 'progress'))
      }
    },
  })
  if (!cancelled && activeId === message.id) {
    self.postMessage(pack(message.id, result, 'done'))
  }
}
