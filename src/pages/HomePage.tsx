import { ArrowUpRight, LockKeyhole, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { tools } from '../config/tools'
import type { ToolId } from '../types/tools'

export function HomePage({ onSelect }: { onSelect: (id: ToolId) => void }) {
  return (
    <main className="app-shell home-page">
      <header className="home-header">
        <div className="brand-mark"><span /> H5 Tools</div>
        <span className="local-pill"><LockKeyhole size={14} /> Local only</span>
      </header>

      <section className="home-hero">
        <span className="eyebrow"><Sparkles size={15} /> 文件处理，可以更轻一点</span>
        <h1>你的本地<br />文件工具箱</h1>
        <p>简单、快速、安全。文件只在当前设备中处理，不经过服务器。</p>
      </section>

      <section className="tool-grid" aria-label="文件工具列表">
        {tools.map((tool, index) => {
          const Icon = tool.icon
          return (
            <motion.button
              className="tool-card"
              type="button"
              key={tool.id}
              onClick={() => onSelect(tool.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + index * 0.045, duration: 0.28 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="tool-card-icon" style={{ '--tool-accent': tool.accent } as React.CSSProperties}>
                <Icon size={25} />
              </span>
              <span className="tool-card-copy">
                <strong>{tool.name}</strong>
                <small>{tool.description}</small>
              </span>
              <ArrowUpRight className="tool-card-arrow" size={18} />
              {tool.status === 'experimental' && <span className="tool-card-status">实验性</span>}
            </motion.button>
          )
        })}
      </section>

      <footer className="app-footer">
        <p>所有文件均在您的设备本地处理</p>
        <span>隐私安全 · 无需上传 · 无需登录</span>
      </footer>
    </main>
  )
}
