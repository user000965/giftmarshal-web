import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoneyCard, daysLeftLabel } from './MoneyCard';

describe('MoneyCard', () => {
  it('shows progress, target, the amount still needed and the time left', () => {
    render(<MoneyCard progressCents={18000} targetCents={24000} daysLeft={2} />);
    expect(screen.getByText('$180')).toBeInTheDocument();
    expect(screen.getByText('of $240')).toBeInTheDocument();
    expect(screen.getByText('$60 to go')).toBeInTheDocument();
    expect(screen.getByText('2 days left')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('says fully funded at the target', () => {
    render(<MoneyCard progressCents={24000} targetCents={24000} daysLeft={1} />);
    expect(screen.getByText('Fully funded')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('daysLeftLabel', () => {
  it('handles singular, plural and the last day', () => {
    expect(daysLeftLabel(5)).toBe('5 days left');
    expect(daysLeftLabel(1)).toBe('1 day left');
    expect(daysLeftLabel(0)).toBe('Ends today');
    expect(daysLeftLabel(-1)).toBe('Ends today');
  });
});
