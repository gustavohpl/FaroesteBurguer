import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const REDUCED_MOTION_POSE = 0.12;

export function useScrollAnimation(triggerRef: React.RefObject<HTMLElement>) {
  const progress = useRef(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      progress.current = REDUCED_MOTION_POSE;
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);
    const ticker = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    const st = ScrollTrigger.create({
      trigger: triggerRef.current || undefined,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        progress.current = self.progress;
      },
    });

    return () => {
      st.kill();
      gsap.ticker.remove(ticker);
      lenis.destroy();
    };
  }, [triggerRef]);

  return progress;
}
