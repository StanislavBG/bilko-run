import { PageHeader } from '../components/portfolio/PageHeader.js';
import { useRef } from 'react';
import { trackFlow } from '../lib/telemetry.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export function ContactPage() {
  useDocumentTitle('Contact — Bilko');
  const started = useRef(false);
  const onFirstFocus = () => {
    if (started.current) return;
    started.current = true;
    trackFlow('contact', 'start');
  };

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 08 · Hello"
        title="Contact."
        lede="Real inboxes. No forms that disappear into nothing."
        what="Pick the channel that matches your message. Bilko reads everything, replies to most things within a week."
      />
      <div className="pf-contact">
        <div>
          <div className="pf-big">
            Say hi, send a <em>bug</em>,<br />
            pitch a <em>collab</em>.
          </div>
        </div>
        <div className="pf-links" onFocusCapture={onFirstFocus} onClickCapture={onFirstFocus}>
          <a data-track="contact-email" href="mailto:BilkoBibitkov2000@gmail.com"><span>BilkoBibitkov2000@gmail.com</span><span className="pf-where">Email · best</span></a>
          <a data-track="contact-twitter" href="https://x.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer"><span>@BilkoBibitkov</span><span className="pf-where">Twitter</span></a>
          <a data-track="contact-github" href="https://bilko.run/projects/git-viewer/" target="_blank" rel="noopener noreferrer"><span>bilko</span><span className="pf-where">GitHub</span></a>
          <a data-track="contact-linkedin" href="https://www.linkedin.com/in/bilko-bibitkov-403391412/" target="_blank" rel="noopener noreferrer"><span>/in/bilko-bibitkov</span><span className="pf-where">LinkedIn</span></a>
          <a><span>Forum (soon)</span><span className="pf-where">Community</span></a>
        </div>
      </div>
    </div>
  );
}
