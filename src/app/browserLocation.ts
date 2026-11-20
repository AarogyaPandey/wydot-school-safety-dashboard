type PageLocation = Pick<Location, 'protocol' | 'search' | 'hash'>;

/** Hash routing keeps a double-clicked HTML file on the same physical file. */
export function hashRoute(hash: string) {
  const route = hash.replace(/^#/, '');
  const fragmentAt = route.indexOf('#');
  const address = fragmentAt < 0 ? route : route.slice(0, fragmentAt);
  const queryAt = address.indexOf('?');
  return {
    pathname: (queryAt < 0 ? address : address.slice(0, queryAt)) || '/',
    search: queryAt < 0 ? '' : address.slice(queryAt),
    hash: fragmentAt < 0 ? '' : route.slice(fragmentAt),
  };
}
export function currentFilterSearch(location: PageLocation = window.location) {
  return import.meta.env.MODE === 'standalone' || location.protocol === 'file:' ? hashRoute(location.hash).search : location.search;
}
