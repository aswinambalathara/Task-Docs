"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"

import { TethrLogo } from "@/components/brand/tethr-logo"

import { IllustrationFrame, useLoop, useSvgId } from "./shared"

// Step 4: you type in your AI IDE, an MCP tool call travels to Tethr, a task appears
const WINDOW = { x: 14, y: 34, width: 200, height: 160 }
const PROMPT_Y = WINDOW.y + 132
const LOGO = { x: 280, y: 52, size: 44 }
const WIRE_Y = LOGO.y + LOGO.size / 2
const WIRE_START = WINDOW.x + WINDOW.width
const WIRE_END = LOGO.x - 4

const TIMES = [0, 0.05, 0.35, 0.42, 0.6, 0.66, 0.92, 1]

export function IdeIllustration() {
  const loop = useLoop()
  const clipId = useSvgId("prompt")

  return (
    <IllustrationFrame label="An AI IDE sending a tool call to Tethr, which creates a task">
      <defs>
        <clipPath id={clipId}>
          <motion.rect
            x={WINDOW.x + 24}
            y={PROMPT_Y - 10}
            height={14}
            {...loop(
              { width: [0, 0, 160, 160, 160, 160, 160, 160] },
              { width: 160 },
              { times: TIMES, ease: "linear" }
            )}
          />
        </clipPath>
      </defs>

      {/* IDE window */}
      <rect
        x={WINDOW.x}
        y={WINDOW.y}
        width={WINDOW.width}
        height={WINDOW.height}
        rx={10}
        className="fill-card stroke-border"
        strokeWidth={1.5}
      />
      <path
        d={`M${WINDOW.x + 10} ${WINDOW.y + 0.75} H${WINDOW.x + WINDOW.width - 10} A9.25 9.25 0 0 1 ${WINDOW.x + WINDOW.width - 0.75} ${WINDOW.y + 10} V${WINDOW.y + 22} H${WINDOW.x + 0.75} V${WINDOW.y + 10} A9.25 9.25 0 0 1 ${WINDOW.x + 10} ${WINDOW.y + 0.75} Z`}
        className="fill-muted"
      />
      <circle cx={WINDOW.x + 14} cy={WINDOW.y + 11} r={3} className="fill-destructive/70" />
      <circle cx={WINDOW.x + 25} cy={WINDOW.y + 11} r={3} className="fill-warning/70" />
      <circle cx={WINDOW.x + 36} cy={WINDOW.y + 11} r={3} className="fill-success/70" />

      {/* Code */}
      {[
        { y: 40, w: 90, c: "fill-primary/40" },
        { y: 54, w: 130, c: "fill-muted-foreground/30" },
        { y: 68, w: 110, c: "fill-muted-foreground/30" },
        { y: 82, w: 70, c: "fill-status-progress/40" },
        { y: 96, w: 120, c: "fill-muted-foreground/30" },
      ].map((line) => (
        <rect
          key={line.y}
          x={WINDOW.x + 14}
          y={WINDOW.y + line.y}
          width={line.w}
          height={6}
          rx={3}
          className={line.c}
        />
      ))}

      {/* Chat prompt, typed out */}
      <rect
        x={WINDOW.x + 8}
        y={PROMPT_Y - 14}
        width={WINDOW.width - 16}
        height={22}
        rx={6}
        className="fill-muted/70 stroke-border"
        strokeWidth={1}
      />
      <text
        x={WINDOW.x + 15}
        y={PROMPT_Y + 1}
        className="fill-primary font-mono text-[10px] font-bold"
      >
        ›
      </text>
      <g clipPath={`url(#${clipId})`}>
        <text x={WINDOW.x + 25} y={PROMPT_Y + 1} className="fill-foreground font-mono text-[8.5px]">
          log: fixed token refresh bug
        </text>
      </g>

      {/* The wire to Tethr and the tool call travelling along it */}
      <path
        d={`M${WIRE_START} ${WIRE_Y} H${WIRE_END}`}
        className="stroke-border"
        strokeWidth={2}
        strokeDasharray="4 4"
      />
      <motion.text
        x={(WIRE_START + WIRE_END) / 2}
        y={WIRE_Y - 9}
        textAnchor="middle"
        className="fill-primary font-mono text-[8px] font-semibold"
        {...loop({ opacity: [0, 0, 0, 1, 1, 1, 1, 0] }, { opacity: 1 }, { times: TIMES })}
      >
        add_task
      </motion.text>
      <motion.circle
        cx={WIRE_START}
        cy={WIRE_Y}
        r={4.5}
        className="fill-primary"
        {...loop(
          {
            x: [
              0,
              0,
              0,
              0,
              WIRE_END - WIRE_START,
              WIRE_END - WIRE_START,
              WIRE_END - WIRE_START,
              WIRE_END - WIRE_START,
            ],
            opacity: [0, 0, 0, 1, 1, 0, 0, 0],
          },
          { x: (WIRE_END - WIRE_START) / 2, opacity: 1 },
          { times: TIMES }
        )}
      />

      <TethrLogo x={LOGO.x} y={LOGO.y} width={LOGO.size} height={LOGO.size} />

      {/* The new task */}
      <motion.g
        {...loop(
          { opacity: [0, 0, 0, 0, 0, 1, 1, 0], y: [10, 10, 10, 10, 10, 0, 0, 0] },
          { opacity: 1, y: 0 },
          { times: TIMES }
        )}
      >
        <rect
          x={250}
          y={118}
          width={104}
          height={46}
          rx={8}
          className="fill-card stroke-primary"
          strokeWidth={1.5}
        />
        <circle cx={264} cy={133} r={7} className="fill-success" />
        <Check x={259} y={128} size={10} strokeWidth={3} className="text-white" />
        <rect x={276} y={129} width={64} height={7} rx={3.5} className="fill-muted-foreground/45" />
        <rect x={262} y={147} width={52} height={6} rx={3} className="fill-muted" />
      </motion.g>
    </IllustrationFrame>
  )
}
