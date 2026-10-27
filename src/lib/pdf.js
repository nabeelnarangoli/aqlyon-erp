// Save part of the page as an A4 PDF file (invoice, quotation, work order…).
// The libraries are loaded only when someone presses Download.
// Pages break in blank space between lines (never through text), and before any
// element with class "page-break" (e.g. Terms & conditions on a proposal).
export async function downloadPdf(el, filename) {
  if (!el) throw new Error('Nothing to download')
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  document.body.classList.add('pdf-capture')
  try {
    const scale = 2
    const top = el.getBoundingClientRect().top
    const forced = [...el.querySelectorAll('.page-break')].map((n) => Math.round((n.getBoundingClientRect().top - top) * scale)).filter((y) => y > 0)
    const canvas = await html2canvas(el, {
      scale, useCORS: true, backgroundColor: '#ffffff', logging: false,
      ignoreElements: (n) => n.classList?.contains('no-print') || n.classList?.contains('no-pdf') || n.classList?.contains('icon-btn')
    })
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
    const pageW = 210, pageH = 297, margin = 10
    const w = pageW - margin * 2
    const pxPerMm = canvas.width / w
    const maxH = Math.floor((pageH - margin * 2) * pxPerMm)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    // is this pixel row empty (white) across the page?
    const blank = (y) => {
      const d = ctx.getImageData(0, y, canvas.width, 1).data
      for (let i = 0; i < d.length; i += 16) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return false
      return true
    }
    const cuts = []
    for (let y = 0; y < canvas.height;) {
      let end = Math.min(y + maxH, canvas.height)
      const f = forced.find((p) => p > y + 40 && p < end)
      if (f) end = f
      else if (end < canvas.height) {
        // walk up (at most ~20% of a page) to the nearest blank row so text isn't cut in half
        for (let t = end; t > end - maxH * 0.2; t -= 2) if (blank(t) && blank(t - 1)) { end = t; break }
      }
      cuts.push([y, end]); y = end
    }
    cuts.forEach(([y0, y1], i) => {
      const h = y1 - y0
      const part = document.createElement('canvas')
      part.width = canvas.width; part.height = h
      const pc = part.getContext('2d'); pc.fillStyle = '#fff'; pc.fillRect(0, 0, part.width, h)
      pc.drawImage(canvas, 0, y0, canvas.width, h, 0, 0, canvas.width, h)
      if (i) pdf.addPage()
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, w, h / pxPerMm)
    })
    pdf.save(`${String(filename || 'document').replace(/[^\w.-]+/g, '-')}.pdf`)
  } finally {
    document.body.classList.remove('pdf-capture')
  }
}
