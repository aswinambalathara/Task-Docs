"use client"

import { motion } from "framer-motion"
import { RefreshCw } from "lucide-react"

import { IllustrationFrame, MiniCard, useLoop } from "./shared"

// Step 5: tasks stream into the impact ledger table in your Google Doc, row by row
const DOC = { x: 120, y: 18, width: 200, height: 210 }
const TABLE_X = DOC.x + 16
const TABLE_WIDTH = DOC.width - 32
const ROW_HEIGHT = 18
const FIRST_ROW_Y = DOC.y + 92
const ROWS = 4
// Each row's share of the loop: a task chip flies in, then the row fills
const ROW_SLOT = 0.18

export function DocsIllustration() {
  const loop = useLoop()

  return (
    <IllustrationFrame label="Tasks flowing into an impact ledger table in a Google Doc">
      {/* The document */}
      <rect
        x={DOC.x}
        y={DOC.y}
        width={DOC.width}
        height={DOC.height}
        rx={10}
        className="fill-card stroke-border"
        strokeWidth={1.5}
      />
      <rect x={DOC.x + 16} y={DOC.y + 20} width={92} height={10} rx={5} className="fill-primary" />
      <rect x={DOC.x + 16} y={DOC.y + 38} width={140} height={6} rx={3} className="fill-muted" />
      <rect x={DOC.x + 16} y={DOC.y + 50} width={116} height={6} rx={3} className="fill-muted" />

      {/* Table header */}
      <rect
        x={TABLE_X}
        y={FIRST_ROW_Y - 22}
        width={TABLE_WIDTH}
        height={ROW_HEIGHT}
        rx={4}
        className="fill-muted"
      />
      {[0, 0.45, 0.75].map((offset) => (
        <rect
          key={offset}
          x={TABLE_X + 8 + TABLE_WIDTH * offset}
          y={FIRST_ROW_Y - 15}
          width={24}
          height={4}
          rx={2}
          className="fill-muted-foreground/60"
        />
      ))}

      {/* Rows: empty outlines, filled in one after another */}
      {Array.from({ length: ROWS }, (_, row) => {
        const y = FIRST_ROW_Y + row * (ROW_HEIGHT + 4)
        const start = 0.1 + row * ROW_SLOT
        const times = [0, start, start + 0.08, 0.92, 1]
        return (
          <g key={row}>
            <rect
              x={TABLE_X}
              y={y}
              width={TABLE_WIDTH}
              height={ROW_HEIGHT}
              rx={4}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <motion.g
              style={{ originX: 0 }}
              {...loop(
                { scaleX: [0, 0, 1, 1, 0], opacity: [0, 0, 1, 1, 0] },
                { scaleX: 1, opacity: 1 },
                { times }
              )}
            >
              <rect
                x={TABLE_X}
                y={y}
                width={TABLE_WIDTH}
                height={ROW_HEIGHT}
                rx={4}
                className="fill-primary/10"
              />
              <rect
                x={TABLE_X + 8}
                y={y + 7}
                width={TABLE_WIDTH * 0.36}
                height={4}
                rx={2}
                className="fill-foreground/50"
              />
              <rect
                x={TABLE_X + 8 + TABLE_WIDTH * 0.45}
                y={y + 7}
                width={TABLE_WIDTH * 0.22}
                height={4}
                rx={2}
                className="fill-muted-foreground/50"
              />
              <circle
                cx={TABLE_X + TABLE_WIDTH - 12}
                cy={y + ROW_HEIGHT / 2}
                r={4}
                className="fill-success"
              />
            </motion.g>
            {/* The task chip flying in from the left just before its row fills */}
            <motion.g
              {...loop(
                { x: [0, 0, 70, 70, 70], opacity: [0, 1, 0, 0, 0] },
                { x: 0, opacity: 0 },
                { times: [0, Math.max(start - 0.06, 0.01), start + 0.04, 0.92, 1] }
              )}
            >
              <MiniCard x={30} y={y - 6} width={70} height={28} />
            </motion.g>
          </g>
        )
      })}

      {/* Sync badge */}
      <circle cx={DOC.x + DOC.width - 22} cy={DOC.y + 25} r={12} className="fill-primary/15" />
      <motion.g
        style={{ originX: "50%", originY: "50%" }}
        {...loop({ rotate: [0, 360] }, { rotate: 0 }, { duration: 2.4, ease: "linear" })}
      >
        <RefreshCw
          x={DOC.x + DOC.width - 30}
          y={DOC.y + 17}
          size={16}
          strokeWidth={2.2}
          className="text-primary"
        />
      </motion.g>
    </IllustrationFrame>
  )
}
