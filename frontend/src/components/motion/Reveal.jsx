import React from 'react';
import { motion } from 'framer-motion';

/**
 * Scroll-triggered reveal wrapper — fades + slides content into view once,
 * used across Landing / Marketplace / About / Safety pages for "life" on scroll.
 */
export const Reveal = ({ children, delay = 0, y = 28, x = 0, className = '', once = true, ...rest }) => (
  <motion.div
    initial={{ opacity: 0, y, x }}
    whileInView={{ opacity: 1, y: 0, x: 0 }}
    viewport={{ once, amount: 0.2 }}
    transition={{ duration: 0.65, delay, ease: [0.16, 0.77, 0.3, 0.97] }}
    className={className}
    {...rest}
  >
    {children}
  </motion.div>
);

export default Reveal;
