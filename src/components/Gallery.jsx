import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** full-screen viewer for every file of a version, with ‹ › and arrow keys */
export default function Gallery({ items, start = 0, onClose }) {
  const [i, setI] = useState(start)
  const n = items.length
  const go = (d) => setI((v) => (v + d + n) % n)
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  const f = items[i]
  return (
    <div className="lightbox" onClick={onClose}>
      {f?.type?.startsWith('video/') ? <video src={f.url} controls autoPlay onClick={(e) => e.stopPropagation()} />
        : f?.type?.startsWith('image/') ? <img src={f.url} alt={f.name || ''} onClick={(e) => e.stopPropagation()} />
          : <a className="btn btn-primary" href={f?.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open {f?.name || 'file'}</a>}
      {n > 1 && <>
        <button type="button" className="lb-nav prev" onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="Previous"><ChevronLeft size={26} /></button>
        <button type="button" className="lb-nav next" onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="Next"><ChevronRight size={26} /></button>
      </>}
      <div className="lb-cap" onClick={(e) => e.stopPropagation()}>
        <span>{n > 1 ? `${i + 1} / ${n} · ` : ''}{f?.name || ''}</span>
        {f?.url && <a href={f.url} target="_blank" rel="noreferrer" download={f.name || true}>Open original</a>}
      </div>
    </div>
  )
}
