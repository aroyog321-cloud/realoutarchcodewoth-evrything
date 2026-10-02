import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

// The pointer, drawn: a dot that sits on it, a ring that follows with a
// little lag and changes with what is underneath (grows on links and buttons,
// becomes a caret over text fields, tightens inside the live demo), and a soft
// glow that trails behind. Mouse only: touch screens and reduced motion keep
// the plain system pointer, and the system pointer is never hidden.

export default function Cursor() {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 420, damping: 34, mass: 0.5 });
  const ringY = useSpring(y, { stiffness: 420, damping: 34, mass: 0.5 });
  const glowX = useSpring(x, { stiffness: 60, damping: 20, mass: 1 });
  const glowY = useSpring(y, { stiffness: 60, damping: 20, mass: 1 });
  const ring = useRef(null);
  const label = useRef(null);
  const scale = useSpring(1, { stiffness: 500, damping: 30 });

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setEnabled(fine.matches && !reduce);
    update();
    fine.addEventListener?.('change', update);
    return () => fine.removeEventListener?.('change', update);
  }, [reduce]);

  useEffect(() => {
    if (!enabled) return undefined;
    let rafId = 0;
    let pendingEvent = null;

    const flush = () => {
      if (!pendingEvent) return;
      const { clientX, clientY, target } = pendingEvent;
      pendingEvent = null;
      x.set(clientX);
      y.set(clientY);
      const el = target instanceof Element ? target : null;
      let state = '';
      let text = '';
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) state = 'text';
      else if (el?.closest('.oa-demo')) state = 'demo';
      else {
        const interactive = el?.closest('a, button, [role="button"], [data-cursor-label], summary, label');
        if (interactive) {
          state = 'link';
          text = interactive.getAttribute('data-cursor-label') || '';
        }
      }
      if (ring.current && ring.current.dataset.state !== state) ring.current.dataset.state = state;
      if (label.current && label.current.textContent !== text) label.current.textContent = text;
    };

    const onMove = event => {
      pendingEvent = event;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          flush();
        });
      }
    };
    const onDown = () => scale.set(0.82);
    const onUp = () => scale.set(1);
    const onLeave = () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      pendingEvent = null;
      x.set(-100);
      y.set(-100);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled, x, y, scale]);

  if (!enabled) return null;
  return <>
    <motion.div className="cursor-glow" style={{ x: glowX, y: glowY }} aria-hidden="true"/>
    <motion.div ref={ring} className="cursor-ring" style={{ x: ringX, y: ringY, scale }} aria-hidden="true">
      <span ref={label} className="cursor-ring__label"/>
    </motion.div>
    <motion.div className="cursor-dot" style={{ x, y }} aria-hidden="true"/>
  </>;
}
