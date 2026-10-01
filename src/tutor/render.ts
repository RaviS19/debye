// Renders the tutor's replies: paragraphs, "- " bullets, **bold**, `code`, $inline$ and $$display$$ maths.
import { tex } from '../components/Eq'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const plain = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')

function inline(s: string, maths: boolean) {
  if (!maths) return plain(s)
  // Split out maths first so its contents are not touched by the other rules.
  return s
    .split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g)
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) return `<span class="eq-block">${tex(part.slice(2, -2), true)}</span>`
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) return tex(part.slice(1, -1))
      return plain(part)
    })
    .join('')
}

/** `maths: false` for the app's own notes and error text, which can quote a server: no KaTeX, so nothing in them
 *  reaches KaTeX's trusted \htmlClass. */
export function renderTutor(text: string, { maths = true } = {}) {
  // Protect display maths that spans lines.
  const t = !maths ? text : text.replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => `$$${m.replace(/\n/g, ' ')}$$`).replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `$$${m.replace(/\n/g, ' ')}$$`).replace(/\\\((.+?)\\\)/g, (_, m: string) => `$${m}$`)
  const blocks = t.split(/\n{2,}/)
  return blocks
    .map((b) => {
      const lines = b.split('\n').filter((l) => l.trim())
      if (!lines.length) return ''
      if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
        const ordered = /^\s*\d/.test(lines[0])
        const items = lines.map((l) => `<li>${inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''), maths)}</li>`).join('')
        return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`
      }
      const heading = lines.length === 1 && /^#{1,4}\s+/.test(lines[0])
      if (heading) return `<p><strong>${inline(lines[0].replace(/^#+\s+/, ''), maths)}</strong></p>`
      return `<p>${lines.map((l) => inline(l, maths)).join('<br/>')}</p>`
    })
    .join('')
}
