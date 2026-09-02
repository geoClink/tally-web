import { useEffect, useState } from 'react'

const CONFETTI_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${5 + (i / 17) * 90}%`,
    delay: `${(i * 0.07).toFixed(2)}s`,
    duration: `${0.9 + (i % 5) * 0.15}s`,
    size: i % 3 === 0 ? 8 : i % 3 === 1 ? 6 : 10,
    isCircle: i % 2 === 0,
  }))

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 'var(--radius)' }}>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '-12px',
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  )
}

export default function StripeConnectedBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Small delay so the animation triggers after paint
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        marginTop: '0.75rem',
        marginBottom: '0.75rem',
        background: 'linear-gradient(135deg, #f0fdf4, #eff6ff)',
        border: '1px solid #86efac',
        borderRadius: 'var(--radius)',
        padding: '1.25rem 1.25rem 1.25rem 1rem',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        overflow: 'hidden',
      }}
    >
      <Confetti />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Animated checkmark */}
        <div style={{ flexShrink: 0 }}>
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle
              cx="22" cy="22" r="19"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeDasharray="120"
              strokeDashoffset={visible ? 0 : 120}
              style={{ transition: 'stroke-dashoffset 0.6s ease 0.2s' }}
            />
            <polyline
              points="13,22 19,29 31,15"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="30"
              strokeDashoffset={visible ? 0 : 30}
              style={{ transition: 'stroke-dashoffset 0.4s ease 0.65s' }}
            />
          </svg>
        </div>

        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: '1rem',
              color: '#15803d',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(4px)',
              transition: 'opacity 0.35s ease 0.5s, transform 0.35s ease 0.5s',
            }}
          >
            Stripe connected!
          </div>
          <div
            style={{
              fontSize: '0.85rem',
              color: '#166534',
              marginTop: '0.2rem',
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.35s ease 0.7s',
            }}
          >
            Go to <strong>Invoices → Save &amp; Send</strong> to send your first invoice with a Pay Now link.
          </div>
        </div>
      </div>
    </div>
  )
}
