import React from 'react';
import { motion } from 'framer-motion';

/** Continuous gentle floating motion — used on hero art, photo collages & decorative badges. */
export const FloatWrap = ({ children, className = '', distance = 12, duration = 4.5, delay = 0 }) => (
  <motion.div
    className={className}
    animate={{ y: [0, -distance, 0] }}
    transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
  >
    {children}
  </motion.div>
);

export default FloatWrap;
