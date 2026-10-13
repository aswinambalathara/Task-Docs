"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

// Decorative full-page background, drawn on one fixed <canvas> behind the page content:
// - Dark theme:  night sky, twinkling stars with an occasional meteor streaking across
// - Light theme: aurora, faded curtains of light that flow and float, with rays sweeping
//   along them and an occasional bright surge racing across a ribbon
//
// Both pause while the tab is hidden, respect prefers-reduced-motion (one still frame), follow
// the theme live (next-themes toggles the `dark` class on <html>) and stay sharp on high-DPI
// screens. Element counts scale with the viewport area.

type RGB = [number, number, number]

interface Scene {
  resize(width: number, height: number): void
  step(dt: number, time: number): void
  draw(ctx: CanvasRenderingContext2D, time: number): void
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function hexToRgb(color: string): RGB | null {
  const hex = color.trim().replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB
}

// --- Dark theme: night sky -----------------------------------------------------------------

// Meteors travel from the upper right toward the lower left
const METEOR_ANGLE = (Math.PI * 3) / 4 + 0.12
const MAX_METEORS = 3
const MIN_SPAWN_MS = 1400
const MAX_SPAWN_MS = 3800

interface Star {
  x: number
  y: number
  radius: number
  baseAlpha: number
  twinklePhase: number
  twinkleSpeed: number
  driftY: number
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  life: number // 1 → 0
  decay: number
  width: number
}

function createNightSky(getAccent: () => RGB): Scene {
  let width = 0
  let height = 0
  let stars: Star[] = []
  let meteors: Meteor[] = []
  let nextSpawnAt = 0

  const spawnMeteor = () => {
    const speed = randomBetween(520, 900) // px per second
    // Start above the top edge or beyond the right edge, so it streaks in from off-screen
    const fromTop = Math.random() < 0.7
    meteors.push({
      x: fromTop ? randomBetween(width * 0.25, width * 1.1) : width + 20,
      y: fromTop ? -20 : randomBetween(-20, height * 0.45),
      vx: Math.cos(METEOR_ANGLE) * speed,
      vy: Math.sin(METEOR_ANGLE) * speed,
      length: randomBetween(90, 190),
      life: 1,
      decay: randomBetween(0.45, 0.8), // per second
      width: randomBetween(1, 1.8),
    })
  }

  const drawMeteor = (ctx: CanvasRenderingContext2D, m: Meteor) => {
    const speed = Math.hypot(m.vx, m.vy)
    const tailX = m.x - (m.vx / speed) * m.length
    const tailY = m.y - (m.vy / speed) * m.length
    const [r, g, b] = getAccent()
    const alpha = m.life * 0.95

    const tail = ctx.createLinearGradient(m.x, m.y, tailX, tailY)
    tail.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    tail.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, ${alpha * 0.55})`)
    tail.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.strokeStyle = tail
    ctx.lineWidth = m.width
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(m.x, m.y)
    ctx.lineTo(tailX, tailY)
    ctx.stroke()

    // Soft glow around the head
    const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 6)
    glow.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    glow.addColorStop(1, "rgba(255, 255, 255, 0)")
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(m.x, m.y, 6, 0, Math.PI * 2)
    ctx.fill()
  }

  return {
    resize(w, h) {
      width = w
      height = h
      meteors = []
      nextSpawnAt = performance.now() + 600
      const count = Math.min(160, Math.round((w * h) / 9000))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: randomBetween(0.35, 1.25),
        baseAlpha: randomBetween(0.25, 0.75),
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: randomBetween(0.6, 1.8),
        driftY: randomBetween(1.5, 5), // px per second, a barely visible upward drift
      }))
    },

    step(dt, time) {
      for (const star of stars) {
        star.y -= star.driftY * dt
        if (star.y < -2) {
          star.y = height + 2
          star.x = Math.random() * width
        }
      }
      if (time >= nextSpawnAt && meteors.length < MAX_METEORS) {
        spawnMeteor()
        nextSpawnAt = time + randomBetween(MIN_SPAWN_MS, MAX_SPAWN_MS)
      }
      meteors = meteors.filter((m) => {
        m.x += m.vx * dt
        m.y += m.vy * dt
        m.life -= m.decay * dt
        return m.life > 0 && m.x > -m.length && m.y < height + m.length
      })
    },

    draw(ctx, time) {
      ctx.fillStyle = "rgb(226, 232, 255)"
      for (const star of stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(star.twinklePhase + (time / 1000) * star.twinkleSpeed)
        ctx.globalAlpha = star.baseAlpha * twinkle
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      for (const m of meteors) drawMeteor(ctx, m)
    },
  }
}

// --- Light theme: aurora ------------------------------------------------------------------

// Drawn at 1/AURORA_SCALE resolution and scaled up: the upscale is the blur that makes the
// curtains soft, and it keeps the per-frame cost tiny
const AURORA_SCALE = 4
// Peak opacity of a curtain's bright edge; it tints the page, never competes with content
const AURORA_ALPHA = 0.4
const STRIP_WIDTH = 2 // low-res px per vertical strip

// Surges: a bright pulse that races along one ribbon every few seconds (the aurora's answer
// to a meteor)
const SURGE_MIN_GAP_MS = 2200
const SURGE_MAX_GAP_MS = 5000
const SURGE_WIDTH = 0.09 // fraction of the screen width
const SURGE_BOOST = 1.8 // extra brightness at the surge's center

interface Ribbon {
  // Colors at the left and right ends; null means the theme's --primary
  from: RGB | null
  to: RGB | null
  baseY: number // vertical position of the bright edge, as a fraction of the height
  amplitude: number // wave height, as a fraction of the height
  thickness: number // curtain height above the edge, as a fraction of the height
  waveFreq: number // waves across the screen
  speed: number // radians per second
  phase: number
}

const RIBBONS: Ribbon[] = [
  { from: null, to: [99, 102, 241], baseY: 0.3, amplitude: 0.07, thickness: 0.22, waveFreq: 1.3, speed: 0.55, phase: 0 },
  { from: [217, 70, 239], to: null, baseY: 0.5, amplitude: 0.09, thickness: 0.18, waveFreq: 1.0, speed: 0.42, phase: 2.4 },
  { from: [56, 189, 248], to: [99, 102, 241], baseY: 0.72, amplitude: 0.06, thickness: 0.16, waveFreq: 1.7, speed: 0.68, phase: 4.1 },
]

interface Surge {
  ribbon: number
  position: number // fraction of the width; travels past both screen edges
  velocity: number // fraction of the width per second; negative runs right to left
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB
}

function createAurora(getAccent: () => RGB): Scene {
  let width = 0
  let height = 0
  let surges: Surge[] = []
  let nextSurgeAt = 0
  const buffer = document.createElement("canvas")
  const bctx = buffer.getContext("2d")

  const spawnSurge = () => {
    const leftToRight = Math.random() < 0.6
    const velocity = randomBetween(0.32, 0.5)
    surges.push({
      ribbon: Math.floor(Math.random() * RIBBONS.length),
      position: leftToRight ? -0.15 : 1.15,
      velocity: leftToRight ? velocity : -velocity,
    })
  }

  return {
    resize(w, h) {
      width = w
      height = h
      buffer.width = Math.max(1, Math.ceil(w / AURORA_SCALE))
      buffer.height = Math.max(1, Math.ceil(h / AURORA_SCALE))
      surges = []
      nextSurgeAt = performance.now() + 1200
    },

    step(dt, time) {
      if (time >= nextSurgeAt) {
        spawnSurge()
        nextSurgeAt = time + randomBetween(SURGE_MIN_GAP_MS, SURGE_MAX_GAP_MS)
      }
      surges = surges.filter((surge) => {
        surge.position += surge.velocity * dt
        return surge.position > -0.2 && surge.position < 1.2
      })
    },

    draw(ctx, time) {
      if (!bctx) return
      const t = time / 1000
      const bw = buffer.width
      const bh = buffer.height
      bctx.clearRect(0, 0, bw, bh)

      RIBBONS.forEach((ribbon, index) => {
        const from = ribbon.from ?? getAccent()
        const to = ribbon.to ?? getAccent()
        const ribbonSurges = surges.filter((surge) => surge.ribbon === index)
        // The whole ribbon floats up and down
        const float = Math.sin(t * 0.35 + ribbon.phase) * 0.045

        for (let x = 0; x < bw; x += STRIP_WIDTH) {
          const u = x / bw // 0..1 across the screen
          const k = u * Math.PI * 2 * ribbon.waveFreq
          // Two waves moving in opposite directions: the curtain flows without repeating
          const wave =
            Math.sin(k + t * ribbon.speed + ribbon.phase) * 0.65 +
            Math.sin(k * 1.9 - t * ribbon.speed * 1.4 + ribbon.phase * 2) * 0.35
          const edgeY = (ribbon.baseY + float + wave * ribbon.amplitude) * bh

          // Rays: fine bright streaks sweeping sideways along the curtain
          const rays = 0.7 + 0.3 * Math.sin(u * 46 - t * 1.7 + ribbon.phase)
          // Broad shimmer, faded out completely toward both screen edges
          const shimmer = 0.6 + 0.4 * Math.sin(k * 2.3 + t * ribbon.speed * 1.6 + ribbon.phase)
          const ends = smoothstep(0, 0.2, u) * smoothstep(1, 0.8, u)

          let surge = 0
          for (const pulse of ribbonSurges) {
            surge += Math.exp(-(((u - pulse.position) / SURGE_WIDTH) ** 2))
          }

          const alpha = Math.min(0.85, AURORA_ALPHA * shimmer * rays * ends * (1 + SURGE_BOOST * surge))
          if (alpha < 0.005) continue

          // A surge also lifts the curtain as it passes
          const curtain =
            ribbon.thickness *
            bh *
            (0.72 + 0.18 * rays + 0.1 * Math.sin(k * 0.8 + t * ribbon.speed) + 0.35 * surge)
          const [r, g, b] = mix(from, to, u)

          // Bright just above the edge, fading upward into the sky; a short fade below it
          const top = edgeY - curtain
          const bottom = edgeY + curtain * 0.18
          const fill = bctx.createLinearGradient(0, top, 0, bottom)
          fill.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
          fill.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${alpha * 0.55})`)
          fill.addColorStop(0.86, `rgba(${r}, ${g}, ${b}, ${alpha})`)
          fill.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
          bctx.fillStyle = fill
          bctx.fillRect(x, top, STRIP_WIDTH, bottom - top)
        }
      })

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(buffer, 0, 0, width, height)
    },
  }
}

