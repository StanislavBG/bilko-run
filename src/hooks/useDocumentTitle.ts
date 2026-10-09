import { useEffect } from 'react';

export const DEFAULT_DOCUMENT_TITLE = 'Bilko.run — Tools for Makers Who Ship';

/** Sets document.title while the calling page is mounted; restores the site default on unmount. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
    return () => { document.title = DEFAULT_DOCUMENT_TITLE; };
  }, [title]);
}
