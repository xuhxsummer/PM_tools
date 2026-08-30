import { Check, Download, File, Folder, FolderDown, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { getZipEntryBlob, inspectZip, triggerBlobDownload, type ZipSession } from '../processors/zip'
import type { ToolDefinition } from '../types/tools'
import { FriendlyProcessorError } from '../types/tools'
import { formatCountdown } from '../utils/format'

const ZIP_TTL_SECONDS = 10 * 60

export function ZipToolPage({ tool, onBack }: { tool: ToolDefinition; onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [session, setSession] = useState<ZipSession | null>(null)
  const [state, setState] = useState<'idle' | 'selected' | 'processing' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!session) return
    const expiresAt = Date.now() + ZIP_TTL_SECONDS * 1000
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setSecondsLeft(next)
      if (next === 0) {
        window.clearInterval(timer)
        setSession(null)
        setFile(null)
        setError('解压结果已保存满 10 分钟并自动清理，请重新选择文件。')
        setState('error')
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [session])

  const reset = () => {
    setFile(null)
    setSession(null)
    setError('')
    setSecondsLeft(0)
    setState('idle')
  }

  const chooseFile = (nextFile: File) => {
    reset()
    if (!nextFile.name.toLowerCase().endsWith('.zip')) {
      setError('请选择 ZIP 压缩文件。')
      setState('error')
      return
    }
    if (nextFile.size > 150 * 1024 * 1024) {
      setError('压缩包过大，手机浏览器建议不超过 150 MB。')
      setState('error')
      return
    }
    setFile(nextFile)
    setState('selected')
  }

  const start = async () => {
    if (!file) return
    setState('processing')
    try {
      const nextSession = await inspectZip(file)
      setSecondsLeft(ZIP_TTL_SECONDS)
      setSession(nextSession)
      setState('success')
    } catch (caught) {
      setError(caught instanceof FriendlyProcessorError ? caught.message : '解压失败，请稍后重试。')
      setState('error')
    }
  }

  const downloadEntry = async (path: string, name: string) => {
    if (!session) return
    try {
      triggerBlobDownload(await getZipEntryBlob(session, path), name)
    } catch (caught) {
      setError(caught instanceof FriendlyProcessorError ? caught.message : '文件下载失败。')
    }
  }

  const downloadAll = async () => {
    if (!session) return
    const files = session.entries.filter((entry) => !entry.directory)
    for (const entry of files) {
      const blob = await getZipEntryBlob(session, entry.path)
      triggerBlobDownload(blob, entry.name)
      await new Promise((resolve) => window.setTimeout(resolve, 140))
    }
  }

  return (
    <main className="app-shell tool-page">
      <SuccessCheer active={state === 'success'} />
      <ToolHeader tool={tool} onBack={onBack} />
      <GlassCard className="tool-workspace">
        {state === 'idle' && <FileDropzone tool={tool} onFile={chooseFile} />}
        {(state === 'selected' || (state === 'error' && file)) && file && (
          <>
            <SelectedFileCard file={file} onRemove={reset} />
            {error && <div className="inline-error"><TriangleAlert size={18} /><span>{error}</span></div>}
            <PrimaryButton onClick={start}>开始解压</PrimaryButton>
          </>
        )}
        {state === 'processing' && file && <ProcessingState label="正在读取压缩包" fileName={file.name} />}
        {state === 'success' && session && (
          <div className="zip-result">
            <div className="zip-result-heading">
              <span className="success-mark small"><Check size={23} /></span>
              <div><h2>解压完成</h2><p>{session.entries.filter((entry) => !entry.directory).length} 个文件</p></div>
              <span className="expiry-compact">{formatCountdown(secondsLeft)}</span>
            </div>
            <div className="zip-entry-list">
              {session.entries.map((entry) => (
                <div className="zip-entry" key={entry.path}>
                  <span>{entry.directory ? <Folder size={18} /> : <File size={18} />}</span>
                  <div><strong title={entry.path}>{entry.name}</strong><small>{entry.path}</small></div>
                  {!entry.directory && (
                    <button type="button" onClick={() => downloadEntry(entry.path, entry.name)} aria-label={`下载 ${entry.name}`}>
                      <Download size={17} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {error && <div className="inline-error"><TriangleAlert size={18} /><span>{error}</span></div>}
            <PrimaryButton onClick={downloadAll}><FolderDown size={18} />保存全部文件</PrimaryButton>
            <SecondaryButton onClick={reset}>再解压一个</SecondaryButton>
          </div>
        )}
        {state === 'error' && !file && (
          <div className="error-state">
            <span><TriangleAlert size={28} /></span><h2>暂时无法解压</h2><p>{error}</p>
            <SecondaryButton onClick={reset}>重新选择</SecondaryButton>
          </div>
        )}
      </GlassCard>
      <ToolPrivacyNotice />
    </main>
  )
}
