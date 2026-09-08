import { useEffect } from 'react'
import { createPortal } from 'react-dom'

const STEPS = [
  {
    label: 'Join the tester group',
    href: 'https://groups.google.com/g/tally-time-tracker',
    display: 'groups.google.com/g/tally-time-tracker',
  },
  {
    label: 'Opt into testing',
    href: 'https://play.google.com/apps/testing/name.georgeclinkscales.tally',
    display: 'play.google.com/apps/testing/…',
  },
  {
    label: 'Download on Google Play',
    href: 'https://play.google.com/store/apps/details?id=name.georgeclinkscales.tally',
    display: 'play.google.com/store/apps/…',
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
      <div className="modal-card android-modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="android-modal-icon">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M3 1.8L3 12L12 12Z" fill="#4285F4"/>
            <path d="M3 12L3 22.2L12 12Z" fill="#34A853"/>
            <path d="M3 1.8L12 12L21.5 12Z" fill="#FBBC04"/>
            <path d="M3 22.2L21.5 12L12 12Z" fill="#EA4335"/>
          </svg>
        </div>

        <h2 className="modal-title" style={{ marginBottom: '0.35rem' }}>Join the Android Beta</h2>
        <p className="android-modal-sub">Tally is in open testing on Google Play. Three steps to get access.</p>

        <div className="android-modal-steps">
          {STEPS.map((step, i) => (
            <div key={i} className="android-modal-step">
              <span className="android-modal-step-num">{i + 1}</span>
              <div className="android-modal-step-body">
                <p className="android-modal-step-label">{step.label}</p>
                <a href={step.href} target="_blank" rel="noreferrer" className="android-modal-link">
                  {step.display}
                </a>
              </div>
            </div>
          ))}
        </div>

        <a
          href={STEPS[2].href}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary android-modal-cta"
        >
          Download on Google Play →
        </a>
      </div>
    </div>,
    document.body
  )
}
