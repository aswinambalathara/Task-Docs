"use client"

import { motion } from "framer-motion"

import { IllustrationFrame, MiniCard, STAR_POINTS, useLoop } from "./shared"

// Step 3: a star pops onto a finished task, and a copy of it joins the Highlights stack
const CARD = { x: 28, y: 74, width: 156, height: 92 }
const STAR = { x: CARD.x + CARD.width - 20, y: CARD.y + 20 }
const STACK = { x: 226, y: 92 }

const TIMES = [0, 0.15, 0.25, 0.45, 0.62, 0.8, 1]

export function StarIllustration() {
  const loop = useLoop()

  return (
    <IllustrationFrame label="A star marking a task as a career highlight, then joining the highlights stack">
      {/* The finished task */}
      <rect
        x={CARD.x}
        y={CARD.y}
        width={CARD.width}
        height={CARD.height}
        rx={12}
        className="fill-card stroke-border"
        strokeWidth={1.5}
      />
      <circle cx={CARD.x + 18} cy={CARD.y + 20} r={4} className="fill-status-done" />
      <rect
        x={CARD.x + 30}
        y={CARD.y + 16}
        width={80}
        height={8}
        rx={4}
        className="fill-muted-foreground/45"
      />
      <rect x={CARD.x + 18} y={CARD.y + 38} width={118} height={6} rx={3} className="fill-muted" />
      <rect x={CARD.x + 18} y={CARD.y + 52} width={96} height={6} rx={3} className="fill-muted" />
      <rect
        x={CARD.x + 18}
        y={CARD.y + 70}
        width={44}
        height={12}
        rx={6}
        className="fill-primary/15"
      />

      {/* Glow ring that bursts when the star lands */}
      <motion.circle
        cx={STAR.x}
        cy={STAR.y}
        r={16}
        className="stroke-highlight"
        strokeWidth={2}
        {...loop(
          { scale: [0.4, 0.4, 1.6, 1.6, 1.6, 1.6, 1.6], opacity: [0, 0, 0.9, 0, 0, 0, 0] },
          { scale: 1, opacity: 0 },
          { times: TIMES }
        )}
      />
      {/* The star */}
      <g transform={`translate(${STAR.x} ${STAR.y})`}>
        <motion.polygon
          points={STAR_POINTS}
          className="fill-highlight stroke-highlight"
          strokeWidth={1.5}
          strokeLinejoin="round"
          {...loop(
            { scale: [0, 0, 1.35, 1, 1, 1, 0], rotate: [-40, -40, 8, 0, 0, 0, 0] },
            { scale: 1, rotate: 0 },
            { times: TIMES }
          )}
        />
      </g>

      {/* Highlights stack */}
      <text x={STACK.x} y={STACK.y - 22} className="fill-highlight text-[10px] font-semibold">
        ★ Highlights
      </text>
      <MiniCard
        x={STACK.x + 8}
        y={STACK.y + 16}
        width={100}
        height={34}
        className="stroke-border"
        dotClassName="fill-highlight"
      />
      <MiniCard
        x={STACK.x + 4}
        y={STACK.y + 8}
        width={100}
        height={34}
        className="stroke-border"
        dotClassName="fill-highlight"
      />
      <MiniCard
        x={STACK.x}
        y={STACK.y}
        width={100}
        height={34}
        className="stroke-highlight/50"
        dotClassName="fill-highlight"
      />

      {/* The copy that flies from the task onto the stack */}
      <motion.g
        {...loop(
          {
            x: [
              0,
              0,
              0,
              0,
              STACK.x - (CARD.x + 28),
              STACK.x - (CARD.x + 28),
              STACK.x - (CARD.x + 28),
            ],
            y: [0, 0, 0, 0, STACK.y - 100, STACK.y - 100, STACK.y - 100],
            opacity: [0, 0, 0, 1, 1, 0, 0],
            scale: [0.9, 0.9, 0.9, 1, 1, 0.95, 0.95],
          },
          { x: 0, y: 0, opacity: 0, scale: 1 },
          { times: TIMES }
        )}
      >
        <MiniCard
          x={CARD.x + 28}
          y={100}
          width={100}
          height={34}
          className="stroke-highlight"
          dotClassName="fill-highlight"
        />
      </motion.g>
    </IllustrationFrame>
  )
}
