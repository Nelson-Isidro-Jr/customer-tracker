// Center-crops an image data URL to a square and scales it to `size` pixels,
// returning a compact JPEG data URL suitable for storing in settings.
export function cropToSquare(dataUrl, size = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      if (!side) { reject(new Error('That image appears to be empty')); return }
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, size, size
      )
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => reject(new Error('That file could not be opened as an image'))
    img.src = dataUrl
  })
}
