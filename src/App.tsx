import { useEffect, useMemo, useState } from 'react'
import { AnalysisPanel } from './components/AnalysisPanel.tsx'
import { Board } from './components/Board.tsx'
import {
  BLACK,
  WHITE,
  afterMove,
  isGameOver,
  legalMoves,
  mineOf,
  passTurn,
  popcnt,
  setCell,
  startPosition,
  type Color,
} from './engine/board.ts'
import { decodePosition, encodePosition } from './engine/notation.ts'
import { useEngine } from './hooks/useEngine.ts'

type Mode = 'play' | 'edit'
type Snapshot = { black: bigint; white: bigint; side: Color; lastMove: number | null }

const TIME_OPTIONS = [
  { label: '0.5s', value: 500 },
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
]

const DEPTH_OPTIONS = [
  { label: '6', value: 6 },
  { label: '8', value: 8 },
  { label: '10', value: 10 },
  { label: '12', value: 12 },
]

function readHash(): Snapshot | null {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return null
  const decoded = decodePosition(raw)
  if (!decoded) return null
  return { ...decoded, lastMove: null }
}

function initialSnapshot(): Snapshot {
  return readHash() ?? { ...startPosition(), lastMove: null }
}

function sideLabel(side: Color): string {
  return side === BLACK ? 'Black' : 'White'
}

