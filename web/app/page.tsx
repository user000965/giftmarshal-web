import { MoneyCard } from '@/components/MoneyCard/MoneyCard';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Gift Marshal Pots</p>
      <h1 className={styles.headline}>Chip in together. Nobody pays unless the pot fills.</h1>
      <p className={styles.lede}>
        Friends pool money for one great gift through PayPal. Every pledge is a hold, not a charge: the gift
        happens, or everyone is released.
      </p>
      <MoneyCard progressCents={18000} targetCents={24000} daysLeft={2} />
      <p className={styles.trust}>
        <span aria-hidden="true">🔒</span> Held, not charged. Collected only if the pot fills.
      </p>
    </main>
  );
}
