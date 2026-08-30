import JSZip from 'jszip'
import { FriendlyProcessorError } from '../types/tools'

export interface ZipEntryInfo {
  path: string
  name: string
  directory: boolean
}

export interface ZipSession {
  archive: JSZip
  entries: ZipEntryInfo[]
}

export async function inspectZip(file: File): Promise<ZipSession> {
  try {
    const archive = await JSZip.loadAsync(await file.arrayBuffer())
    const entries = Object.values(archive.files)
      .map((entry) => ({
        path: entry.name,
        name: entry.name.split('/').filter(Boolean).pop() || entry.name,
        directory: entry.dir,
      }))
      .sort((left, right) => Number(right.directory) - Number(left.directory) || left.path.localeCompare(right.path))

    if (!entries.length) throw new FriendlyProcessorError('这个 ZIP 压缩包中没有可读取的文件。')
    return { archive, entries }
  } catch (error) {
    console.error('[zip-extractor] inspect failed', error)
    if (error instanceof FriendlyProcessorError) throw error
    if (error instanceof Error && /password|encrypted/i.test(error.message)) {
      throw new FriendlyProcessorError('该 ZIP 可能设置了密码，当前版本暂时无法解压。')
    }
    throw new FriendlyProcessorError('无法读取该 ZIP，请确认文件未损坏。')
  }
}

export async function getZipEntryBlob(session: ZipSession, path: string) {
  const entry = session.archive.file(path)
  if (!entry) throw new FriendlyProcessorError('没有找到这个文件，可能已经被清理。')
  return entry.async('blob')
}

export function triggerBlobDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
