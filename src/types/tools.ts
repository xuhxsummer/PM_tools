import type { LucideIcon } from 'lucide-react'

export type ToolId = 'pdf-to-word' | 'word-to-pdf' | 'image-converter' | 'zip-extractor'

export type ToolStatus = 'stable' | 'experimental'

export interface ToolDefinition {
  id: ToolId
  name: string
  description: string
  detail: string
  icon: LucideIcon
  category: 'document' | 'image' | 'archive'
  acceptedFileTypes: string
  acceptedLabel: string
  route: string
  status: ToolStatus
  actionLabel: string
  accent: string
}

export interface ProcessOptions {
  outputFormat?: 'jpeg' | 'png' | 'webp'
  quality?: number
}

export interface ProcessedFile {
  blob: Blob
  name: string
  mimeType: string
  details?: string[]
}

export class FriendlyProcessorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FriendlyProcessorError'
  }
}
