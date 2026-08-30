import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { LiquidDropIntro } from './components/intro/LiquidDropIntro'
import { getTool } from './config/tools'
import { ConversionToolPage } from './pages/ConversionToolPage'
import { HomePage } from './pages/HomePage'
import { ZipToolPage } from './pages/ZipToolPage'
import type { ToolId } from './types/tools'

export default function App() {
  const [introVisible, setIntroVisible] = useState(true)
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null)
  const tool = selectedTool ? getTool(selectedTool) : undefined

  return (
    <div className="app-root">
      <AnimatePresence mode="wait">
        {introVisible ? (
          <motion.div key="intro" exit={{ opacity: 0, filter: 'blur(8px)' }} transition={{ duration: 0.32 }}>
            <LiquidDropIntro onEnter={() => setIntroVisible(false)} />
          </motion.div>
        ) : (
          <motion.div
            className="product-surface"
            key={selectedTool ?? 'home'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.24 }}
          >
            <div className="ambient-orb orb-one" aria-hidden="true" />
            <div className="ambient-orb orb-two" aria-hidden="true" />
            {!tool && <HomePage onSelect={setSelectedTool} />}
            {tool && tool.id !== 'zip-extractor' && <ConversionToolPage tool={tool} onBack={() => setSelectedTool(null)} />}
            {tool?.id === 'zip-extractor' && <ZipToolPage tool={tool} onBack={() => setSelectedTool(null)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
