'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface TypingIndicatorProps {
  typingUsers: { userId: number; username: string }[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0].username} pisze`
      : typingUsers.length === 2
        ? `${typingUsers[0].username} i ${typingUsers[1].username} piszą`
        : `${typingUsers[0].username} i ${typingUsers.length - 1} innych pisze`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 28 }}
        exit={{ opacity: 0, height: 0 }}
        className="px-5 flex items-center gap-2.5 overflow-hidden"
      >
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-neon-cyan/70"
              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <span className="text-2xs text-text-dimmed font-medium">{text}...</span>
      </motion.div>
    </AnimatePresence>
  );
}
