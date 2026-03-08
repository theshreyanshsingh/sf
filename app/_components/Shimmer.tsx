'use client';
import React from 'react';
import { motion } from 'framer-motion';

interface ShimmerProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

const Shimmer: React.FC<ShimmerProps> = ({ width, height, className = '' }) => {
  return (
    <div className={`relative overflow-hidden bg-[#141415] ${className}`} style={{ width, height }}>
      <motion.div
        className="absolute inset-0"
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 1.5,
          ease: 'linear',
          repeat: Infinity,
        }}
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 200, 0.2), transparent)',
        }}
      />
    </div>
  );
};

export default Shimmer;
