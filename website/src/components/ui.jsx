import React, { useCallback, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { Link } from '../lib/router.jsx';

export const EASE = [0.16, 1, 0.3, 1];

// Enter on scroll: content rises into place the first time it is seen.
export function Reveal({ children, delay = 0, y = 24, className = '', as = 'div', amount = 0.05 }) {
  const reduce = useReducedMotion();
  const Tag = motion[as] || motion.div;
  return <Tag
    className={className}
    initial={reduce ? false : { opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount }}
    transition={{ duration: 0.8, delay, ease: EASE }}
  >{children}</Tag>;
}

// Stagger a list of children in.
export function Stagger({ children, className = '', gap = 0.07, amount = 0.2 }) {
  const reduce = useReducedMotion();
  return <motion.div
    className={className}
    initial={reduce ? false : 'hidden'}
    whileInView="shown"
    viewport={{ once: true, amount }}
    variants={{ hidden: {}, shown: { transition: { staggerChildren: gap } } }}
  >{children}</motion.div>;
}

export const staggerItem = {
  hidden: { opacity: 0, y: 22 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

// Sets --mx/--my on the element so .spotlight can light the border under the pointer.
export function useSpotlight() {
  return useCallback(event => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    target.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }, []);
}

// Pulls toward the pointer a little while it is over the element.
export function Magnetic({ children, strength = 0.28, className = '' }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });
  const ref = useRef(null);
  if (reduce) return <span className={`inline-flex ${className}`}>{children}</span>;
  return <motion.span
    ref={ref}
    className={`inline-flex ${className}`}
    style={{ x: springX, y: springY }}
    onPointerMove={event => {
      if (event.pointerType !== 'mouse') return;
      const rect = ref.current.getBoundingClientRect();
      x.set((event.clientX - rect.left - rect.width / 2) * strength);
      y.set((event.clientY - rect.top - rect.height / 2) * strength);
    }}
    onPointerLeave={() => { x.set(0); y.set(0); }}
  >{children}</motion.span>;
}

// One button for the whole site. `to` makes an in-site link, `href` a plain
// link, neither a <button>. `cursor` labels the cursor ring while hovering.
export function Button({ to, href, variant = 'primary', size, magnetic = true, cursor, className = '', children, ...rest }) {
  const classes = `btn btn--${variant}${size ? ` btn--${size}` : ''} ${className}`;
  const data = cursor ? { 'data-cursor-label': cursor } : {};
  let element;
  if (to) element = <Link to={to} className={classes} {...data} {...rest}>{children}</Link>;
  else if (href) element = <a href={href} className={classes} {...data} {...rest}>{children}</a>;
  else element = <button type="button" className={classes} {...data} {...rest}>{children}</button>;
  return magnetic ? <Magnetic>{element}</Magnetic> : element;
}

export function SectionTitle({ kicker, title, lede, align = 'left', className = '' }) {
  const center = align === 'center';
  return <div className={`${center ? 'mx-auto text-center' : ''} max-w-3xl ${className}`}>
    {kicker ? <Reveal><p className="kicker mb-4">{kicker}</p></Reveal> : null}
    <Reveal delay={0.05}><h2 className="display text-[clamp(2rem,4.4vw,3.4rem)]">{title}</h2></Reveal>
    {lede ? <Reveal delay={0.12}><p className={`lede mt-5 text-[17px] ${center ? 'mx-auto' : ''}`}>{lede}</p></Reveal> : null}
  </div>;
}
