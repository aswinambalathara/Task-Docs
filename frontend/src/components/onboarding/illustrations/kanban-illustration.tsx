"use client"

import { motion } from "framer-motion"

import { IllustrationFrame, MiniCard, useLoop } from "./shared"

// Step 2: a task card travels across the board, To do → In progress → Done
const COLUMNS = [
  { x: 18, label: "To do", dot: "fill-status-todo" },
  { x: 131, label: "In progress", dot: "fill-status-progress" },
  { x: 244, label: "Done", dot: "fill-status-done" },
]
const COLUMN_WIDTH = 98
const COLUMN_GAP = COLUMNS[1].x - COLUMNS[0].x
const CARD_X = COLUMNS[0].x + 7
const CARD_Y = 140

// Keyframe timing shared by the moving card and its status dots
const TIMES = [0, 0.08, 0.25, 0.38, 0.55, 0.68, 0.92, 1]

export function KanbanIllustration() {
  const loop = useLoop()
  const dot = (visible: number[], still: number) =>
    loop({ opacity: visible }, { opacity: still }, { times: TIMES, ease: "linear" })

  return (
    <IllustrationFrame label="A task card moving across a kanban board from To do to Done">
      {COLUMNS.map((column) => (
        <g key={column.label}>
          <rect
            x={column.x}
            y={24}
            width={COLUMN_WIDTH}
            height={196}
            rx={10}
            className="fill-muted/60 stroke-border"
            strokeWidth={1}
          />
          <circle cx={column.x + 13} cy={40} r={3.5} className={column.dot} />
          <text x={column.x + 22} y={43.5} className="fill-foreground text-[9.5px] font-semibold">
            {column.label}
          </text>
        </g>
      ))}

      {/* Cards already on the board */}
      <MiniCard x={CARD_X} y={58} />
      <MiniCard x={CARD_X} y={96} />
      <MiniCard x={CARD_X + COLUMN_GAP} y={58} dotClassName="fill-status-progress" />
      <MiniCard x={CARD_X + COLUMN_GAP * 2} y={58} dotClassName="fill-status-done" />
      <MiniCard x={CARD_X + COLUMN_GAP * 2} y={96} dotClassName="fill-status-done" />

      {/* The card on the move: lifts, slides one column, settles, repeats */}
      <motion.g
        {...loop(
          {
            x: [
              0,
              0,
              COLUMN_GAP,
              COLUMN_GAP,
              COLUMN_GAP * 2,
              COLUMN_GAP * 2,
              COLUMN_GAP * 2,
              COLUMN_GAP * 2,
            ],
            y: [8, 0, -6, 0, -6, 0, 0, 0],
            opacity: [0, 1, 1, 1, 1, 1, 1, 0],
          },
          { x: COLUMN_GAP, y: 0, opacity: 1 },
          { times: TIMES }
        )}
      >
        <rect
          x={CARD_X - 2}
          y={CARD_Y - 2}
          width={88}
          height={34}
          rx={8}
          className="fill-primary/15"
        />
        <MiniCard
          x={CARD_X}
          y={CARD_Y}
          className="stroke-primary"
          dotClassName="fill-transparent"
        />
        {/* The status dot changes color as the card lands in each column */}
        <motion.circle
          cx={CARD_X + 10}
          cy={CARD_Y + 10}
          r={3}
          className="fill-status-todo"
          {...dot([1, 1, 0, 0, 0, 0, 0, 0], 0)}
        />
        <motion.circle
          cx={CARD_X + 10}
          cy={CARD_Y + 10}
          r={3}
          className="fill-status-progress"
          {...dot([0, 0, 1, 1, 0, 0, 0, 0], 1)}
        />
        <motion.circle
          cx={CARD_X + 10}
          cy={CARD_Y + 10}
          r={3}
          className="fill-status-done"
          {...dot([0, 0, 0, 0, 1, 1, 1, 0], 0)}
        />
      </motion.g>
    </IllustrationFrame>
  )
}
