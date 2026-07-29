const MAX_INPUT_BYTES = 10 * 1024 * 1024

/**
 * Reads a picked image File and returns a downscaled JPEG data URL.
 *
 * Reward images are stored inside the database so they travel with JSON
 * backups — downscaling keeps that cheap (a 512px JPEG lands around 40KB,
 * versus several MB for a phone photo).
 */
export function fileToResizedDataURL(file, max = 512, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected'))
    if (!file.type?.startsWith('image/')) return reject(new Error('That file is not an image'))
    if (file.size > MAX_INPUT_BYTES) return reject(new Error('Image is too large — pick one under 10MB'))

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That image could not be opened'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        // Transparent PNGs would otherwise flatten to black once encoded as JPEG.
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)

        try {
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (err) {
          reject(new Error('Could not process that image'))
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
