import { useEffect, useRef, useState } from 'react'

/**
 * Returns a ref to attach to a sentinel element and a boolean that flips to
 * `true` the first time that element enters the viewport.
 *
 * Once visible the observer disconnects — it never flips back to false.
 * `rootMargin` lets you trigger loading *before* the element is fully visible
 * (e.g. "200px" starts loading when the sentinel is 200 px away from the edge).
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = { rootMargin: '120px', threshold: 0 },
): [React.RefObject<HTMLDivElement>, boolean] {
  const ref       = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // SSR guard (not needed here but good practice)
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()   // fire once — no need to unobserve on unmount
      }
    }, options)

    observer.observe(el)
    return () => observer.disconnect()
    // options object intentionally excluded from deps — treat as mount-time config
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [ref, visible]
}
