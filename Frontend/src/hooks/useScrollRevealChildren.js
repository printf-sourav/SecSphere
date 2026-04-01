import { useEffect, useRef } from 'react'

/**
 * Custom hook that uses Intersection Observer to reveal child elements
 * with staggered delays when the parent enters the viewport.
 * Uses CSS custom property --stagger-delay for smooth GPU-accelerated staggering.
 *
 * @param {string} childSelector - CSS selector for children to animate
 * @param {Object} options
 * @param {number} options.staggerMs - Delay between each child (ms)
 * @param {number} options.threshold - Visibility threshold (0-1)
 */
export default function useScrollRevealChildren(childSelector, { staggerMs = 150, threshold = 0.1 } = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const children = container.querySelectorAll(childSelector)
    children.forEach((child, i) => {
      child.classList.add('scroll-hidden')
      child.style.setProperty('--stagger-delay', `${i * staggerMs}ms`)
    })

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          children.forEach((child) => {
            child.classList.add('scroll-visible')
            child.classList.remove('scroll-hidden')
          })
          observer.unobserve(container)
        }
      },
      { threshold }
    )

    observer.observe(container)

    return () => observer.disconnect()
  }, [childSelector, staggerMs, threshold])

  return ref
}
