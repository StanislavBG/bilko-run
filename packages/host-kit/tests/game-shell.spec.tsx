import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameShell } from '../src/games/GameShell';

const theme = {
  heroGradient: 'from-indigo-900 to-indigo-950',
  glowColor: 'rgba(99,102,241,0.14)',
  accentText: 'text-indigo-400',
  accentTextLight: 'text-indigo-200',
};

describe('GameShell', () => {
  it('renders eyebrow, title, and tagline', () => {
    render(
      <GameShell eyebrow="Bilko · Game" title="Sudoku" tagline="Train your logic" theme={theme}>
        <div>child</div>
      </GameShell>,
    );
    expect(screen.getByText('Bilko · Game')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sudoku' })).toBeTruthy();
    expect(screen.getByText('Train your logic')).toBeTruthy();
  });

  it('renders children in order', () => {
    render(
      <GameShell eyebrow="e" title="T" tagline="t" theme={theme}>
        <div>Slot A</div>
        <div>Slot B</div>
        <div>Slot C</div>
      </GameShell>,
    );
    const items = screen.getAllByText(/Slot [ABC]/);
    expect(items.map(el => el.textContent)).toEqual(['Slot A', 'Slot B', 'Slot C']);
  });

  it('renders footer with bilko.run link', () => {
    render(
      <GameShell eyebrow="e" title="T" tagline="t" theme={theme}>
        <div />
      </GameShell>,
    );
    expect(screen.getByRole('link', { name: 'bilko.run' })).toBeTruthy();
  });

  it('renders optional footer links', () => {
    render(
      <GameShell
        eyebrow="e"
        title="T"
        tagline="t"
        theme={theme}
        footerLinks={[{ label: 'Privacy', href: '/privacy' }]}
      >
        <div />
      </GameShell>,
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeTruthy();
  });
});
