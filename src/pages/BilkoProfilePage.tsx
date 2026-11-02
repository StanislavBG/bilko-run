import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { FreeHourBooking } from '../components/FreeHourBooking.js';
import {
  BILKO_PROFILE_TITLE,
  BILKO_PROFILE_TOP_HTML,
  BILKO_PROFILE_BOTTOM_HTML,
} from '../../shared/bilko-profile.js';

export function BilkoProfilePage() {
  useDocumentTitle(BILKO_PROFILE_TITLE);
  return (
    <div className="bilko-profile">
      {/* Trusted constants from shared/bilko-profile.ts; no user input. */}
      <div dangerouslySetInnerHTML={{ __html: BILKO_PROFILE_TOP_HTML }} />
      <FreeHourBooking />
      <div dangerouslySetInnerHTML={{ __html: BILKO_PROFILE_BOTTOM_HTML }} />
    </div>
  );
}
