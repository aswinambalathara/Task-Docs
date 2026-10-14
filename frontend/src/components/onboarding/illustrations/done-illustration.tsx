"use client"

import { motion, useReducedMotion } from "framer-motion"

import { IllustrationFrame, useLoop } from "./shared"

// Step 6: a check mark draws itself, with a burst of confetti around it
const CENTER = { x: 180, y: 118 }
const CONFETTI = [
  "fill-primary",
  "fill-highlight",
  "fill-success",
  "fill-status-progress",
  "fill-primary",
  "fill-highlight",
  "fill-success",
  "fill-status-progress",
  "fill-primary",
  "fill-highlight",
  "fill-success",
  "fill-status-progress",
]

export function DoneIllustration() {
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

  return (
    <IllustrationFrame label="A check mark surrounded by confetti">
      <motion.circle
        cx={CENTER.x}
        cy={CENTER.y}
        r={70}
        className="fill-success/10"
        {...loop({ scale: [0.9, 1.05, 0.9] }, { scale: 1 }, { duration: 3 })}
      />

      {CONFETTI.map((color, index) => {
        const angle = (index / CONFETTI.length) * Math.PI * 2
        const distance = 84 + (index % 3) * 12
        const dx = Math.cos(angle) * distance
        const dy = Math.sin(angle) * distance
        return (
          <motion.rect
            key={index}
            x={CENTER.x - 3}
            y={CENTER.y - 3}
            width={index % 2 ? 6 : 8}
            height={index % 2 ? 6 : 4}
            rx={index % 3 === 0 ? 3 : 1}
            className={color}
            {...loop(
              {
                x: [0, dx * 0.7, dx],
                y: [0, dy * 0.7, dy + 10],
                rotate: [0, 120, 240],
                opacity: [0, 1, 0],
              },
              { x: dx * 0.85, y: dy * 0.85, rotate: 45, opacity: 0.9 },
              { duration: 2.6, delay: 0.7 + (index % 4) * 0.08, ease: "easeOut", repeatDelay: 0.6 }
            )}
          />
        )
      })}

      <circle cx={CENTER.x} cy={CENTER.y} r={44} className="fill-card" />
      <motion.circle
        cx={CENTER.x}
        cy={CENTER.y}
        r={44}
        className="stroke-success"
        strokeWidth={5}
        strokeLinecap="round"
        transform={`rotate(-90 ${CENTER.x} ${CENTER.y})`}
        {...draw(0.1)}
      />
      <motion.path
        d={`M${CENTER.x - 20} ${CENTER.y + 1} L${CENTER.x - 6} ${CENTER.y + 15} L${CENTER.x + 21} ${CENTER.y - 13}`}
        className="stroke-success"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...draw(0.55)}
      />
    </IllustrationFrame>
  )
}
