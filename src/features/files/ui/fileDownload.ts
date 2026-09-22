function safeFilename(value: string): string {
  const name = Array.from(value).map((character) => character === '\\' || character === '/' || character === ':' || character === '*' || character === '?' || character === '"' || character === '<' || character === '>' || character === '|' || character.charCodeAt(0) === 0 || character === '\r' || character === '\n' ? '_' : character).join('').trim()
  return name && name !== '.' && name !== '..' ? name.slice(0, 255) : 'archivo-privado'
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeFilename(filename)
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
