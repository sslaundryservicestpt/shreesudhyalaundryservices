import styles from './MarketingLogo.module.css';

const artwork = '/images/brand-logo-clean.jpg';

export default function MarketingLogo({ compact = false, inert = false }: {
  compact?: boolean;
  inert?: boolean;
}) {
  return (
    <a
      className={`${styles.logo} ${compact ? styles.compact : styles.full}`}
      href="#home"
      aria-label="Shree Sudhya Laundry Services home"
      inert={inert}
    >
      {compact ? (
        <>
          <span className={styles.emblem} aria-hidden="true">
            <img src={artwork} alt="" width={1536} height={1024} fetchPriority="high" />
          </span>
          <span className={styles.wordmark} aria-hidden="true">
            <img src={artwork} alt="" width={1536} height={1024} />
          </span>
        </>
      ) : (
        <img src={artwork} alt="" width={1536} height={1024} loading="lazy" />
      )}
    </a>
  );
}