// --- Canvas host ---------------------------------------------------------------------------

export function AnimatedBackground({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let width = 0
    let height = 0
    let frame = 0
    let lastTime = 0

    let accent: RGB = [124, 58, 237]
    const getAccent = () => accent
    const nightSky = createNightSky(getAccent)
    const aurora = createAurora(getAccent)
    let scene: Scene = nightSky

    const readTheme = () => {
      const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary")
      accent = hexToRgb(primary) ?? accent
      const next = document.documentElement.classList.contains("dark") ? nightSky : aurora
      if (next !== scene || width === 0) {
        scene = next
        if (width > 0) scene.resize(width, height)
      }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      scene.resize(width, height)
    }

    const tick = (time: number) => {
      // Clamp the step so a stalled frame (tab switch, debugger) doesn't teleport anything
      const dt = Math.min((time - (lastTime || time)) / 1000, 0.05)
      lastTime = time
      scene.step(dt, time)
      ctx.clearRect(0, 0, width, height)
      scene.draw(ctx, time)
      frame = requestAnimationFrame(tick)
    }

    const start = () => {
      cancelAnimationFrame(frame)
      if (reduceMotion.matches) {
        // Still and quiet: one frame, no animation loop
        ctx.clearRect(0, 0, width, height)
        scene.draw(ctx, 0)
        return
      }
      lastTime = 0
      frame = requestAnimationFrame(tick)
    }

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(frame)
      else start()
    }
    const onResize = () => {
      resize()
      if (reduceMotion.matches) start()
    }
    const themeObserver = new MutationObserver(() => {
      readTheme()
      if (reduceMotion.matches) start()
    })

    readTheme()
    resize()
    start()
    window.addEventListener("resize", onResize)
    document.addEventListener("visibilitychange", onVisibility)
    reduceMotion.addEventListener("change", start)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibility)
      reduceMotion.removeEventListener("change", start)
      themeObserver.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 -z-10", className)}
    />
  )
}
