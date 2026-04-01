import { useEffect, useRef } from 'react'

/**
 * Custom hook that uses Intersection Observer to reveal elements on scroll.
 * Returns a ref to attach to the target element.
 *
 * @param {Object} options
 * @param {number} options.threshold - Visibility threshold (0-1) to trigger reveal
 * @param {string} options.rootMargin - Margin around root for early/late triggering
 * @param {'default'|'title'} options.variant - Animation variant ('title' for section headers)
 */
export default function useScrollReveal({ threshold = 0.15, rootMargin = '0px 0px -40px 0px', variant = 'default' } = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const hiddenClass = variant === 'title' ? 'scroll-title-hidden' : 'scroll-hidden'
    const visibleClass = variant === 'title' ? 'scroll-title-visible' : 'scroll-visible'

    // Apply the hidden state immediately
    el.classList.add(hiddenClass)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add(visibleClass)
          el.classList.remove(hiddenClass)
          observer.unobserve(el) // Only animate once
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)

    return () => observer.disconnect()
  }, [threshold, rootMargin, variant])

  return ref
}
