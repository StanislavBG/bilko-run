import type { NavigateFunction } from 'react-router-dom';
import type { PortfolioProject } from '../../data/portfolio.js';

/**
 * Navigate to a project's primary URL.
 *
 * - In-repo React routes use the SPA navigator (no full reload).
 * - Static paths and external URLs trigger a full page load so the
 *   browser leaves the SPA and serves the static project (or external host).
 */
export function navigateProject(navigate: NavigateFunction, p: PortfolioProject): void {
  if (p.isInternal) {
    navigate(p.href);
  } else {
    window.location.href = p.href;
  }
}
