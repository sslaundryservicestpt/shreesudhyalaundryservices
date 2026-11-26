'use client';

// @refresh reset

import dynamic from 'next/dynamic';

import { Component, useEffect, useRef, useState, type ReactNode, type ErrorInfo } from 'react';

import { ArrowDown, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Leaf, Menu, Pause, Play, Shirt, Sparkles, Truck, Waves, Wind, X, Phone, PackageCheck } from 'lucide-react';

import { company, type BusinessService } from '@/config/company';
import { useViewportLayout } from '@/hooks/useViewportLayout';

import type { CareStage } from './LaundryMachineScene';

import ContactSection from './ContactSection';
import MarketingLogo from './MarketingLogo';
import ServiceCards from './ServiceCards';
import CareDisplay, { LaundryDiorama, SoapBubbles } from './CareDisplay';

import WashBubbles from './WashBubbles';

import showcase from './LaundryShowcase.module.css';

const Scene = dynamic(() => import('./LaundryMachineScene'), { ssr: false, loading: () => <SceneFallback label="Loading the commercial laundry illustration…" /> });

const nav = [['Who we serve', 'services'], ['About us', 'about'], ['How it works', 'process'], ['Gallery', 'gallery']] as const;

const stageLabels: Record<CareStage, string> = { loading: 'Loading business textiles', washing: 'Washing linen and uniforms', drying: 'Drying after the wash', ready: 'Finished and ready for return' };

const journey = [

  { title: 'Plan your service', text: 'Share your site address, textile mix, typical load and preferred collection days.', icon: Phone },

  { title: 'Collect from your site', text: 'Agree on a pickup window and handover point for your linen, towels or uniforms.', icon: Truck },

  { title: 'Wash by textile type', text: 'Washing is matched to the agreed care requirements of your textiles.', icon: Waves },

  { title: 'Dry the load', text: 'Drying prepares your textiles for ironing, folding or packing.', icon: Wind },

  { title: 'Iron and fold', text: 'Your textiles are ironed or folded according to the finish agreed for each item type.', icon: Shirt },

  { title: 'Return to your business', text: 'Finished items are packed for handover at the agreed return location.', icon: PackageCheck },

];

const gallery = [

  { title: 'Folded linen', category: 'Linen care', src: '/images/gallery-linen-care.webp', alt: 'Fresh white linens being folded beside front-loading laundry machines', description: 'A reference view of clean white linens being folded.' },

  { title: 'Stacked textiles', category: 'Folded textiles', src: '/images/gallery-fresh-folds.webp', alt: 'A neatly folded stack of soft neutral and aqua garments held by a person in a pale blue shirt', description: 'A reference view of folded textiles prepared for handover.' },

];

function SceneFallback({ label = 'Commercial laundry cycle' }: { label?: string }) { return <div className="scene-fallback"><div className="fallback-laundry"><GalleryArt /><SoapBubbles staticOnly /></div><span>{label}</span></div>; }

class SceneBoundary extends Component<{children: ReactNode; onFailure: () => void}, {failed: boolean}> {

  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {

    console.error('[Laundry scene error]', error.stack ?? error.message, info.componentStack);
    this.props.onFailure();

  }

  render() { return this.state.failed ? <SceneFallback label="Premium care, with or without 3D" /> : this.props.children; }

}

function GalleryArt() {
  return <div className="gallery-art art-wash" aria-hidden="true"><div className="art-washer"><div className="art-panel"><i /><b>SS</b></div><div className="art-drum"><Waves /></div></div><span className="art-sparkle">✧</span></div>;
}

