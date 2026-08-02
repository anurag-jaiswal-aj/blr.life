/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js navigation
vi.mock('next/navigation', () => {
  const pushMock = vi.fn();
  let currentParams = new URLSearchParams();

  return {
    useRouter: () => ({
      push: pushMock,
      replace: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => currentParams,
    __setSearchParams: (params: string) => {
      currentParams = new URLSearchParams(params);
    },
    __getPushMock: () => pushMock,
  };
});

// Mock react-map-gl to prevent WebGL errors in jsdom
vi.mock('react-map-gl/maplibre', () => {
  const React = require('react');
  return {
    default: function MockMap(props: any) {
      return React.createElement('div', { 
        'data-testid': 'mock-map',
        onClick: () => {
          if (props.onClick) {
            props.onClick({ lngLat: { lat: 12.9716, lng: 77.5946 } });
          }
        }
      }, props.children);
    },
    Marker: function MockMarker(props: any) {
      return React.createElement('div', {
        'data-testid': 'mock-marker',
        'data-lat': props.latitude,
        'data-lng': props.longitude,
      }, props.children);
    },
    NavigationControl: () => React.createElement('div', { 'data-testid': 'mock-nav-control' }),
  };
});
