'use client';
import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { company, services, type BusinessService } from '@/config/company';
import styles from './ContactSection.module.css';

const pin = encodeURIComponent(company.mapCoordinates);
const locationEmbed = `https://www.google.com/maps?q=${pin}&z=17&output=embed`;
const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${pin}`;

export default function ContactSection({ service, onServiceChange }: {
  service: BusinessService | '';
  onServiceChange: (service: BusinessService | '') => void;
}) {
  const [status, setStatus] = useState('');
  function prepareEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const business = String(data.get('business') ?? '').trim();
    const businessField = form.elements.namedItem('business') as HTMLInputElement;
    const name = String(data.get('name') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    const nameField = form.elements.namedItem('name') as HTMLInputElement;
    const messageField = form.elements.namedItem('message') as HTMLTextAreaElement;
    const phoneField = form.elements.namedItem('phone') as HTMLInputElement;
    const digits = phone.replace(/\D/g, '');
    phoneField.setCustomValidity(digits.length >= 10 && digits.length <= 15 ? '' : 'Enter a valid phone number with 10 to 15 digits.');
    businessField.setCustomValidity(business ? '' : 'Enter your business name.');
    nameField.setCustomValidity(name ? '' : 'Please enter your name.');
    messageField.setCustomValidity(message ? '' : 'Please tell us what you need.');
    if (!form.reportValidity()) return;
    const email = String(data.get('email') ?? '').trim();
    const text = ['Hello Shree Sudhya Laundry Services, I’d like a commercial laundry quote.', '', `Business: ${business}`, `Name: ${name}`, `Phone: ${phone}`, ...(email ? [`Email: ${email}`] : []), `Service: ${service || 'General commercial laundry'}`, '', message].join('\n');
    const target = new URL(`https://wa.me/${company.whatsapp}`);
    target.searchParams.set('text', text);
    setStatus('Your quote request is ready. Review it in WhatsApp and tap Send.');
    window.location.assign(target.toString());
  }
  return <section id="contact" className={styles.section} aria-labelledby="contact-title">
    <div className={styles.heading}><div><p className={styles.eyebrow}>COMMERCIAL LAUNDRY QUOTES</p><h2 id="contact-title">Get a quote for <em>your business.</em></h2></div><p>Share your textile types, approximate weekly volume and preferred collection days.</p></div>
    <div className={styles.details} aria-label="Contact details">
      <a href={`tel:${company.phone}`}><Phone size={20} /><span><small>Call us</small><strong>{company.phoneDisplay}</strong></span><ArrowUpRight size={16} /></a>
      <a href={`tel:${company.alternatePhone}`}><Phone size={20} /><span><small>Alternate phone</small><strong>{company.alternatePhoneDisplay}</strong></span><ArrowUpRight size={16} /></a>
      <a href={`mailto:${company.email}`}><Mail size={20} /><span><small>Email us</small><strong>{company.email}</strong></span><ArrowUpRight size={16} /></a>
    </div>
    <div className={styles.columns}>
      <form className={styles.form} onSubmit={prepareEnquiry}>
        <div className={styles.cardHeading}><span className={styles.icon}><MessageCircle size={22} /></span><div><h3>Tell us what you need</h3><p>Prepare a quote request to send on WhatsApp.</p></div></div>
        <div className={styles.fields}>
          <label>Business name <span aria-hidden="true">*</span><input name="business" autoComplete="organization" required maxLength={120} placeholder="Your company or property" onInput={event => event.currentTarget.setCustomValidity('')} /></label>
          <label>Your name <span aria-hidden="true">*</span><input name="name" autoComplete="name" required maxLength={80} placeholder="Enter your name" onInput={event => event.currentTarget.setCustomValidity('')} /></label>
          <label>Phone number <span aria-hidden="true">*</span><input name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={20} title="Enter a phone number with 10 to 20 characters, using digits, spaces or +." placeholder="Your contact number" onInput={event => event.currentTarget.setCustomValidity('')} /></label>
          <label>Email <small>(optional)</small><input name="email" type="email" autoComplete="email" maxLength={120} placeholder="you@example.com" /></label>
          <label className={styles.serviceField}>Service or industry<select name="service" value={service} onChange={event => onServiceChange(services.find(item => item.name === event.target.value)?.name ?? '')}><option value="">General commercial laundry</option>{services.map(item => <option key={item.name}>{item.name}</option>)}</select></label>
          <label className={styles.full}>Laundry requirements <span aria-hidden="true">*</span><textarea name="message" required rows={3} maxLength={1500} placeholder="Site area, textile types, approximate pieces or kg per week, and preferred pickup days." onInput={event => event.currentTarget.setCustomValidity('')} /></label>
        </div>
        <button type="submit" className={styles.submit}>Continue in WhatsApp <Send size={17} /></button>
        <p className={styles.notice}>* Required. Review and send in WhatsApp. No details are stored by this form.</p>
        <p className={styles.status} role="status">{status}</p>
      </form>
      <aside className={styles.location} aria-labelledby="location-title">
        <div className={styles.cardHeading}><span className={styles.icon}><MapPin size={22} /></span><div><h3 id="location-title">Find us in Tirupati</h3><p>Business location · Andhra Pradesh</p></div></div>
        <div className={styles.mapFrame}>
          <iframe
            src={locationEmbed}
            title="Google Maps showing the Shree Sudhya Laundry Services location"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <div className={styles.mapActions}>
          <a className={styles.directions} href={company.mapUrl} target="_blank" rel="noopener noreferrer">Open Google Maps <ArrowUpRight size={16} /></a>
          <a className={styles.directions} href={directionsLink} target="_blank" rel="noopener noreferrer"><MapPin size={16} /> Get directions</a>
        </div>
        <a className={styles.whatsapp} href={company.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Chat with our team on WhatsApp</a>
      </aside>
    </div>
  </section>;
}
