// Files in and out of the browser.

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}

export function base64ToBlob(data, mimeType = 'application/octet-stream') {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'attachment'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export const dataUrl = (data, mimeType) => `data:${mimeType};base64,${data}`

export function kindOf(mimeType = '', filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (/sheet|excel|csv/.test(mimeType) || ['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return 'sheet'
  if (/word|document|rtf/.test(mimeType) || ['doc', 'docx', 'pages', 'rtf'].includes(ext)) return 'doc'
  if (/zip|compressed|tar/.test(mimeType) || ['zip', 'rar', '7z', 'gz'].includes(ext)) return 'archive'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

export const extOf = (filename = '') => (filename.includes('.') ? filename.split('.').pop().toUpperCase().slice(0, 4) : 'FILE')
