import { useEffect, useState } from 'react'

// Text-based number input: keeps what the user is typing ("0." or "1,5") and commits whenever it parses.
export default function NumField({ value, onCommit, label, unit }) {
  const [txt, setTxt] = useState(String(value))
  useEffect(() => {
    if (parseFloat(String(txt).replace(',', '.')) !== value) setTxt(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <label className="numfield">
      <span>
        {label}
        {unit && <em> {unit}</em>}
      </span>
      <input
        className="nodrag nowheel mono"
        type="text"
        inputMode="decimal"
        value={txt}
        onChange={(e) => {
          setTxt(e.target.value)
          const v = parseFloat(e.target.value.replace(',', '.'))
          if (Number.isFinite(v)) onCommit(v)
        }}
      />
    </label>
  )
}
