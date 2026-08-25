import type { Analysis } from '../engine/types.ts'

type BoardProps = {
  black: bigint
  white: bigint
  legal: bigint
  lastMove: number | null
  analysis: Analysis | null
  showLegal: boolean
  onSquare: (sq: number) => void
}

function bitHas(board: bigint, sq: number): boolean {
  return (board & (1n << BigInt(sq))) !== 0n
}

export function Board({
  black,
  white,
  legal,
  lastMove,
  analysis,
  showLegal,
  onSquare,
}: BoardProps) {
  const best = analysis?.bestMove ?? null
  const candidateBySq = new Map(
    (analysis?.candidates ?? []).map((item, index) => [
      item.move,
      { ...item, rank: index + 1 },
    ]),
  )

  return (
    <div className="board-wrap">
      <div className="board-frame" role="grid" aria-label="Othello board">
        <span className="board-corner" aria-hidden="true" />
        {Array.from({ length: 8 }, (_, col) => (
          <span className="board-file" key={`file-${col}`}>
            {String.fromCharCode(65 + col)}
          </span>
        ))}
        {Array.from({ length: 8 }, (_, row) => [
          <span className="board-rank" key={`rank-${row}`}>
            {row + 1}
          </span>,
          ...Array.from({ length: 8 }, (_, col) => {
            const sq = row * 8 + col
            const isBlack = bitHas(black, sq)
            const isWhite = bitHas(white, sq)
            const isLegal = showLegal && bitHas(legal, sq)
            const candidate = candidateBySq.get(sq)
            const dark = (row + col) % 2 === 1
            const classes = [
              'square',
              dark ? 'is-dark' : '',
              isLegal ? 'is-legal' : '',
              lastMove === sq ? 'is-last' : '',
              best === sq ? 'is-best' : '',
              candidate && best !== sq ? 'is-candidate' : '',
            ]
              .filter(Boolean)
              .join(' ')
            const label = `${String.fromCharCode(65 + col)}${row + 1}`
            return (
              <button
                key={sq}
                type="button"
                className={classes}
                role="gridcell"
                aria-label={
                  isBlack
                    ? `${label} black`
                    : isWhite
                      ? `${label} white`
                      : isLegal
                        ? `${label} legal`
                        : `${label} empty`
                }
                onClick={() => onSquare(sq)}
              >
                {isBlack ? <span className="disc disc-black" /> : null}
                {isWhite ? <span className="disc disc-white" /> : null}
                {isLegal && !isBlack && !isWhite ? (
                  <span className="legal-dot" />
                ) : null}
                {candidate ? (
                  <span className="move-badge">
                    {candidate.rank}
                  </span>
                ) : null}
              </button>
            )
          }),
        ])}
      </div>
    </div>
  )
}
