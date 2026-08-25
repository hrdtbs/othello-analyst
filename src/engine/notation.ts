const COLS = 'ABCDEFGH'

export function squareName(sq: number): string {
  return `${COLS[sq % 8]}${Math.floor(sq / 8) + 1}`
}

export function parseSquare(name: string): number | null {
  const normalized = name.trim().toUpperCase()
  if (normalized.length < 2) return null
  const col = COLS.indexOf(normalized[0] ?? '')
  const row = Number(normalized[1]) - 1
  if (col < 0 || row < 0 || row > 7) return null
  return row * 8 + col
}

export function encodePosition(black: bigint, white: bigint, side: 0 | 1): string {
  const b = black.toString(16).padStart(16, '0')
  const w = white.toString(16).padStart(16, '0')
  return `${b}${w}${side}`
}

export function decodePosition(raw: string): {
  black: bigint
  white: bigint
  side: 0 | 1
} | null {
  const token = raw.replace(/[^0-9a-f]/gi, '')
  if (token.length !== 33) return null
  try {
    const black = BigInt(`0x${token.slice(0, 16)}`)
    const white = BigInt(`0x${token.slice(16, 32)}`)
    const side = Number(token[32]) === 1 ? 1 : 0
    if (black & white) return null
    return { black, white, side }
  } catch {
    return null
  }
}
