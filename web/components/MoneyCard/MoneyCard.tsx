import { formatUsd, progressPercent } from '@/lib/money';
import styles from './MoneyCard.module.css';

export interface MoneyCardProps {
  progressCents: number;
  targetCents: number;
  daysLeft: number;
}

export function daysLeftLabel(days: number): string {
  if (days <= 0) return 'Ends today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

/** The plain, calm money card from spec 7.2: amount, then bar, then "$X to go · N days left". */
export function MoneyCard({ progressCents, targetCents, daysLeft }: MoneyCardProps) {
  const percent = progressPercent(progressCents, targetCents);
  const remaining = Math.max(0, targetCents - progressCents);
  return (
    <section className={styles.card} aria-label="Pot progress">
      <p className={styles.amount}>
        <span>{formatUsd(progressCents)}</span> <span className={styles.of}>of {formatUsd(targetCents)}</span>
      </p>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${percent}% funded`}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.meta}>
        <span>{remaining === 0 ? 'Fully funded' : `${formatUsd(remaining)} to go`}</span>
        <span>{daysLeftLabel(daysLeft)}</span>
      </p>
    </section>
  );
}
