// Renders the light text format used for proposals and terms:
// "## Heading", "- bullet", "**bold**", blank line = paragraph break.
const inline = (t) => t.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part))

export default function RichText({ text, className, numbered }) {
  if (!text) return null
  const blocks = []
  let list = null, n = 0
  for (const raw of String(text).split('\n')) {
    const line = raw.trimEnd()
    if (/^\s*[-•]\s+/.test(line)) { (list ||= []).push(line.replace(/^\s*[-•]\s+/, '')); continue }
    if (list) { blocks.push({ t: 'ul', items: list }); list = null }
    if (!line.trim()) continue
    if (line.startsWith('## ')) blocks.push({ t: 'h', text: line.slice(3), n: ++n })
    else blocks.push({ t: 'p', text: line })
  }
  if (list) blocks.push({ t: 'ul', items: list })
  return (
    <div className={`rich ${className || ''}`}>
      {blocks.map((b, i) => b.t === 'h' ? <h4 key={i}>{numbered ? `${b.n}. ` : ''}{inline(b.text)}</h4>
        : b.t === 'ul' ? <ul key={i}>{b.items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>
          : <p key={i}>{inline(b.text)}</p>)}
    </div>
  )
}
