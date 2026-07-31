import { useState, useRef } from 'react';
import './Carousel3D.css';

const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function Carousel3D({ items, cardWidth = 220, sceneHeight = 520, label, className, flat = false }) {
  const [active, setActive] = useState(0);
  const dragX = useRef(null);
  const didDrag = useRef(false);
  const totalRotation = useRef(0);
  const n = items.length;
  const angleStep = 360 / n;
  const radius = Math.round((cardWidth + 48) / (2 * Math.tan(Math.PI / n)));

  const go = (delta) => {
    totalRotation.current -= delta * angleStep;
    setActive(a => (a + delta + n) % n);
  };

  const handlePointerDown = (e) => {
    dragX.current = e.clientX;
    didDrag.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (dragX.current === null) return;
    if (Math.abs(e.clientX - dragX.current) > 8) didDrag.current = true;
  };

  const handlePointerUp = (e) => {
    if (dragX.current === null) return;
    const d = e.clientX - dragX.current;
    if (Math.abs(d) > 40) go(d < 0 ? 1 : -1);
    dragX.current = null;
  };

  const Controls = () => (
    <div className="c3d-controls">
      <button className="c3d-btn" onClick={() => go(-1)} aria-label="Previous"><ChevronLeft /></button>
      <div className="c3d-dots">
        {items.map((_, i) => (
          <button
            key={i}
            className={`c3d-dot${i === active ? ' c3d-dot--active' : ''}`}
            onClick={() => {
              const off = ((i - active) % n + n) % n;
              go(off > n / 2 ? off - n : off);
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
      <button className="c3d-btn" onClick={() => go(1)} aria-label="Next"><ChevronRight /></button>
    </div>
  );

  if (flat) {
    return (
      <div className={`c3d-wrapper${className ? ` ${className}` : ''}`}>
        {label && <p className="c3d-label">{label}</p>}
        <div
          className="c3d-flat"
          style={{ '--card-w': `${cardWidth}px`, '--scene-h': `${sceneHeight}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {items.map((item, i) => (
            <div
              key={item.src}
              className={`c3d-flat-card${i === active ? ' c3d-flat-card--active' : ''}`}
            >
              <img src={item.src} alt={item.alt} draggable={false} loading="lazy" />
            </div>
          ))}
        </div>
        <Controls />
      </div>
    );
  }

  return (
    <div
      className={`c3d-wrapper${className ? ` ${className}` : ''}`}
      style={{ '--card-w': `${cardWidth}px`, '--scene-h': `${sceneHeight}px` }}
    >
      {label && <p className="c3d-label">{label}</p>}

      <div className="c3d-clip">
        <div
          className="c3d-scene"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className="c3d-stage"
            style={{ transform: `rotateY(${totalRotation.current}deg)` }}
          >
            {items.map((item, i) => {
              const off = ((i - active) % n + n) % n;
              const shortest = off > n / 2 ? off - n : off;
              return (
                <div
                  key={item.src}
                  className={`c3d-card${i === active ? ' c3d-card--active' : ''}`}
                  style={{ transform: `rotateY(${i * angleStep}deg) translateZ(${radius}px)` }}
                  onClick={() => { if (!didDrag.current) go(shortest); }}
                >
                  <div className="c3d-card-inner">
                    <img src={item.src} alt={item.alt} draggable={false} loading="lazy" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Controls />
    </div>
  );
}
