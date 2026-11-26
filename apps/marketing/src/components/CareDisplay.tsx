'use client';
import { useEffect, useState, type PointerEvent } from 'react';
import { ArrowUpRight, Layers3, Shirt, Waves } from 'lucide-react';
import styles from './CareDisplay.module.css';

export function SoapBubbles({ staticOnly = false }: { staticOnly?: boolean }) {
  const [popped, setPopped] = useState<number[]>([]);
  useEffect(() => {
    if (!popped.length) return;
    const timeout = setTimeout(() => setPopped([]), 700);
    return () => clearTimeout(timeout);
  }, [popped]);
  return <div className="soap-garden" aria-label={staticOnly ? undefined : 'Interactive soap bubbles'} aria-hidden={staticOnly || undefined}>
    {[0, 1, 2, 3, 4, 5].map(i => staticOnly ? <span className={`soap-bubble bubble-${i}`} key={i} /> : <button type="button" className={`soap-bubble bubble-${i} ${popped.includes(i) ? 'bubble-popped' : ''}`} key={i} aria-label={`Pop soap bubble ${i + 1}`} onClick={() => setPopped(values => [...new Set([...values, i])])} onAnimationEnd={event => { if (event.animationName === 'soap-pop') setPopped(values => values.filter(value => value !== i)); }}><span /></button>)}
  </div>;
}

export default function CareDisplay() {
  function steer(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - left) / width - .5;
    const y = (event.clientY - top) / height - .5;
    event.currentTarget.style.setProperty('--yaw', `${(x * 9).toFixed(2)}deg`);
    event.currentTarget.style.setProperty('--pitch', `${(-y * 7).toFixed(2)}deg`);
  }
  function reset(event: PointerEvent<HTMLElement>) {
    event.currentTarget.style.removeProperty('--yaw');
    event.currentTarget.style.removeProperty('--pitch');
  }
  return (
    <div className={styles.stage} onPointerMove={steer} onPointerLeave={reset} onPointerCancel={reset}>
      <figure className={styles.frame}>
        <div className={styles.photo}>
          <img src="/images/gallery-linen-care.webp" alt="White linens being folded beside front-loading laundry machines" width={1366} height={800} loading="lazy" decoding="async" />
        </div>
        <figcaption className={styles.caption}>
          <span className={styles.icon} aria-hidden="true"><Layers3 size={20} /></span>
          <div><strong>Commercial linen finishing</strong><small>Reference photography</small></div>
          <a href="#process" aria-label="See the commercial laundry process"><ArrowUpRight size={19} /></a>
        </figcaption>
      </figure>
    </div>
  );
}

export function LaundryDiorama({ step }: { step: number }) {
  return <div className={`laundry-diorama diorama-step-${step}`} aria-hidden="true">
    <span className="diorama-orbit" /><span className="diorama-bubble db-one" /><span className="diorama-bubble db-two" />
    <div className="diorama-basket"><i /><i /><i /></div>
    <div className="diorama-garment"><Shirt strokeWidth={1.1} /></div>
    <div className="diorama-machine"><span /><div className="diorama-door"><Waves strokeWidth={1.3} /></div></div>
    <div className="diorama-folds"><i /><i /><i /></div><div className="diorama-road" />
  </div>;
}
