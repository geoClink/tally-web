import { useEffect } from 'react'
import { createPortal } from 'react-dom'

const STEPS = [
  {
    label: 'Join the tester group',
    href: 'https://groups.google.com/g/tally-time-tracker',
  },
  {
    label: 'Opt into testing',
    href: 'https://play.google.com/apps/testing/name.georgeclinkscales.tally',
  },
  {
    label: 'Download on Google Play',
    href: 'https://play.google.com/store/apps/details?id=name.georgeclinkscales.tally',
  },
]

export default function AndroidModal({ onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="android-modal-card" onClick={e => e.stopPropagation()}>
        <button className="android-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <p className="android-modal-eyebrow">Android · Open Beta</p>
        <h2 className="android-modal-title">Get early access</h2>
        <p className="android-modal-sub">Three quick steps to install Tally on Android.</p>

        <ol className="android-modal-steps">
          {STEPS.map((step, i) => (
            <li key={i} className="android-modal-step">
              <span className="android-modal-step-num">{i + 1}</span>
              <a href={step.href} target="_blank" rel="noreferrer" className="android-modal-step-label">
                {step.label}
              </a>
            </li>
          ))}
        </ol>

        <a
          href={STEPS[2].href}
          target="_blank"
          rel="noreferrer"
          className="android-modal-cta"
        >
          Download on Google Play →
        </a>
      </div>
    </div>,
    document.body
  )
}
