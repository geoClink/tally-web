import { useEffect, useRef, useState } from 'react'

export function useCountUp(target, duration = 700, ready = true) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!ready) return
    cancelAnimationFrame(rafRef.current)
    const start = performance.now()

    function step(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setValue(eased * target)
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, ready])

  return value
}
