import React, { useEffect, useRef, useState } from 'react';
import { useInView, animate } from 'framer-motion';

/** Counts up from 0 to `value` once it scrolls into view — used for live trust stats. */
export const AnimatedCounter = ({ value = 0, duration = 1.4, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  return <span ref={ref} className={className}>{display.toLocaleString()}</span>;
};

export default AnimatedCounter;
