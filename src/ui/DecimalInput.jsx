import { useEffect, useState } from 'react'

// Number box that always shows a dot ("0.125", never "0,125") whatever the browser locale is, and accepts a comma when typing.
// type="text" + inputMode="decimal" instead of type="number", so the locale cannot change what is displayed.
// Typing is never clamped. While the draft is partial ("0.", "-") nothing is committed; an empty box commits ''.
// onChange receives '' or a finite number, the same contract the old <input type="number"> handlers had.
const DRAFT = /^-?\d*[.,]?\d*$/
const show = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? '' : String(v))

export default function DecimalInput({ value, onChange, ...rest }) {
  const [txt, setTxt] = useState(show(value))

  // value changed from outside (slider, preset, describe box, reset): follow it, unless it already equals what is typed
  useEffect(() => {
    const t = txt.replace(',', '.').trim()
    const typed = t === '' ? '' : Number(t)
    if (typed !== value && !(Number.isNaN(typed) && (value === '' || value === null || value === undefined))) setTxt(show(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={txt}
      onChange={(e) => {
        const raw = e.target.value
        if (!DRAFT.test(raw)) return // letters and other symbols are ignored
        setTxt(raw.replace(',', '.')) // a comma typed is shown as a dot right away
        if (raw === '') return onChange('')
        const n = Number(raw.replace(',', '.'))
        if (Number.isFinite(n)) onChange(n)
      }}
      onBlur={() => setTxt(show(value))}
    />
  )
}