export default function App() {
  const [boot] = useState(initialSnapshot)
  const [black, setBlack] = useState(boot.black)
  const [white, setWhite] = useState(boot.white)
  const [side, setSide] = useState<Color>(boot.side)
  const [lastMove, setLastMove] = useState<number | null>(boot.lastMove)
  const [mode, setMode] = useState<Mode>('play')
  const [paint, setPaint] = useState<0 | 1 | 2>(1)
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const [timeMs, setTimeMs] = useState(2000)
  const [maxDepth, setMaxDepth] = useState(10)
  const [copied, setCopied] = useState(false)
  const { analysis, busy, analyze, cancel, clear } = useEngine()

  useEffect(() => {
    const encoded = encodePosition(black, white, side)
    const next = `#${encoded}`
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [black, white, side])

  useEffect(() => {
    let started = false
    const delay = mode === 'edit' ? 280 : 0
    const timer = window.setTimeout(() => {
      started = true
      analyze({ black, white, side, timeMs, maxDepth })
    }, delay)
    return () => {
      window.clearTimeout(timer)
      if (started) cancel()
    }
  }, [black, white, side, timeMs, maxDepth, mode, analyze, cancel])

  const mine = mineOf(black, white, side)
  const enemy = side === BLACK ? white : black
  const moves = useMemo(() => legalMoves(mine, enemy), [mine, enemy])
  const gameOver = isGameOver(black, white)
  const mustPass = moves === 0n && !gameOver
  const blackCount = popcnt(black)
  const whiteCount = popcnt(white)

  function pushHistory() {
    setUndoStack((prev) => [...prev, { black, white, side, lastMove }])
  }

  function applySnapshot(snapshot: Snapshot) {
    setBlack(snapshot.black)
    setWhite(snapshot.white)
    setSide(snapshot.side)
    setLastMove(snapshot.lastMove)
    clear()
  }

  function playMove(sq: number) {
    const played = afterMove(black, white, side, sq)
    if (!played) return
    pushHistory()
    setBlack(played.black)
    setWhite(played.white)
    setSide(played.side)
    setLastMove(sq)
    clear()
  }

  function onSquare(sq: number) {
    if (mode === 'edit') {
      pushHistory()
      const current =
        (black & (1n << BigInt(sq))) !== 0n
          ? 1
          : (white & (1n << BigInt(sq))) !== 0n
            ? 2
            : 0
      const nextCell = paint === current ? 0 : paint
      const next = setCell(black, white, sq, nextCell)
      setBlack(next.black)
      setWhite(next.white)
      setLastMove(null)
      clear()
      return
    }

    playMove(sq)
  }

  function undo() {
    const prev = undoStack[undoStack.length - 1]
    if (!prev) return
    setUndoStack((items) => items.slice(0, -1))
    applySnapshot(prev)
  }

  function reset() {
    pushHistory()
    const start = startPosition()
    applySnapshot({ ...start, lastMove: null })
  }

  function clearBoard() {
    pushHistory()
    applySnapshot({ black: 0n, white: 0n, side: BLACK, lastMove: null })
  }

  function pass() {
    if (!mustPass) return
    pushHistory()
    const next = passTurn(black, white, side)
    setSide(next.side)
    setLastMove(null)
    clear()
  }

  function runAnalyze() {
    analyze({ black, white, side, timeMs, maxDepth })
  }

  function playBest() {
    const move = analysis?.bestMove
    if (move == null) {
      analyze({ black, white, side, timeMs, maxDepth })
      return
    }
    playMove(move)
  }

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#${encodePosition(black, white, side)}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const resultText = gameOver
    ? blackCount === whiteCount
      ? 'Draw'
      : blackCount > whiteCount
        ? 'Black wins'
        : 'White wins'
    : `${sideLabel(side)} to move`

  return (
    <div className="app">
      <header className="hero">
        <h1>Othello analyst</h1>
        <p className="lede">
          Middlegame eval is a heuristic inside a time bound. With 10 or fewer
          empties the score is the exact disc difference.
        </p>
      </header>

      <main className="layout">
        <section className="board-column">
          <div className="scoreboard">
            <div className={`score ${side === BLACK ? 'is-turn' : ''}`}>
              <span className="disc disc-black" />
              <strong>{blackCount}</strong>
              <span>Black</span>
            </div>
            <p className="turn-label">{resultText}</p>
            <div className={`score ${side === WHITE ? 'is-turn' : ''}`}>
              <span className="disc disc-white" />
              <strong>{whiteCount}</strong>
              <span>White</span>
            </div>
          </div>

          <Board
            black={black}
            white={white}
            legal={moves}
            lastMove={lastMove}
            analysis={analysis}
            showLegal={mode === 'play'}
            onSquare={onSquare}
          />

          <div className="toolbar">
            <button type="button" className="primary" onClick={runAnalyze} disabled={busy}>
              {busy ? 'Searching…' : 'Search again'}
            </button>
            <button type="button" onClick={playBest} disabled={gameOver || mustPass}>
              Play this move
            </button>
            <button type="button" onClick={pass} disabled={!mustPass}>
              Pass
            </button>
            <button type="button" onClick={undo} disabled={undoStack.length === 0}>
              Undo
            </button>
          </div>
        </section>

        <aside className="side-column">
          <section className="panel-block">
            <h2>Position</h2>
            <div className="segmented" role="group" aria-label="Mode">
              <button
                type="button"
                className={mode === 'play' ? 'is-active' : undefined}
                onClick={() => setMode('play')}
              >
                Play
              </button>
              <button
                type="button"
                className={mode === 'edit' ? 'is-active' : undefined}
                onClick={() => setMode('edit')}
              >
                Edit
              </button>
            </div>

            {mode === 'edit' ? (
              <div className="segmented" role="group" aria-label="Paint">
                <button
                  type="button"
                  className={paint === 1 ? 'is-active' : undefined}
                  onClick={() => setPaint(1)}
                >
                  Black
                </button>
                <button
                  type="button"
                  className={paint === 2 ? 'is-active' : undefined}
                  onClick={() => setPaint(2)}
                >
                  White
                </button>
                <button
                  type="button"
                  className={paint === 0 ? 'is-active' : undefined}
                  onClick={() => setPaint(0)}
                >
                  Clear
                </button>
              </div>
            ) : (
              <p className="muted">
                Only dotted squares are legal. Each move restarts search for
                the new side to move.
              </p>
            )}

            <div className="field-row">
              <label>
                Time
                <select
                  value={timeMs}
                  onChange={(event) => setTimeMs(Number(event.target.value))}
                >
                  {TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Max depth
                <select
                  value={maxDepth}
                  onChange={(event) => setMaxDepth(Number(event.target.value))}
                >
                  {DEPTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="toolbar compact">
              <button
                type="button"
                onClick={() => {
                  setSide(BLACK)
                  clear()
                }}
              >
                Black to move
              </button>
              <button
                type="button"
                onClick={() => {
                  setSide(WHITE)
                  clear()
                }}
              >
                White to move
              </button>
              <button type="button" onClick={reset}>
                Starting position
              </button>
              <button type="button" onClick={clearBoard}>
                Empty the board
              </button>
              <button type="button" onClick={copyLink}>
                {copied ? 'Copied' : 'Copy position'}
              </button>
              {busy ? (
                <button type="button" onClick={cancel}>
                  Stop
                </button>
              ) : null}
            </div>
          </section>

          <AnalysisPanel
            analysis={analysis}
            busy={busy}
            sideLabel={sideLabel(side)}
          />
        </aside>
      </main>
    </div>
  )
}
