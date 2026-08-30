import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProcessedFile } from '../types/tools'

const RESULT_TTL = 10 * 60 * 1000

export interface TemporaryResult extends ProcessedFile {
  url: string
  expiresAt: number
}

export function useTemporaryResult() {
  const [result, setResult] = useState<TemporaryResult | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const resultRef = useRef<TemporaryResult | null>(null)

  const clearResult = useCallback(() => {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current.url)
    }
    resultRef.current = null
    setResult(null)
    setSecondsLeft(0)
  }, [])

  const storeResult = useCallback((file: ProcessedFile) => {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current.url)
    }
    const next: TemporaryResult = {
      ...file,
      url: URL.createObjectURL(file.blob),
      expiresAt: Date.now() + RESULT_TTL,
    }
    resultRef.current = next
    setResult(next)
    setSecondsLeft(Math.ceil(RESULT_TTL / 1000))
  }, [])

  useEffect(() => {
    const tick = window.setInterval(() => {
      const current = resultRef.current
      if (!current) return
      const next = Math.max(0, Math.ceil((current.expiresAt - Date.now()) / 1000))
      setSecondsLeft(next)
      if (next === 0) clearResult()
    }, 1000)

    const handlePageExit = () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url)
    }
    window.addEventListener('pagehide', handlePageExit)
    window.addEventListener('beforeunload', handlePageExit)

    return () => {
      window.clearInterval(tick)
      window.removeEventListener('pagehide', handlePageExit)
      window.removeEventListener('beforeunload', handlePageExit)
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url)
    }
  }, [clearResult])

  return { result, secondsLeft, storeResult, clearResult }
}
