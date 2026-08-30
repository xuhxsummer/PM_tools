import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ProcessOptions, ProcessedFile, ToolId } from '../types/tools'
import { FriendlyProcessorError } from '../types/tools'

function replaceExtension(name: string, extension: string) {
  const base = name.replace(/\.[^.]+$/, '') || '转换结果'
  return `${base}.${extension}`
}

async function convertImage(file: File, options: ProcessOptions): Promise<ProcessedFile> {
  const outputFormat = options.outputFormat ?? 'jpeg'
  const mimeType = `image/${outputFormat}`
  const sourceUrl = URL.createObjectURL(file)

  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = sourceUrl
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { alpha: outputFormat !== 'jpeg' })
    if (!context) throw new FriendlyProcessorError('当前浏览器无法创建图片画布。')

    if (outputFormat === 'jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (nextBlob) => nextBlob ? resolve(nextBlob) : reject(new Error('canvas output failed')),
        mimeType,
        options.quality ?? 0.82,
      )
    })

    canvas.width = 1
    canvas.height = 1
    const extension = outputFormat === 'jpeg' ? 'jpg' : outputFormat
    return {
      blob,
      name: replaceExtension(file.name, extension),
      mimeType,
      details: [`${image.naturalWidth} × ${image.naturalHeight}`, outputFormat.toUpperCase()],
    }
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

async function convertPdfToWord(file: File): Promise<ProcessedFile> {
  const [pdfjs, docx] = await Promise.all([import('pdfjs-dist'), import('docx')])
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const source = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: source }).promise
  const children: InstanceType<typeof docx.Paragraph>[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const lines = content.items
      .filter((item): item is typeof item & { str: string } => 'str' in item)
      .map((item) => item.str.trim())
      .filter(Boolean)

    children.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: `第 ${pageNumber} 页`, bold: true, color: '64748B' })],
      spacing: { before: pageNumber === 1 ? 0 : 280, after: 120 },
    }))
    children.push(new docx.Paragraph({
      children: [new docx.TextRun(lines.join(' '))],
      spacing: { after: 180, line: 360 },
    }))
  }

  const document = new docx.Document({ sections: [{ properties: {}, children }] })
  const blob = await docx.Packer.toBlob(document)
  return {
    blob,
    name: replaceExtension(file.name, 'docx'),
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    details: [`提取 ${pdf.numPages} 页文字`, '基础排版'],
  }
}

function sanitizeDocumentHtml(html: string) {
  const parser = new DOMParser()
  const document = parser.parseFromString(html, 'text/html')
  document.querySelectorAll('script, iframe, object, embed, link, style').forEach((node) => node.remove())
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim().toLowerCase()
      if (name.startsWith('on') || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) {
        element.removeAttribute(attribute.name)
      }
    }
  })
  return document.body.innerHTML
}

async function convertWordToPdf(file: File): Promise<ProcessedFile> {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new FriendlyProcessorError('旧版 .doc 暂不支持，请先在 Word 中另存为 .docx。')
  }

  const [{ default: mammoth }, { default: html2canvas }, { jsPDF }] = await Promise.all([
    import('mammoth'),
    import('html2canvas'),
    import('jspdf'),
  ])
  const source = await file.arrayBuffer()
  const converted = await mammoth.convertToHtml({ arrayBuffer: source })
  const host = document.createElement('article')
  host.className = 'word-render-sandbox'
  host.innerHTML = sanitizeDocumentHtml(converted.value)
  document.body.appendChild(host)

  try {
    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale: Math.min(2, window.devicePixelRatio || 1),
      logging: false,
    })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pageWidth = 190
    const pageHeight = 277
    const renderedHeight = canvas.height * pageWidth / canvas.width
    let remainingHeight = renderedHeight
    let offset = 0
    const image = canvas.toDataURL('image/jpeg', 0.92)

    pdf.addImage(image, 'JPEG', 10, 10, pageWidth, renderedHeight)
    remainingHeight -= pageHeight
    while (remainingHeight > 0) {
      offset = remainingHeight - renderedHeight
      pdf.addPage()
      pdf.addImage(image, 'JPEG', 10, offset + 10, pageWidth, renderedHeight)
      remainingHeight -= pageHeight
    }

    canvas.width = 1
    canvas.height = 1
    return {
      blob: pdf.output('blob'),
      name: replaceExtension(file.name, 'pdf'),
      mimeType: 'application/pdf',
      details: ['A4 页面', converted.messages.length ? '已忽略部分复杂样式' : '基础排版'],
    }
  } finally {
    host.remove()
  }
}

export async function processFile(toolId: ToolId, file: File, options: ProcessOptions) {
  try {
    if (toolId === 'image-converter') return await convertImage(file, options)
    if (toolId === 'pdf-to-word') return await convertPdfToWord(file)
    if (toolId === 'word-to-pdf') return await convertWordToPdf(file)
    throw new FriendlyProcessorError('请选择可转换的工具。')
  } catch (error) {
    console.error(`[${toolId}] processing failed`, error)
    if (error instanceof FriendlyProcessorError) throw error
    if (error instanceof Error && /password/i.test(error.message)) {
      throw new FriendlyProcessorError('文件可能受密码保护，暂时无法处理。')
    }
    throw new FriendlyProcessorError('处理失败，请确认文件未损坏并重试。')
  }
}
