const MAX_RESUME_BYTES = 10 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt'])

function getExtension(file) {
  const name = typeof file?.name === 'string' ? file.name : ''
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

export function validateResumeFile(file) {
  const extension = getExtension(file)

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error('Choose a resume in PDF, DOCX or TXT format.')
  }

  if (!Number.isFinite(file.size) || file.size === 0) {
    throw new Error('This file is empty. Choose a resume that contains content.')
  }

  if (file.size > MAX_RESUME_BYTES) {
    throw new Error('This file is larger than the 10 MB limit. Choose a smaller resume.')
  }

  return extension
}

function normalizeText(text) {
  const normalized = text.replace(/\r\n?/g, '\n').trim()

  if (!normalized) {
    throw new Error('No readable text was found in this file.')
  }

  return normalized
}

async function extractPdfText(file) {
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  })

  try {
    const pdf = await loadingTask.promise
    const pages = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => {
          if (!('str' in item)) return ''
          return `${item.str}${item.hasEOL ? '\n' : ' '}`
        })
        .join('')
      pages.push(pageText)
    }

    return pages.join('\n')
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw new Error(`This PDF could not be read. It may be damaged or password-protected. ${error.message}`)
    }
    throw new Error('This PDF could not be read. It may be damaged or password-protected.')
  } finally {
    await loadingTask.destroy()
  }
}

async function extractDocxText(file) {
  try {
    const mammothModule = await import('mammoth')
    const mammoth = mammothModule.default ?? mammothModule
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw new Error(`This DOCX file could not be read. Check that it is a valid Word document. ${error.message}`)
    }
    throw new Error('This DOCX file could not be read. Check that it is a valid Word document.')
  }
}

export async function extractResumeText(file) {
  const extension = validateResumeFile(file)
  let text

  try {
    if (extension === 'txt') {
      text = await file.text()
    } else if (extension === 'pdf') {
      text = await extractPdfText(file)
    } else {
      text = await extractDocxText(file)
    }
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('The resume could not be read. Try another file.')
  }

  return normalizeText(text)
}
