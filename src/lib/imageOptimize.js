// Shrinks images in the browser before they are uploaded, to save storage.
// Designs keep their full resolution and are re-encoded as high-quality WebP,
// which is visually identical for client review but usually 60–80% smaller.
// Anything that would not get meaningfully smaller is uploaded untouched.

const PROFILES = {
  design: { maxSide: 4096, quality: 0.92 },   // proofs: full detail for client review (covers 4K / A3 at 300dpi previews)
  receipt: { maxSide: 2000, quality: 0.8 }     // bills & receipts: readable, small
}
const CAN_OPTIMISE = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']
const MIN_BYTES = 200 * 1024   // smaller files are already cheap to store

export const fmtBytes = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* fall back */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
}

const toBlob = (canvas, type, quality) => new Promise((res) => canvas.toBlob(res, type, quality))

/**
 * @returns {Promise<{ file: File, before: number, after: number, changed: boolean, width?: number, height?: number }>}
 */
export async function optimizeImage(file, profile = 'design') {
  const keep = { file, before: file.size, after: file.size, changed: false }
  if (!file || !CAN_OPTIMISE.includes(file.type) || file.size < MIN_BYTES) return keep
  const { maxSide, quality } = PROFILES[profile] || PROFILES.design
  try {
    const img = await decode(file)
    const w0 = img.width, h0 = img.height
    const scale = Math.min(1, maxSide / Math.max(w0, h0))
    const w = Math.round(w0 * scale), h = Math.round(h0 * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    img.close?.()

    let blob = await toBlob(canvas, 'image/webp', quality)
    // Browsers that can't write WebP (older Safari) hand back PNG: use JPEG for photos, keep PNGs as they are
    if (!blob || blob.type !== 'image/webp') {
      if (file.type !== 'image/jpeg') return keep
      blob = await toBlob(canvas, 'image/jpeg', quality)
    }
    if (!blob || blob.size > file.size * 0.9) return keep   // not worth it
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext
    return { file: new File([blob], name, { type: blob.type, lastModified: Date.now() }), before: file.size, after: blob.size, changed: true, width: w, height: h }
  } catch {
    return keep
  }
}
