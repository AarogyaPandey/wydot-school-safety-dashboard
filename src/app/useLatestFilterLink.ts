import { useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

/** Preserve a filter update even while React is still rendering its transition. */
export function useLatestFilterLink() {
  const navigate = useNavigate();
  return useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.currentTarget;
    if (anchor.target && anchor.target !== '_self') return;
    const target = new URL(anchor.href);
    if (target.origin !== window.location.origin || target.search === window.location.search) return;
    // History changes synchronously; the link's rendered href can briefly lag it.
    event.preventDefault();
    void navigate({ pathname: target.pathname, search: window.location.search, hash: target.hash });
  }, [navigate]);
}
