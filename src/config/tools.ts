import { Archive, FileOutput, FileText, Images } from 'lucide-react'
import type { ToolDefinition, ToolId } from '../types/tools'

export const tools: ToolDefinition[] = [
  {
    id: 'pdf-to-word',
    name: 'PDF 转 Word',
    description: 'PDF 转换为 DOCX 文档',
    detail: '提取 PDF 中的文字并生成可编辑的 DOCX，复杂版式可能需要手动调整。',
    icon: FileText,
    category: 'document',
    acceptedFileTypes: '.pdf,application/pdf',
    acceptedLabel: 'PDF 文件',
    route: '/tool/pdf-to-word',
    status: 'experimental',
    actionLabel: '开始转换',
    accent: '#ff775f',
  },
  {
    id: 'word-to-pdf',
    name: 'Word 转 PDF',
    description: 'DOCX 转换为 PDF',
    detail: '在浏览器本地读取 DOCX 并生成 PDF，首版适合文字与基础排版文档。',
    icon: FileOutput,
    category: 'document',
    acceptedFileTypes: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    acceptedLabel: 'DOCX 文件',
    route: '/tool/word-to-pdf',
    status: 'experimental',
    actionLabel: '开始转换',
    accent: '#5b8def',
  },
  {
    id: 'image-converter',
    name: '图片格式转换',
    description: '支持 JPG、PNG、WebP',
    detail: '在本地转换常见图片格式，可控制 JPG 与 WebP 的输出质量。',
    icon: Images,
    category: 'image',
    acceptedFileTypes: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    acceptedLabel: 'JPG、PNG 或 WebP 图片',
    route: '/tool/image-converter',
    status: 'stable',
    actionLabel: '开始转换',
    accent: '#49a982',
  },
  {
    id: 'zip-extractor',
    name: 'ZIP 解压',
    description: '浏览并解压 ZIP 压缩文件',
    detail: '读取 ZIP 目录，按需下载单个文件或一次保存全部内容。',
    icon: Archive,
    category: 'archive',
    acceptedFileTypes: '.zip,application/zip,application/x-zip-compressed',
    acceptedLabel: 'ZIP 压缩文件',
    route: '/tool/zip-extractor',
    status: 'stable',
    actionLabel: '开始解压',
    accent: '#a474df',
  },
]

export function getTool(id: ToolId) {
  return tools.find((tool) => tool.id === id)
}
