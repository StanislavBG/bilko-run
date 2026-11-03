import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import {
  BILKO_PROFILE_TITLE,
  BILKO_PROFILE_TOP_HTML,
  BILKO_PROFILE_BOTTOM_HTML,
} from '../../shared/bilko-profile.js';

function checkoutMessage(): string | null {
  const q = new URLSearchParams(window.location.search);
  if (q.get('offer') === 'bilko-hour' && q.get('session_id')) {
    return 'Payment received. Thank you. Bilko will email you shortly to plan your hours.';
  }
  if (q.get('checkout') === 'cancel') return 'Checkout cancelled. No charge.';
  return null;
}

export function BilkoProfilePage() {
  useDocumentTitle(BILKO_PROFILE_TITLE);
  const message = checkoutMessage();
  return (
    <div className="bilko-profile">
      {message && <p role="status">{message}</p>}
      {/* Trusted constants from shared/bilko-profile.ts; no user input. */}
      <div dangerouslySetInnerHTML={{ __html: BILKO_PROFILE_TOP_HTML }} />
      <div dangerouslySetInnerHTML={{ __html: BILKO_PROFILE_BOTTOM_HTML }} />
    </div>
  );
}
