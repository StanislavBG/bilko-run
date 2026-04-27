import { useEffect } from 'react';
import { PageHeader } from '../components/portfolio/PageHeader.js';

export function ContactPage() {
  useEffect(() => {
    document.title = 'Contact — Bilko';
  }, []);

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
        <div className="pf-links">
          <a href="mailto:bilko@bilko.run"><span>bilko@bilko.run</span><span className="pf-where">Email · best</span></a>
          <a href="https://x.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer"><span>@BilkoBibitkov</span><span className="pf-where">Twitter</span></a>
          <a href="https://github.com/StanislavBG" target="_blank" rel="noopener noreferrer"><span>StanislavBG</span><span className="pf-where">GitHub</span></a>
          <a href="https://www.linkedin.com/in/bilko-bibitkov-23b5b13b1/" target="_blank" rel="noopener noreferrer"><span>/in/bilko</span><span className="pf-where">LinkedIn</span></a>
          <a><span>Forum (soon)</span><span className="pf-where">Community</span></a>
        </div>
      </div>
    </div>
  );
}
