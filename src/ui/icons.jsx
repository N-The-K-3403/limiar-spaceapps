// Small inline icon set (24x24, stroke = currentColor). No dependency; add a name here to use it everywhere.
const P = {
  flame: ['M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.5.6-2.6 1.4-3.5.4 1 1 1.5 1.6 1.5 0-3 .2-5 1-8z'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z'],
  mars: ['M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M9 10h.01M14.5 13.5h.01M10.5 15.5h.01'],
  earth: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c3 3 3 15 0 18', 'M12 3c-3 3-3 15 0 18'],
  micro: ['M12 12h.01', 'M3 12c0-3 4-5 9-5s9 2 9 5-4 5-9 5-9-2-9-5z', 'M17 5.5l.01 0'],
  wind: ['M3 8h10a3 3 0 1 0-3-3', 'M3 12h14a3 3 0 1 1-3 3', 'M3 16h7'],
  gauge: ['M4 18a8 8 0 1 1 16 0', 'M12 18l4-6'],
  layers: ['M12 3l9 5-9 5-9-5 9-5z', 'M3 13l9 5 9-5'],
  drop: ['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z'],
  flask: ['M9 3h6', 'M10 3v6l-5.5 9.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3'],
  scatter: ['M5 4v15h15', 'M9 15h.01M13 9h.01M17 13h.01M11 12h.01'],
  book: ['M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z', 'M5 17a3 3 0 0 1 3-3h10'],
  map: ['M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z', 'M9 4v14', 'M15 6v14'],
  nodes: ['M4 4h6v6H4z', 'M14 14h6v6h-6z', 'M10 7h3a2 2 0 0 1 2 2v5'],
  chip: ['M7 7h10v10H7z', 'M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12M18 6L6 18'],
  tilde: ['M4 13c3-5 5 5 8 0s5 5 8 0'],
  help: ['M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7', 'M12 17h.01'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8h.01'],
  warn: ['M12 4l9 16H3L12 4z', 'M12 10v4', 'M12 17h.01'],
  undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
  download: ['M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14'],
  reset: ['M4 12a8 8 0 1 0 3-6.2', 'M4 4v5h5'],
  sparkle: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z'],
  chat: ['M4 5h16v11H9l-5 4V5z'],
  list: ['M8 6h12M8 12h12M8 18h12', 'M4 6h.01M4 12h.01M4 18h.01'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  edit: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13 7l4 4'],
}

export default function Icon({ name, size = 16, className = '', title }) {
  const d = P[name]
  if (!d) return null
  return (
    <svg
      className={'ic ' + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  )
}

export const TAB_ICON = {
  planner: 'flask',
  evidence: 'scatter',
  estimator: 'gauge',
  library: 'book',
  gaps: 'map',
  workbench: 'nodes',
  models: 'chip',
  sources: 'link',
  ai: 'chat',
}
