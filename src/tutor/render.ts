// Renders the tutor's replies: paragraphs, "- " bullets, **bold**, `code`, $inline$ and $$display$$ maths.
import { tex } from '../components/Eq'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function inline(s: string) {
  // Split out maths first so its contents are not touched by the other rules.
  return s
    .split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g)
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) return `<span class="eq-block">${tex(part.slice(2, -2), true)}</span>`
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) return tex(part.slice(1, -1))
      return esc(part)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
    })
    .join('')
}

export function renderTutor(text: string) {
  // Protect display maths that spans lines.
  const t = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => `$$${m.replace(/\n/g, ' ')}$$`).replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `$$${m.replace(/\n/g, ' ')}$$`).replace(/\\\((.+?)\\\)/g, (_, m: string) => `$${m}$`)
  const blocks = t.split(/\n{2,}/)
  return blocks
    .map((b) => {
      const lines = b.split('\n').filter((l) => l.trim())
      if (!lines.length) return ''
      if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
        const ordered = /^\s*\d/.test(lines[0])
        const items = lines.map((l) => `<li>${inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>`).join('')
        return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`
      }
      const heading = lines.length === 1 && /^#{1,4}\s+/.test(lines[0])
      if (heading) return `<p><strong>${inline(lines[0].replace(/^#+\s+/, ''))}</strong></p>`
      return `<p>${lines.map(inline).join('<br/>')}</p>`
    })
    .join('')
}
