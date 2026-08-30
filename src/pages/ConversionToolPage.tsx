import { Check, Clock3, Download, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SuccessCheer } from '../components/SuccessCheer'
import {
  FileDropzone,
  GlassCard,
  PrimaryButton,
  ProcessingState,
  SecondaryButton,
  SelectedFileCard,
  ToolHeader,
  ToolPrivacyNotice,
} from '../components/ToolChrome'
import { useTemporaryResult } from '../hooks/useTemporaryResult'
import { processFile } from '../processors'
import type { ToolDefinition } from '../types/tools'
import { FriendlyProcessorError } from '../types/tools'
import { formatBytes, formatCountdown } from '../utils/format'

type PageState = 'idle' | 'file-selected' | 'processing' | 'success' | 'error'

function isAccepted(tool: ToolDefinition, file: File) {
  const name = file.name.toLowerCase()
  if (tool.id === 'pdf-to-word') return name.endsWith('.pdf')
  if (tool.id === 'word-to-pdf') return name.endsWith('.docx') || name.endsWith('.doc')
  if (tool.id === 'image-converter') return /\.(jpe?g|png|webp)$/.test(name)
  return false
}

export function ConversionToolPage({ tool, onBack }: { tool: ToolDefinition; onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [pageState, setPageState] = useState<PageState>('idle')
  const [error, setError] = useState('')
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg')
  const [quality, setQuality] = useState(82)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)
  const { result, secondsLeft, storeResult, clearResult } = useTemporaryResult()

  const processingLabel = tool.id === 'image-converter' ? '正在转换图片' : '正在转换文档'

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  const clearPreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPreviewUrl(null)
  }

  const reset = () => {
    clearResult()
    clearPreview()
    setFile(null)
    setError('')
    setPageState('idle')
  }

  const chooseFile = (nextFile: File) => {
    clearResult()
    clearPreview()
    if (!isAccepted(tool, nextFile)) {
      setFile(null)
      setError(`请选择${tool.acceptedLabel}。`)
      setPageState('error')
      return
    }
    const maxSize = tool.id === 'image-converter' ? 40 * 1024 * 1024 : 80 * 1024 * 1024
    if (nextFile.size > maxSize) {
      setFile(null)
      setError(`文件过大，当前建议不超过 ${formatBytes(maxSize)}。`)
      setPageState('error')
      return
    }
    setError('')
    setFile(nextFile)
    if (nextFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(nextFile)
      previewRef.current = url
      setPreviewUrl(url)
    }
    setPageState('file-selected')
  }

  const start = async () => {
    if (!file) return
    setError('')
    setPageState('processing')
    try {
      const converted = await processFile(tool.id, file, {
        outputFormat,
        quality: quality / 100,
      })
      storeResult(converted)
      setPageState('success')
    } catch (caught) {
      setError(caught instanceof FriendlyProcessorError ? caught.message : '处理失败，请稍后重试。')
      setPageState('error')
    }
  }

  const qualityDisabled = outputFormat === 'png'
  const formatOptions = useMemo(() => [
    { value: 'jpeg' as const, label: 'JPG' },
    { value: 'png' as const, label: 'PNG' },
    { value: 'webp' as const, label: 'WebP' },
  ], [])
  const resultExpired = pageState === 'success' && !result

  return (
    <main className="app-shell tool-page">
      <SuccessCheer active={pageState === 'success'} />
      <ToolHeader tool={tool} onBack={onBack} />

      <GlassCard className="tool-workspace">
        {pageState === 'idle' && <FileDropzone tool={tool} onFile={chooseFile} />}

        {(pageState === 'file-selected' || pageState === 'error') && file && (
          <>
            <SelectedFileCard file={file} previewUrl={previewUrl} onRemove={reset} />
            {tool.id === 'image-converter' && (
              <div className="image-options">
                <div className="option-heading"><strong>输出格式</strong><span>{outputFormat.toUpperCase()}</span></div>
                <div className="segmented-control">
                  {formatOptions.map((format) => (
                    <button
                      type="button"
                      className={outputFormat === format.value ? 'active' : ''}
                      onClick={() => setOutputFormat(format.value)}
                      key={format.value}
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
                <div className={`quality-control ${qualityDisabled ? 'disabled' : ''}`}>
                  <div className="option-heading"><strong>图片质量</strong><span>{qualityDisabled ? '无损' : `${quality}%`}</span></div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={quality}
                    disabled={qualityDisabled}
                    onChange={(event) => setQuality(Number(event.target.value))}
                    aria-label="图片质量"
                  />
                </div>
              </div>
            )}
            {pageState === 'error' && error && <div className="inline-error"><TriangleAlert size={18} /><span>{error}</span></div>}
            <PrimaryButton onClick={start}>{tool.actionLabel}</PrimaryButton>
          </>
        )}

        {pageState === 'processing' && file && <ProcessingState label={processingLabel} fileName={file.name} />}

        {pageState === 'success' && result && (
          <div className="result-state">
            <span className="success-mark"><Check size={34} strokeWidth={2.4} /></span>
            <h2>转换完成</h2>
            <p>结果已经准备好，请在自动清理前下载。</p>
            <div className="result-file">
              <div><strong title={result.name}>{result.name}</strong><span>{formatBytes(result.blob.size)}</span></div>
              {result.details?.map((detail) => <small key={detail}>{detail}</small>)}
            </div>
            <div className="expiry-note"><Clock3 size={15} /> 结果将在 {formatCountdown(secondsLeft)} 后清理</div>
            <PrimaryButton asDownload={{ href: result.url, name: result.name }}><Download size={18} />下载文件</PrimaryButton>
            <SecondaryButton onClick={reset}>再转换一个</SecondaryButton>
          </div>
        )}

        {pageState === 'error' && !file && (
          <div className="error-state">
            <span><TriangleAlert size={28} /></span>
            <h2>暂时无法处理</h2>
            <p>{error}</p>
            <SecondaryButton onClick={reset}>重新选择</SecondaryButton>
          </div>
        )}

        {resultExpired && (
          <div className="error-state">
            <span><TriangleAlert size={28} /></span>
            <h2>结果已自动清理</h2>
            <p>转换结果已保存满 10 分钟，请重新转换。</p>
            <SecondaryButton onClick={reset}>重新选择</SecondaryButton>
          </div>
        )}
      </GlassCard>

      <ToolPrivacyNotice />
    </main>
  )
}
