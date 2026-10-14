"use client"

import { motion, useReducedMotion } from "framer-motion"
import { FileText, ListTodo, TerminalSquare, type LucideIcon } from "lucide-react"

import { IllustrationFrame, useLoop } from "./shared"

// Step 1: the Tethr "T". Tasks and the AI IDE are tethered together, and both feed the
// Google Doc anchored below, the same geometry as the logo.
const TASKS = { x: 72, y: 72 }
const IDE = { x: 288, y: 72 }
const DOCS = { x: 180, y: 182 }
const JUNCTION = { x: 180, y: 72 }
const NODE_HALF_WIDTH = 34
const NODE_HALF_HEIGHT = 28

// Pulses leave each side in turn; one trip (side → junction → doc) takes PULSE_SECONDS
const PULSE_SECONDS = 3
const PULSE_TIMES = [0, 0.45, 0.85, 1]
const FIRST_PULSE_DELAY = 1.2
// When a pulse reaches the doc, measured from the start of its trip
const ARRIVAL = PULSE_SECONDS * PULSE_TIMES[2]

function Node({
  x,
  y,
  label,
  icon: Icon,
  delay,
}: {
  x: number
  y: number
  label: string
  icon: LucideIcon
  delay: number
}) {
  const loop = useLoop()
  const reduceMotion = useReducedMotion()
  return (
    <motion.g
      initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 18 }}
    >
      {/* Gentle float, out of step between nodes */}
      <motion.g
        {...loop({ y: [0, -3, 0] }, { y: 0 }, { duration: 4, delay: delay * 4, ease: "easeInOut" })}
      >
        <rect
          x={x - NODE_HALF_WIDTH}
          y={y - NODE_HALF_HEIGHT}
          width={NODE_HALF_WIDTH * 2}
          height={NODE_HALF_HEIGHT * 2}
          rx={14}
          className="fill-card stroke-border"
          strokeWidth={1.5}
        />
        <Icon x={x - 11} y={y - 19} size={22} strokeWidth={1.9} className="text-primary" />
        <text
          x={x}
          y={y + 18}
          textAnchor="middle"
          className="fill-muted-foreground text-[9px] font-semibold"
        >
          {label}
        </text>
      </motion.g>
    </motion.g>
  )
}

// A dot that travels from one side along the top tether, then down into the doc.
// Moved with transforms (x/y), not cx/cy attributes.
function Pulse({ fromX, delay }: { fromX: number; delay: number }) {
  const loop = useLoop()
  return (
    <motion.g
      {...loop(
        {
          x: [0, JUNCTION.x - fromX, JUNCTION.x - fromX, JUNCTION.x - fromX],
          y: [0, 0, DOCS.y - NODE_HALF_HEIGHT - JUNCTION.y, DOCS.y - NODE_HALF_HEIGHT - JUNCTION.y],
          opacity: [0, 1, 1, 0],
        },
        { x: (JUNCTION.x - fromX) / 2, y: 0, opacity: 1 },
        { duration: PULSE_SECONDS, delay, times: PULSE_TIMES, ease: "easeInOut" }
      )}
    >
      <circle cx={fromX} cy={JUNCTION.y} r={9} className="fill-primary/25" />
      <circle cx={fromX} cy={JUNCTION.y} r={4.5} className="fill-primary" />
    </motion.g>
  )
}

export function HubIllustration() {
  const loop = useLoop()
  const reduceMotion = useReducedMotion()
  const draw = (delay: number) =>
    reduceMotion
      ? { initial: false as const, animate: { pathLength: 1 } }
      : {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { delay, duration: 0.6, ease: "easeOut" as const },
        }

  const topTether = `M${TASKS.x + NODE_HALF_WIDTH} ${TASKS.y} H${IDE.x - NODE_HALF_WIDTH}`
  const stemTether = `M${JUNCTION.x} ${JUNCTION.y} V${DOCS.y - NODE_HALF_HEIGHT}`
  // Dashes drifting along the tethers: out from the middle on top, downward on the stem
  const flow = loop(
    { strokeDashoffset: [0, -24] },
    { strokeDashoffset: 0 },
    { duration: 1.2, ease: "linear" }
  )

  return (
    <IllustrationFrame label="Tasks and your AI IDE tethered to a Google Docs ledger">
      {/* Soft glow behind the anchor */}
      <motion.circle
        cx={DOCS.x}
        cy={DOCS.y}
        r={48}
        className="fill-primary/10"
        {...loop(
          { scale: [0.85, 1.1, 0.85], opacity: [0.6, 1, 0.6] },
          { scale: 1, opacity: 0.8 },
          { duration: 3 }
        )}
      />

      {/* Tethers */}
      <motion.path
        d={topTether}
        className="stroke-primary/35"
        strokeWidth={3}
        strokeLinecap="round"
        {...draw(0.35)}
      />
      <motion.path
        d={stemTether}
        className="stroke-primary/35"
        strokeWidth={3}
        strokeLinecap="round"
        {...draw(0.75)}
      />
      <motion.g
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.4 }}
      >
        <motion.path
          d={topTether}
          className="stroke-primary/70"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="4 8"
          {...flow}
        />
        <motion.path
          d={stemTether}
          className="stroke-primary/70"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="4 8"
          {...flow}
        />
      </motion.g>

      {/* Junction, with a ring that breathes */}
      <motion.circle
        cx={JUNCTION.x}
        cy={JUNCTION.y}
        r={6}
        className="stroke-primary"
        strokeWidth={1.5}
        {...loop(
          { scale: [1, 2.6], opacity: [0.8, 0] },
          { scale: 1.8, opacity: 0.4 },
          { duration: 1.5, ease: "easeOut" }
        )}
      />
      <circle cx={JUNCTION.x} cy={JUNCTION.y} r={6} className="fill-primary" />

      {/* Work arriving from each side in turn */}
      <Pulse fromX={TASKS.x + NODE_HALF_WIDTH} delay={FIRST_PULSE_DELAY} />
      <Pulse fromX={IDE.x - NODE_HALF_WIDTH} delay={FIRST_PULSE_DELAY + PULSE_SECONDS / 2} />

      <Node {...TASKS} label="Tasks" icon={ListTodo} delay={0} />
      <Node {...IDE} label="AI IDE" icon={TerminalSquare} delay={0.15} />
      <Node {...DOCS} label="Google Docs" icon={FileText} delay={0.3} />

      {/* The doc lights up each time a pulse lands */}
      <motion.rect
        x={DOCS.x - NODE_HALF_WIDTH}
        y={DOCS.y - NODE_HALF_HEIGHT}
        width={NODE_HALF_WIDTH * 2}
        height={NODE_HALF_HEIGHT * 2}
        rx={14}
        className="stroke-primary"
        strokeWidth={2}
        {...loop(
          { scale: [1, 1, 1.18, 1.18], opacity: [0, 0.9, 0, 0] },
          { scale: 1, opacity: 0 },
          {
            duration: PULSE_SECONDS / 2,
            delay: FIRST_PULSE_DELAY + ARRIVAL,
            times: [0, 0.05, 0.55, 1],
            ease: "easeOut",
          }
        )}
      />
    </IllustrationFrame>
  )
}