export default function Experience() {

  const [quoteService, setQuoteService] = useState<BusinessService | ''>('');
  const [menu, setMenu] = useState(false);

  const [active, setActive] = useState('home');

  const [stage, setStage] = useState<CareStage>('loading');
  const [washingBubbles, setWashingBubbles] = useState(false);

  const [paused, setPaused] = useState(false);

  const [visible, setVisible] = useState(true);

  const [reduced, setReduced] = useState(true);

  const [webgl, setWebgl] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  const [step, setStep] = useState(0);

  const [selected, setSelected] = useState<number | null>(null);

  const sceneRef = useRef<HTMLDivElement>(null);

  const progressRef = useRef<HTMLDivElement>(null);

  const dialog = useRef<HTMLDialogElement>(null);

  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {

    const media = matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => setReduced(media.matches);

    update(); media.addEventListener('change', update);

    const canvas = document.createElement('canvas');

    try { const context = canvas.getContext('webgl2') || canvas.getContext('webgl'); setWebgl(Boolean(context)); context?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { setWebgl(false); }

    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .05 });

    if (sceneRef.current) observer.observe(sceneRef.current);

    return () => { media.removeEventListener('change', update); observer.disconnect(); };

  }, []);

  useViewportLayout();
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {

    if (reduced || !('IntersectionObserver' in window) || !('animate' in Element.prototype)) return;

    const animations = new Set<Animation>();

    const targets = [...document.querySelectorAll<HTMLElement>('.values-strip>div, .section-top, .service-card, .about-art, .about-copy, .journey-tabs, .journey-panel, .gallery-card, .contact-copy, .contact-card, .footer-top')];

    const observer = new IntersectionObserver(entries => {

      entries.forEach(entry => {

        if (!entry.isIntersecting) return;

        const element = entry.target as HTMLElement;

        observer.unobserve(element);

        const siblings = element.parentElement ? [...element.parentElement.children] : [];

        const stagger = element.matches('.service-card, .gallery-card, .values-strip>div') ? (siblings.indexOf(element) % 3) * 65 : 0;

        const animation = element.animate([

          { opacity: .45, translate: '0 18px' },

          { opacity: 1, translate: '0 0' },

        ], { duration: 560, delay: stagger, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);

      });

    }, { threshold: .08, rootMargin: '0px 0px -16px 0px' });

    targets.forEach(target => observer.observe(target));

    return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); };

  }, [reduced]);

  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = menu || selected !== null ? 'hidden' : previous; return () => { document.body.style.overflow = previous; }; }, [menu, selected]);

  useEffect(() => {
    if (!menu) return;
    const links = [...document.querySelectorAll<HTMLAnchorElement>('#mobile-nav a')];
    links[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMenu(false); return; }
      if (event.key !== 'Tab') return;
      const items = [menuButton.current, ...links].filter((item): item is HTMLButtonElement | HTMLAnchorElement => item !== null);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      if (menuButton.current?.isConnected) menuButton.current.focus({ preventScroll: true });
    };
  }, [menu]);

  useEffect(() => {

    let frame = 0;

    const update = () => {

      frame = 0;

      const total = document.documentElement.scrollHeight - innerHeight;

      if (progressRef.current) progressRef.current.style.transform = `scaleX(${total > 0 ? scrollY / total : 0})`;

      let currentSection = 'home';
      const anchorLine = (document.querySelector('.header')?.getBoundingClientRect().bottom ?? 0) + 4;
      document.querySelectorAll<HTMLElement>('main > section[id]').forEach(section => {
        if (section.getBoundingClientRect().top <= anchorLine) currentSection = section.id;
      });

      setActive(currentSection);

    };

    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });

    update();

    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };

  }, []);

  useEffect(() => { if (selected !== null && !dialog.current?.open) dialog.current?.showModal(); else if (selected === null && dialog.current?.open) dialog.current.close(); }, [selected]);

  const closeMenu = () => setMenu(false);
  const sceneAvailable = webgl && !reduced && !sceneFailed;
  const scenePlaying = sceneAvailable && visible && pageVisible && !paused;

  return <>

    <div className="scroll-progress" ref={progressRef} aria-hidden="true" />

    <WashBubbles placement="edges" active={washingBubbles && scenePlaying} intense={stage === 'washing'} />

    <a className="skip" href="#main">Skip to content</a>

    <header className="header"><MarketingLogo compact inert={menu} />

      <nav inert={menu} aria-label="Main navigation" className="desktop-nav">{nav.map(([label, id]) => <a className={active === id ? 'active' : ''} aria-current={active === id ? 'location' : undefined} key={id} href={`#${id}`} onClick={() => { if (id === 'process') setStep(0); }}>{label}</a>)}</nav>

      <a className="nav-contact" inert={menu} href="#contact">Request a quote <ArrowUpRight size={16} /></a>

      <button ref={menuButton} className="menu-toggle" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="mobile-nav" aria-label={menu ? 'Close menu' : 'Open menu'}>{menu ? <X /> : <Menu />}</button>

    </header>

    {menu && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation" onKeyDown={event => { if (event.key === 'Escape') { closeMenu(); menuButton.current?.focus(); } }}>{[...nav, ['Contact us', 'contact']].map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => { closeMenu(); if (id === 'process') setStep(0); }}>{label}<ArrowUpRight /></a>)}</nav>}

    <main id="main" inert={menu}>

      <section id="home" className="hero marble" onPointerMove={event => { if (reduced || event.pointerType !== 'mouse') return; const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty('--light-x', `${event.clientX - rect.left}px`); event.currentTarget.style.setProperty('--light-y', `${event.clientY - rect.top}px`); event.currentTarget.style.setProperty('--bubble-parallax', `${((event.clientX - rect.left) / rect.width - .5) * 12}px`); }}>

        <div className="hero-layout">

          <div className="hero-copy"><div className="hero-location">Pickup &amp; delivery in Tirupati</div>

            <h1>Commercial laundry<br />for <span className="fabric-word">your business.</span></h1>

            <p>Linen, towel and uniform care for hotels, hostels, restaurants, salons and workplaces. Plan pickup, finishing and return around your operating schedule.</p>

            <div className="hero-actions"><a className="button primary" href="#contact">Request a business quote <ArrowUpRight size={18} /></a><a className="text-link" href="#services">See who we serve <ArrowRight size={17} /></a></div>

            <div className="hero-note"><span className="note-icon"><Leaf size={21} /></span><span><strong>Plan around your weekly volume.</strong><br />Discuss service days and the finish each item needs.</span></div>

          </div>

          <div className={showcase.panel} ref={sceneRef} data-laundry-part="showcase">

            <div className={showcase.viewport} data-laundry-part="viewport">

              <SceneBoundary onFailure={() => setSceneFailed(true)}>{sceneAvailable ? <Scene playing={scenePlaying} onStage={setStage} onBubbles={setWashingBubbles} /> : <SceneFallback label={reduced ? 'Finished and ready for return' : 'Commercial laundry cycle'} />}</SceneBoundary>

              <WashBubbles active={washingBubbles && scenePlaying} intense={stage === 'washing'} />

            </div>

            <div className={showcase.interface} data-laundry-part="interface">

              <p className={showcase.caption}><span className={showcase.star} aria-hidden="true">✦</span><span>{!sceneAvailable ? 'Finished and ready for return' : stageLabels[stage]}</span></p>

              {sceneAvailable && <div className={showcase.playback}><span><i className={`${showcase.dot} ${paused ? '' : showcase.running}`} /> INTERACTIVE 3D EXPERIENCE</span><button onClick={() => setPaused(!paused)} aria-label={paused ? 'Play animation' : 'Pause animation'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button></div>}

            </div>

          </div>

        </div>

        <div className="hero-bottom"><a href="#services"><span className="scroll-circle"><ArrowDown size={16} /></span>EXPLORE SERVICES</a><span>Linen, towels & uniforms <span className="gold-star">✦</span></span><span className="hero-number">TIRUPATI · ANDHRA PRADESH</span></div>

      </section>

      <div className="values-strip">{[{ icon: Waves, name: 'Recurring loads', detail: 'Plan around your weekly volume' }, {icon: Leaf, name: 'Fabric care', detail: 'Linen, towels and workwear' }, { icon: Shirt, name: 'Ready for use', detail: 'Ironed or folded as agreed' }, {icon: Truck, name: 'Pickup & delivery', detail: 'Discuss windows for your site'}].map(({icon: Icon, name, detail}) => <div key={name}><Icon strokeWidth={1.3} /><span><strong>{name}</strong><small>{detail}</small></span></div>)}</div>

      <section id="services" className="section services-section" aria-labelledby="services-title"><div className="section-top"><div><div className="eyebrow"><span /> INDUSTRIES & SERVICES</div><h2 id="services-title">Laundry that fits <em>your operation.</em></h2></div><div className="section-intro"><p>Commercial laundry for the textiles your team uses every day.</p><span className="availability">Item acceptance and scheduling confirmed when we quote.</span></div></div>

        <ServiceCards onQuote={setQuoteService} />

      </section>

      <section id="about" className="about-section section marble"><div className="about-art"><CareDisplay /></div><div className="about-copy"><div className="eyebrow"><span /> YOUR LOCAL LAUNDRY PARTNER</div><h2>Keep your team<br />focused on <em>service.</em></h2><p>Shree Sudhya Laundry Services handles commercial laundry in Tirupati. We work with businesses that need a regular supply of clean linen, towels and uniforms.</p><p>Tell us how many items you use, how often you need them back and what finish works for your team. Those details help us plan collection, processing and return around your site.</p><div className="about-signature">A plan built around your business.<Sparkles size={24} strokeWidth={1} /></div><a className="text-link" href="#process">See the service process <ArrowRight size={17} /></a></div></section>

      <section id="process" className="process-section section"><div className="section-top"><div><div className="eyebrow"><span /> THE SERVICE PROCESS</div><h2>From collection<br /><em>to clean return.</em></h2></div><p className="section-intro">See what happens at each step. Pickup and return windows are confirmed when we quote.</p></div><div className="journey-tabs" role="tablist" aria-label="Laundry care journey">{journey.map(({title, icon: Icon}, i) => <button role="tab" aria-selected={step === i} aria-controls="journey-panel" id={`journey-tab-${i}`} key={title} onClick={() => setStep(i)} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = (i + (e.key === 'ArrowRight' ? 1 : 5)) % 6; setStep(n); document.getElementById(`journey-tab-${n}`)?.focus(); } }} tabIndex={step === i ? 0 : -1}><span className="step-number">0{i + 1}</span><Icon size={26} strokeWidth={1.3} /><span>{['Service plan', 'Collection', 'Washing', 'Drying', 'Finishing', 'Delivery'][i]}</span></button>)}</div><div className="journey-panel" id="journey-panel" role="tabpanel" aria-labelledby={`journey-tab-${step}`}><div className="journey-illustration" key={step}><LaundryDiorama step={step} /></div><div><span className="service-tag">STEP 0{step + 1} / 06</span><h3>{journey[step].title}</h3><p>{journey[step].text}</p><small>Illustrative process · Details subject to service confirmation</small></div><button className="round-button" aria-label="Next process step" onClick={() => setStep((step + 1) % 6)}><ArrowRight size={21} /></button></div></section>

      <section id="gallery" className="section gallery-section"><div className="section-top"><div><div className="eyebrow"><span /> LAUNDRY GALLERY</div><h2>Linen and textile<br /><em>finishing.</em></h2></div><div className="section-intro"><p>See examples of folded linen and finished textiles.</p><span className="availability">Supplied reference photographs · Illustrative examples</span></div></div><div className="gallery-grid">{gallery.map((item, i) => <button className="gallery-card" key={item.title} onClick={() => setSelected(i)} aria-label={`View photograph: ${item.title}`}><div className="gallery-photo"><img src={item.src} alt={item.alt} width={1366} height={800} loading="lazy" decoding="async" /><span className="gallery-photo-hint">View photograph <ArrowUpRight size={16} /></span></div><div className="gallery-caption"><span><small>{item.category}</small><strong>{item.title}</strong></span><ArrowUpRight size={22} /></div></button>)}</div></section>

      <ContactSection service={quoteService} onServiceChange={setQuoteService} />

    </main>

    <footer inert={menu}><div className="footer-top"><MarketingLogo /><p>Commercial laundry for Tirupati businesses.<br /><a href={`tel:${company.phone}`}>{company.phoneDisplay}</a> · <a href={`tel:${company.alternatePhone}`}>{company.alternatePhoneDisplay}</a><br /><a href={`mailto:${company.email}`}>{company.email}</a><br />{company.address}</p><div className="footer-links">{[...nav, ['Contact us', 'contact']].map(([label, id]) => <a href={`#${id}`} key={id}>{label}</a>)}</div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Shree Sudhya Laundry Services.</span><span>Linen · Towels · Uniforms <span className="gold-star">✦</span></span><a href="#home">Back to top <ArrowUpRight size={14} /></a></div></footer>

    <dialog ref={dialog} className="gallery-dialog" onClose={() => setSelected(null)} onCancel={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }} onKeyDown={e => { if (e.key === 'ArrowRight') setSelected(s => s === null ? 0 : (s + 1) % gallery.length); if (e.key === 'ArrowLeft') setSelected(s => s === null ? 0 : (s + gallery.length - 1) % gallery.length); }} aria-label="Laundry photography gallery">{selected !== null && <><button className="dialog-close round-button" onClick={() => setSelected(null)} aria-label="Close gallery"><X /></button><img className="gallery-full-photo" src={gallery[selected].src} alt={gallery[selected].alt} width={1366} height={800} /><div className="dialog-caption"><button className="round-button" onClick={() => setSelected((selected + gallery.length - 1) % gallery.length)} aria-label="Previous photograph"><ChevronLeft /></button><div><h3>{gallery[selected].title}</h3><p>{gallery[selected].description}</p><small>Supplied reference photograph</small></div><button className="round-button" onClick={() => setSelected((selected + 1) % gallery.length)} aria-label="Next photograph"><ChevronRight /></button></div></>}</dialog>

  </>;

}
