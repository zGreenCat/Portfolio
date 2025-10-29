'use client'

import { useEffect, useRef, ReactNode } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface LenisProviderProps {
  children: ReactNode
}

export default function LenisProvider({ children }: LenisProviderProps) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    console.log('🎨 Initializing Lenis smooth scroll...')
    
    // Initialize Lenis
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
    })

    lenisRef.current = lenis
    console.log('✅ Lenis initialized')

    // Integrate Lenis with GSAP ScrollTrigger
    lenis.on('scroll', (e) => {
      console.log(`📜 Lenis scroll event - Position: ${e.scroll.toFixed(0)}px, Velocity: ${e.velocity.toFixed(2)}`)
      ScrollTrigger.update()
    })

    // Use GSAP ticker for RAF (don't use both RAF and ticker)
    const tickerHandler = (time: number) => {
      lenis.raf(time * 1000)
    }
    
    gsap.ticker.add(tickerHandler)
    gsap.ticker.lagSmoothing(0)
    
    console.log('✅ Lenis integrated with GSAP')

    return () => {
      console.log('🧹 Destroying Lenis')
      lenis.destroy()
      gsap.ticker.remove(tickerHandler)
    }
  }, [])

  return <>{children}</>
}
