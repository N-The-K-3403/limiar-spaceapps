import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Cite } from './bits.jsx'

const CITATION_TOKEN = /(\[[A-Za-z0-9_\-, ]+\])/g
const IS_CITATION = /^\[[A-Za-z0-9_\-, ]+\]$/

function remarkCitations() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'link' || node.type === 'linkReference' || !Array.isArray(node.children)) return
      const children = []
      for (const child of node.children) {
        if (child.type !== 'text') {
          visit(child)
          children.push(child)
          continue
        }
        for (const part of child.value.split(CITATION_TOKEN)) {
          if (IS_CITATION.test(part)) {
            children.push({
              type: 'link',
              url: `cite:${encodeURIComponent(part.slice(1, -1))}`,
              children: [{ type: 'text', value: part }],
            })
          } else if (part) {
            children.push({ type: 'text', value: part })
          }
        }
      }
      node.children = children
    }
    visit(tree)
  }
}

export default function MarkdownContent({ text, kb, onCite }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkCitations]}
      urlTransform={(url) => url.startsWith('cite:') ? url : defaultUrlTransform(url)}
      components={{
        a({ href, children, ...props }) {
          const { node, ...attributes } = props
          if (href?.startsWith('cite:')) {
            const ids = decodeURIComponent(href.slice(5)).split(',').map((id) => id.trim()).filter(Boolean)
            return ids.map((id) => <Cite key={id} id={id} kb={kb} onCite={onCite} />)
          }
          return <a href={href} {...attributes} target="_blank" rel="noreferrer">{children}</a>
        },
      }}
    >
      {text}
    </ReactMarkdown>
  )
}
