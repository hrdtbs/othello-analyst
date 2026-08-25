export type Candidate = {
  move: number
  name: string
  score: number
  exact: boolean
}

export type Analysis = {
  bestMove: number | null
  bestName: string | null
  score: number
  exact: boolean
  depth: number
  nodes: number
  elapsedMs: number
  pv: string[]
  candidates: Candidate[]
  gameOver: boolean
  mustPass: boolean
  timedOut: boolean
}

export function isExactScore(score: number): boolean {
  return Math.abs(score) >= 5000
}

export function formatScore(score: number, exact: boolean): string {
  if (exact || isExactScore(score)) {
    const discs = Math.round(score / 10000)
    if (discs === 0) return 'even (exact)'
    return `${discs > 0 ? '+' : ''}${discs} discs (exact)`
  }
  const value = score / 100
  if (Math.abs(value) < 0.05) return 'even'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}
