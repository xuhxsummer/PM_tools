import { ArrowLeft, File, LockKeyhole, RotateCcw, UploadCloud, X } from 'lucide-react'
import { useId, useState, type DragEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { ToolDefinition } from '../types/tools'
import { formatBytes } from '../utils/format'

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass-card ${className}`.trim()}>{children}</section>
}

export function ToolHeader({ tool, onBack }: { tool: ToolDefinition; onBack: () => void }) {
  const Icon = tool.icon
  return (
    <header className="tool-header">
      <button className="icon-button" type="button" onClick={onBack} aria-label="返回工具首页">
        <ArrowLeft size={20} strokeWidth={2} />
      </button>
      <div className="tool-header-copy">
        <span className="tool-header-icon" style={{ '--tool-accent': tool.accent } as React.CSSProperties}>
          <Icon size={22} />
        </span>
        <div>
          <div className="tool-title-line">
            <h1>{tool.name}</h1>
            {tool.status === 'experimental' && <span className="status-badge">实验性</span>}
          </div>
          <p>{tool.detail}</p>
        </div>
      </div>
    </header>
  )
}

export function FileDropzone({
  tool,
  onFile,
}: {
  tool: ToolDefinition
  onFile: (file: File) => void
}) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <label
      htmlFor={inputId}
      className={`file-dropzone ${dragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        id={inputId}
        type="file"
        accept={tool.acceptedFileTypes}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.currentTarget.value = ''
        }}
      />
      <span className="upload-icon"><UploadCloud size={28} /></span>
      <strong>点击选择{tool.acceptedLabel}</strong>
      <span>或将文件拖到这里</span>
      <small><LockKeyhole size={13} /> 文件仅在当前设备中处理</small>
    </label>
  )
}

export function SelectedFileCard({
  file,
  previewUrl,
  onRemove,
}: {
  file: File
  previewUrl?: string | null
  onRemove: () => void
}) {
  return (
    <div className="selected-file-card">
      {previewUrl ? <img src={previewUrl} alt="所选图片预览" /> : <span className="selected-file-icon"><File size={23} /></span>}
      <div className="selected-file-copy">
        <strong title={file.name}>{file.name}</strong>
        <span>{formatBytes(file.size)} · {file.name.split('.').pop()?.toUpperCase() || '文件'}</span>
      </div>
      <button type="button" className="icon-button subtle" onClick={onRemove} aria-label="移除文件">
        <X size={19} />
      </button>
    </div>
  )
}

export function PrimaryButton({ children, disabled, onClick, asDownload }: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
  asDownload?: { href: string; name: string }
}) {
  if (asDownload) {
    return <a className="primary-button" href={asDownload.href} download={asDownload.name}>{children}</a>
  }
  return (
    <motion.button
      type="button"
      className="primary-button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.985 }}
    >
      {children}
    </motion.button>
  )
}

export function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="secondary-button" onClick={onClick}><RotateCcw size={16} />{children}</button>
}

export function ToolPrivacyNotice() {
  return (
    <div className="privacy-notice">
      <LockKeyhole size={15} />
      <span>不会上传服务器。页面关闭或刷新后，当前文件与处理结果会立即清除。</span>
    </div>
  )
}

export function ProcessingState({ label, fileName }: { label: string; fileName: string }) {
  return (
    <div className="processing-state" aria-live="polite">
      <span className="liquid-loader" aria-hidden="true" />
      <strong>{label}</strong>
      <span title={fileName}>{fileName}</span>
      <div className="indeterminate-track"><i /></div>
      <small>正在本地处理，请暂时不要关闭页面</small>
    </div>
  )
}
