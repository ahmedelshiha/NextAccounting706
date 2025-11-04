/**
 * useWorkstationLayout Hook
 * Manages layout state and responsive breakpoint detection for workstation
 */

import { useEffect, useState } from 'react'
import { useWorkstationContext } from '../contexts/WorkstationContext'

// Responsive breakpoints
const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1400
}

type LayoutSize = 'mobile' | 'tablet' | 'desktop'

interface UseWorkstationLayoutReturn {
  /** Current layout size based on viewport width */
  layoutSize: LayoutSize
  /** Whether viewport is mobile (<768px) */
  isMobile: boolean
  /** Whether viewport is tablet (768px-1023px) */
  isTablet: boolean
  /** Whether viewport is desktop (1024px+) */
  isDesktop: boolean
  /** Current window width in pixels */
  windowWidth: number
}

/**
 * Hook to manage workstation layout state and responsiveness
 */
export function useWorkstationLayout(): UseWorkstationLayoutReturn {
  const [layoutSize, setLayoutSize] = useState<LayoutSize>('desktop')
  const [windowWidth, setWindowWidth] = useState(0)
  const [hasWindow, setHasWindow] = useState(false)

  useEffect(() => {
    setHasWindow(true)
    const width = typeof window !== 'undefined' ? window.innerWidth : 0
    setWindowWidth(width)
    updateLayoutSize(width)

    const handleResize = () => {
      const newWidth = window.innerWidth
      setWindowWidth(newWidth)
      updateLayoutSize(newWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const updateLayoutSize = (width: number) => {
    if (width < BREAKPOINTS.MOBILE) {
      setLayoutSize('mobile')
    } else if (width < BREAKPOINTS.DESKTOP) {
      setLayoutSize('tablet')
    } else {
      setLayoutSize('desktop')
    }
  }

  const isMobile = layoutSize === 'mobile'
  const isTablet = layoutSize === 'tablet'
  const isDesktop = layoutSize === 'desktop'

  return {
    layoutSize,
    isMobile,
    isTablet,
    isDesktop,
    windowWidth: hasWindow ? windowWidth : 0
  }
}

/**
 * Hook to toggle sidebar visibility based on layout size
 */
export function useSidebarToggle() {
  const context = useWorkstationContext()
  const { isMobile } = useWorkstationLayout()

  return {
    isOpen: context.sidebarOpen,
    isMobileDrawer: isMobile,
    toggle: () => context.setSidebarOpen(!context.sidebarOpen),
    open: () => context.setSidebarOpen(true),
    close: () => context.setSidebarOpen(false)
  }
}

/**
 * Hook to toggle insights panel visibility based on layout size
 */
export function useInsightsToggle() {
  const context = useWorkstationContext()
  const { isMobile } = useWorkstationLayout()

  return {
    isOpen: context.insightsPanelOpen,
    isHiddenOnMobile: isMobile,
    toggle: () => context.setInsightsPanelOpen(!context.insightsPanelOpen),
    open: () => context.setInsightsPanelOpen(true),
    close: () => context.setInsightsPanelOpen(false)
  }
}
