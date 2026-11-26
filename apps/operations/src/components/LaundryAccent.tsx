'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
const Motion = dynamic(() => import('./LaundryAccentScene'), { loading: () => <Still /> });
function Still() {
  return (
    <div className="care-still" aria-hidden="true">
      <span>✦</span>
      <svg viewBox="0 0 120 140">
        <rect
          x="15"
          y="8"
          width="90"
          height="120"
          rx="12"
          fill="#faf9f5"
          stroke="#b58b40"
          strokeWidth="2"
        />
        <rect x="25" y="20" width="70" height="14" rx="3" fill="#08253e" />
        <circle cx="60" cy="78" r="29" fill="#08253e" />
        <circle cx="60" cy="78" r="22" fill="#d8eff8" />
        <path d="M40 80Q50 67 60 80T80 80V90Q60 110 40 90Z" fill="#008ed5" />
      </svg>
    </div>
  );
}
export default function LaundryAccent({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null),
    [allowed, setAllowed] = useState(false),
    [visible, setVisible] = useState(false),
    [page, setPage] = useState(true),
    [playing, setPlaying] = useState(true),
    [hidden, setHidden] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce), (max-width: 700px)');
    const update = () => setAllowed(!media.matches);
    update();
    media.addEventListener('change', update);
    const observer = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (ref.current) observer.observe(ref.current);
    const visibility = () => setPage(!document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (!allowed || !visible || !page || !playing) return;
    const timer = setTimeout(() => setPlaying(false), 6000);
    return () => clearTimeout(timer);
  }, [allowed, visible, page, playing]);
  return (
    <div className={`care-accent ${compact ? 'compact' : ''}`} ref={ref}>
      {hidden ? (
        <button className="text-link" onClick={() => setHidden(false)}>
          Show care illustration
        </button>
      ) : (
        <>
          <div
            className="care-art"
            role="img"
            aria-label="A compact washing machine representing thoughtful garment care"
          >
            {allowed && visible && page ? <Motion playing={playing} /> : <Still />}
          </div>
          <div className="care-controls">
            {allowed && (
              <button type="button" onClick={() => setPlaying(!playing)}>
                {playing ? 'Pause motion' : 'Replay motion'}
              </button>
            )}
            <button type="button" onClick={() => setHidden(true)}>
              Hide illustration
            </button>
          </div>
        </>
      )}
    </div>
  );
}
