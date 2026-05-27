/**
 * AiBubble — always-mounted floating action button.
 *
 * Intentionally minimal: no data subscriptions, no heavy imports.
 * The full AIAssistant panel is mounted lazily by Shell only when aiOpen = true.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useAppStore } from '../../store'
import { useTranslation } from '../../lib/i18n'

export function AiBubble() {
  const aiOpen     = useAppStore((s) => s.aiOpen)
  const toggleAI   = useAppStore((s) => s.toggleAI)
  const language   = useAppStore((s) => s.language)
  const t          = useTranslation(language)

  return (
    <AnimatePresence>
      {!aiOpen && (
        <motion.button
          key="ai-bubble"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={toggleAI}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-accent shadow-elevated flex items-center justify-center hover:bg-blue-400 transition-colors"
          title={t('nav_ai_assistant')}
        >
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
