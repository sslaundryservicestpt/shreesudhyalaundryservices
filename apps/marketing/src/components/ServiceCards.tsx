import { ArrowUpRight, Leaf, Shirt, Sparkles, Truck, Waves, Wind } from 'lucide-react';
import { services, type BusinessService } from '@/config/company';

const icons = { wash: Waves, shirt: Shirt, sparkle: Sparkles, wind: Wind, leaf: Leaf, truck: Truck };

export default function ServiceCards({ onQuote }: { onQuote: (service: BusinessService) => void }) {
  return (
    <div className="service-grid">
      {services.map(({ name, detail, description, icon, tag }, index) => {
        const Icon = icons[icon];
        return (
          <article className="service-card" key={name}>
            <div className="service-card-top">
              <span className="service-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.4} /></span>
              <span className="service-tag">{tag}</span>
              <span className="service-no" aria-hidden="true">0{index + 1}</span>
            </div>
            <h3>{name}</h3>
            <p>{detail}</p>
            <div className="service-expanded">{description}</div>
            <a href="#contact" className="service-link" onClick={() => onQuote(name)} aria-label={`Request a quote for ${name}`}>
              Request a quote <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </article>
        );
      })}
    </div>
  );
}
