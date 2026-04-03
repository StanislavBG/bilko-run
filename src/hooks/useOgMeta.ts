import { useEffect } from 'react';

/** Set document title and OG/Twitter meta tags for a tool page. */
export function useOgMeta(opts: { title: string; description: string; url: string }) {
  useEffect(() => {
    document.title = opts.title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('property', 'og:title', opts.title);
    setMeta('property', 'og:description', opts.description);
    setMeta('property', 'og:url', opts.url);
    setMeta('name', 'twitter:title', opts.title);
    setMeta('name', 'twitter:description', opts.description);

    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);
}
