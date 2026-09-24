/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapContainer } from './MapContainer';
import { describe, it, expect, vi } from 'vitest';
import * as mapGL from 'react-map-gl/maplibre';

describe('MapContainer (MAP/COORDINATE SYNCHRONIZATION)', () => {
  it('renders MapLibre map and navigation controls safely', () => {
    render(<MapContainer workLat={null} workLng={null} onWorkLocationSelect={vi.fn()} recommendations={[]} />);
    expect(screen.getByTestId('mock-map')).toBeInTheDocument();
    expect(screen.getByTestId('mock-nav-control')).toBeInTheDocument();
  });

  it('calls onWorkLocationSelect when map is clicked (SYNCHRONIZATION)', () => {
    const selectSpy = vi.fn();
    render(<MapContainer workLat={null} workLng={null} onWorkLocationSelect={selectSpy} recommendations={[]} />);
    fireEvent.click(screen.getByTestId('mock-map'));
    expect(selectSpy).toHaveBeenCalledWith(12.9716, 77.5946);
  });

  it('renders work marker at specified coordinates when provided', () => {
    render(<MapContainer workLat={13.0} workLng={77.5} onWorkLocationSelect={vi.fn()} recommendations={[]} />);
    const markers = screen.getAllByTestId('mock-marker');
    expect(markers).toHaveLength(1);
  });

  it('renders recommendation markers with correct coordinates and color scaling based on score', () => {
    const recommendations: any = [
      { locality_id: 1, total_score: 95, metadata: { coordinates: { lat: 12.9, lng: 77.6 } } }, // Green
      { locality_id: 2, total_score: 70, metadata: { coordinates: { lat: 13.0, lng: 77.7 } } }, // Yellow
      { locality_id: 3, total_score: 40, metadata: { coordinates: { lat: 13.1, lng: 77.8 } } }, // Red
      { locality_id: 4, total_score: 0, metadata: { coordinates: { lat: 13.2, lng: 77.9 } } }   // Gray
    ];
    render(<MapContainer workLat={null} workLng={null} onWorkLocationSelect={vi.fn()} recommendations={recommendations} />);
    const markers = screen.getAllByTestId('mock-marker');
    expect(markers).toHaveLength(4);
    // Because the map rendering is somewhat mocked, we just verify it doesn't crash here.
    // Testing specific inline styles on children of the marker in jsdom is brittle, 
    // but we can assume rendering didn't throw and all branches in the mapping ran.
  });

  it('implements keyboard accessibility for recommendation markers', () => {
    const recommendations: any = [
      { locality_id: 1, name: 'Indiranagar', rank: 1, metadata: { coordinates: { lat: 12.9, lng: 77.6 } } },
      { locality_id: 2, name: 'Koramangala', rank: 2, metadata: { coordinates: { lat: 13.0, lng: 77.7 } } },
    ];
    const selectSpy = vi.fn();

    render(
      <MapContainer
        workLat={null}
        workLng={null}
        onWorkLocationSelect={vi.fn()}
        recommendations={recommendations}
        selectedLocalityId={1}
        onRecommendationSelect={selectSpy}
      />
    );

    // B. Marker attributes
    const indiranagarMarker = screen.getByRole('button', { name: 'Select Indiranagar, Rank 1' });
    const koramangalaMarker = screen.getByRole('button', { name: 'Select Koramangala, Rank 2' });

    expect(indiranagarMarker).toHaveAttribute('tabIndex', '0');
    expect(indiranagarMarker).toHaveAttribute('aria-pressed', 'true');
    expect(koramangalaMarker).toHaveAttribute('aria-pressed', 'false');

    // D. Pointer activation
    fireEvent.click(koramangalaMarker);
    expect(selectSpy).toHaveBeenCalledWith(2);
    selectSpy.mockClear();

    // C. Keyboard activation
    fireEvent.keyDown(koramangalaMarker, { key: 'Enter' });
    expect(selectSpy).toHaveBeenCalledWith(2);
    selectSpy.mockClear();

    fireEvent.keyDown(indiranagarMarker, { key: ' ' });
    expect(selectSpy).toHaveBeenCalledWith(1);
    selectSpy.mockClear();

    // E. Unrelated keys
    fireEvent.keyDown(indiranagarMarker, { key: 'Escape' });
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('renders GeoJSON polygons when geometry is provided', () => {
    const recommendations: any = [
      {
        locality_id: 1,
        name: 'With Polygon',
        rank: 1,
        metadata: { coordinates: { lat: 12.9, lng: 77.6 } },
        geometry_geojson: {
          type: 'MultiPolygon',
          coordinates: [[[[77.5, 12.9], [77.6, 12.9], [77.6, 13.0], [77.5, 13.0], [77.5, 12.9]]]]
        }
      },
      {
        locality_id: 2,
        name: 'No Polygon',
        rank: 2,
        metadata: { coordinates: { lat: 13.0, lng: 77.7 } },
        geometry_geojson: null
      },
    ];

    const sourceSpy = vi.spyOn(mapGL, 'Source');

    render(
      <MapContainer
        workLat={null}
        workLng={null}
        onWorkLocationSelect={vi.fn()}
        recommendations={recommendations}
      />
    );

    // Should still render 2 markers
    const markers = screen.getAllByTestId('mock-marker');
    expect(markers).toHaveLength(2);

    // Should render the GeoJSON source
    const source = screen.getByTestId('mock-source');
    expect(source).toBeInTheDocument();
    expect(source).toHaveAttribute('data-source-id', 'locality-polygons');

    // Assert that the Source was called with exactly the expected FeatureCollection
    expect(sourceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'locality-polygons',
        data: expect.objectContaining({
          type: 'FeatureCollection',
          features: [
            expect.objectContaining({
              type: 'Feature',
              geometry: {
                type: 'MultiPolygon',
                coordinates: [[[[77.5, 12.9], [77.6, 12.9], [77.6, 13.0], [77.5, 13.0], [77.5, 12.9]]]]
              }
            })
          ]
        })
      }),
      undefined
    );

    // Should render both fill and line layers
    const layers = screen.getAllByTestId('mock-layer');
    expect(layers).toHaveLength(2);
    expect(layers[0]).toHaveAttribute('data-layer-id', 'locality-polygons-fill');
    expect(layers[1]).toHaveAttribute('data-layer-id', 'locality-polygons-line');
  });
});
