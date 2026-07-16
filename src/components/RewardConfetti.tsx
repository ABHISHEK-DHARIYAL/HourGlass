/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  velocity: number;
}

const COLORS = ['#e56b55', '#e5c07b', '#98c379', '#61afef', '#c678dd', '#d4af37'];

export default function RewardConfetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    // Generate 100 particles
    const list: Particle[] = [];
    for (let i = 0; i < 100; i++) {
      list.push({
        id: i,
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.65, // burst from lower center
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() * 8 + 4,
        angle: Math.random() * 360,
        velocity: Math.random() * 15 + 8,
      });
    }
    setParticles(list);
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map((p) => {
        const radians = (p.angle * Math.PI) / 180;
        const targetX = Math.cos(radians) * p.velocity * 35;
        const targetY = Math.sin(radians) * p.velocity * 35 + 300; // gravity downward velocity

        return (
          <motion.div
            key={p.id}
            initial={{
              x: p.x,
              y: p.y,
              scale: 1,
              opacity: 1,
              rotate: 0,
            }}
            animate={{
              x: p.x + targetX,
              y: p.y - targetY,
              scale: [1, 1.2, 0],
              opacity: [1, 1, 0],
              rotate: p.angle * 4,
            }}
            transition={{
              duration: Math.random() * 1.5 + 1.2,
              ease: 'easeOut',
            }}
            style={{
              position: 'absolute',
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            }}
          />
        );
      })}

      {/* Center Congratulations Card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.6, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 15, stiffness: 100 }}
          className="bg-ledger-dark/95 border-2 border-ledger-gold px-7 py-5 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-2 max-w-sm text-center mx-4"
        >
          <span className="text-3.5xl animate-bounce">🏆</span>
          <h2 className="font-serif text-base font-bold text-ledger-paper tracking-tight">
            Day Fully Resolved!
          </h2>
          <p className="font-sans text-[10px] text-ledger-gold font-bold uppercase tracking-widest">
            All schedule blocks completed
          </p>
          <p className="font-sans text-xs text-ledger-paper-dim/90 leading-relaxed">
            Superb consistency! Your future self is thanking you for protecting this day.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
