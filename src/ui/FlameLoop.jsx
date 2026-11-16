// Flame for the Estimator outcome card (changes_for_next 2.2), microgravity style: a small ball of flame, no "up" direction.
// It lives directly inside the main card (no box of its own): a canvas anchored to the right side of the card, with a wide soft orange glow
// that spreads across the card and fades to nothing, so the card itself is lit in proportion to the intensity.
// Canvas particle system: particles are born in a glowing core and drift outward in every direction (additive blending).
// One number (z = log-odds) drives everything and it matches the verdict text:
//   z >= 0  "Flame spreads": ball of flame; intensity k = z / 6 (near 0 it is small and flickers unsteadily, at 6 or more it is big and bright)
//   z < 0   "Flame extinguishes": NO flame, only a dim pulsing ember and a faint glow
// Colours stay yellow-white -> orange (red is reserved for alerts). prefers-reduced-motion draws one still frame.
// The outside-the-training-range warning is the card's dashed border and the "outside training range" chip, not part of this component.
import { useEffect, useRef } from 'react'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const mix = (a, b, t) => Math.round(a + (b - a) * t)
const U = 150 // base length for particle and core sizes (px); the canvas itself is larger

export function flameState(z) {
  return z >= 0 ? 'spreading' : 'none'
}

export default function FlameLoop({ z = 0, outside = false, size = 460, bleed = 130 }) {
  const ref = useRef(null)
  const zRef = useRef(z)
  zRef.current = z
  const state = flameState(z)
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const cv = ref.current
    if (!cv) return undefined
    const ctx = cv.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = Math.round(size * dpr)
    cv.height = Math.round(size * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const C = size / 2
    const rnd = Math.random
    let parts = []
    let acc = 0
    let T = 0
    let raf = 0
    let last = 0

    const info = () => {
      const zz = zRef.current
      return { zz, st: flameState(zz), k: clamp(zz / 6, 0, 1) }
    }

    const spawn = (k) => {
      const a = rnd() * Math.PI * 2
      const r = U * (0.04 + 0.13 * k) * Math.sqrt(rnd()) * 0.9
      const sp = U * (0.03 + 0.1 * k) * (0.4 + rnd())
      parts.push({
        x: C + Math.cos(a) * r,
        y: C + Math.sin(a) * r,
        vx: Math.cos(a) * sp + (rnd() - 0.5) * U * 0.03,
        vy: Math.sin(a) * sp + (rnd() - 0.5) * U * 0.03,
        age: 0,
        life: 0.9 + rnd() * 1.4,
        s: U * (0.05 + 0.07 * rnd()) * (0.6 + 0.7 * k),
      })
    }

    const step = (dt) => {
      const { k, st } = info()
      T += dt
      if (st === 'spreading') {
        acc += dt * (14 + 100 * k)
        while (acc >= 1) { spawn(k); acc -= 1 }
      }
      const drag = 1 - 0.55 * dt
      parts = parts.filter((p) => {
        p.age += dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= drag
        p.vy *= drag
        return p.age < p.life
      })
    }

    const blob = (x, y, r, rgb, a0) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(${rgb},${a0})`)
      g.addColorStop(0.5, `rgba(${rgb},${a0 * 0.4})`)
      g.addColorStop(1, `rgba(${rgb},0)`)
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    const draw = () => {
      const { k, st, zz } = info()
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, size, size)
      ctx.globalCompositeOperation = 'lighter'
      const unsteady = st === 'spreading' && zz < 1.5
      const flick = unsteady ? 0.16 * Math.sin(T * 9) + 0.1 * Math.sin(T * 15.3) : 0.04 * Math.sin(T * 6)

      // wide glow: fades to zero at the canvas edge, so it lights the card without any visible box
      const haloA = st === 'none' ? 0.07 : (0.1 + 0.4 * k) * (1 + flick)
      const hg = ctx.createRadialGradient(C, C, 0, C, C, size * 0.5)
      hg.addColorStop(0, `rgba(255,150,50,${haloA})`)
      hg.addColorStop(0.35, `rgba(255,115,35,${haloA * 0.55})`)
      hg.addColorStop(0.7, `rgba(255,100,30,${haloA * 0.18})`)
      hg.addColorStop(1, 'rgba(255,100,30,0)')
      ctx.fillStyle = hg
      ctx.fillRect(0, 0, size, size)

      for (const p of parts) {
        const u = p.age / p.life
        const a = Math.pow(1 - u, 1.6) * (0.3 + 0.45 * k)
        const rgb = `255,${mix(228, 105, u)},${mix(150, 28, u)}`
        blob(p.x, p.y, p.s * (0.7 + 1.7 * u), rgb, a)
      }

      if (st === 'none') {
        const pulse = 0.5 + 0.5 * Math.sin(T * 2.4)
        blob(C, C, U * 0.07, '255,154,61', 0.3 + 0.3 * pulse)
      } else {
        const R = U * (0.08 + 0.15 * k) * (1 + flick * 0.5)
        blob(C, C, R * 2.1, '255,140,40', 0.55)
        blob(C, C, R * 1.3, '255,214,110', 0.8)
        blob(C, C, R * 0.7, '255,250,225', 0.5 + 0.4 * k)
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    if (reduce) {
      for (let i = 0; i < 45; i += 1) step(0.04)
      draw()
      return undefined
    }

    const loop = (now) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
      last = now
      step(dt)
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // reduced motion: redraw when the score changes; animated mode keeps running and reads z through the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, reduce ? Math.round(z * 2) : 0])

  return (
    <canvas
      ref={ref}
      className={'flame flame-' + state}
      style={{ width: size, height: size, right: -bleed }}
      role="img"
      aria-label={(state === 'spreading' ? 'Flame spreading' : 'No flame') + (outside ? ', outside the training range' : '')}
    />
  )
}
