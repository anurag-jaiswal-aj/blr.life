import React, { useRef } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import type * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RecommendationResult } from '../lib/api';

interface MapContainerProps {
  workLat: number | null;
  workLng: number | null;
  onWorkLocationSelect: (lat: number, lng: number) => void;
  recommendations: RecommendationResult[];
}

export function MapContainer({
  workLat,
  workLng,
  onWorkLocationSelect,
  recommendations,
}: MapContainerProps) {
  const mapRef = useRef(null);

  const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
    if (e.lngLat) {
      onWorkLocationSelect(e.lngLat.lat, e.lngLat.lng);
    }
  };

  return (
    <div className="w-full h-full relative bg-surface-secondary">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 77.5946,
          latitude: 12.9716,
          zoom: 11,
        }}
        mapStyle={{
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        }}
        onClick={handleClick}
        interactiveLayerIds={[]}
      >
        <NavigationControl position="top-right" />

        {/* Work Location Marker */}
        {workLat !== null && workLng !== null && (
          <Marker longitude={workLng} latitude={workLat} anchor="bottom">
            <div className="flex flex-col items-center cursor-pointer group">
              <div className="bg-brand-primary text-text-inverse px-2 py-1 rounded text-[10px] font-bold shadow-elevated whitespace-nowrap mb-1 uppercase tracking-wider">
                Work
              </div>
              <div className="w-4 h-4 bg-brand-primary rounded-full border-2 border-surface-primary shadow-subtle relative z-10"></div>
            </div>
          </Marker>
        )}

        {/* Recommendation Markers */}
        {recommendations.map((rec) => {
          if (!rec.metadata.coordinates) return null;
          return (
            <Marker
              key={rec.locality_id}
              longitude={rec.metadata.coordinates.lng}
              latitude={rec.metadata.coordinates.lat}
              anchor="bottom"
            >
              <div className="relative w-8 h-8 flex items-center justify-center font-bold text-text-inverse shadow-elevated" style={{
                background: `linear-gradient(135deg, ${rec.total_score >= 80 ? 'var(--color-score-strong)' : rec.total_score >= 50 ? 'var(--color-score-moderate)' : 'var(--color-score-weak)'}, ${rec.total_score >= 80 ? 'var(--color-success-text)' : rec.total_score >= 50 ? 'var(--color-warning-text)' : 'var(--color-error-text)'})`,
                borderRadius: '50% 50% 50% 0',
                transform: 'rotate(-45deg)',
              }}>
                <span style={{ transform: 'rotate(45deg)' }} className="text-body leading-none">
                  {rec.rank}
                </span>
              </div>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
