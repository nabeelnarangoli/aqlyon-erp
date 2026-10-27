// Save part of the page as an A4 PDF file (invoice, quotation, work order…).
// The libraries are loaded only when someone presses Download.
export async function downloadPdf(el, filename) {
  if (!el) throw new Error('Nothing to download')
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  document.body.classList.add('pdf-capture')
  try {
    const canvas = await html2canvas(el, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
      ignoreElements: (n) => n.classList?.contains('no-print') || n.classList?.contains('no-pdf') || n.classList?.contains('icon-btn')
    })
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
    const pageW = 210, pageH = 297, margin = 10
    const w = pageW - margin * 2
    const pxPerMm = canvas.width / w
    const sliceH = Math.floor((pageH - margin * 2) * pxPerMm)
    for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
      const h = Math.min(sliceH, canvas.height - y)
      const part = document.createElement('canvas')
      part.width = canvas.width; part.height = h
      const ctx = part.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, part.width, h)
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
      if (page) pdf.addPage()
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, w, h / pxPerMm)
    }
    pdf.save(`${String(filename || 'document').replace(/[^\w.-]+/g, '-')}.pdf`)
  } finally {
    document.body.classList.remove('pdf-capture')
  }
}
