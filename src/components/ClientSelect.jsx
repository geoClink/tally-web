import { useEffect, useRef, useState } from 'react'

export default function ClientSelect({ clients, value, onChange, placeholder = 'Select or type client' }) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value ?? '')
  const wrapperRef = useRef(null)

  useEffect(() => {
    setInputValue(value ?? '')
  }, [value])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = clients.filter(c =>
    c.toLowerCase().includes(inputValue.toLowerCase())
  )

  function handleInput(e) {
    setInputValue(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  function handleSelect(client) {
    setInputValue(client)
    onChange(client)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="client-dropdown">
          {filtered.map(c => (
            <li
              key={c}
              className="client-dropdown-item"
              onMouseDown={() => handleSelect(c)}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
