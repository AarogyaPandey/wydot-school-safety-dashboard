import { describe, expect, it } from 'vitest';
import { currentFilterSearch, hashRoute } from '../src/app/browserLocation';

describe('standalone HTML navigation', () => {
  it('separates the file route, shared filters, and section anchor', () => {
    expect(hashRoute('#/about?buffer=750&school=fixture#limitations')).toEqual({ pathname: '/about', search: '?buffer=750&school=fixture', hash: '#limitations' });
    expect(hashRoute('#/map')).toEqual({ pathname: '/map', search: '', hash: '' });
    expect(hashRoute('')).toEqual({ pathname: '/', search: '', hash: '' });
  });
  it('reads file filters from the route hash and preserves normal HTTP query handling', () => {
    expect(currentFilterSearch({ protocol: 'file:', search: '', hash: '#/analytics?buffer=750&time=morning' })).toBe('?buffer=750&time=morning');
    expect(currentFilterSearch({ protocol: 'file:', search: '', hash: '#/about#sources' })).toBe('');
    expect(currentFilterSearch({ protocol: 'http:', search: '?buffer=500', hash: '#limitations' })).toBe('?buffer=500');
  });
});
