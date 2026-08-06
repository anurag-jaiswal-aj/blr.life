import React, { useRef, useEffect } from 'react';
import Map, { Marker, NavigationControl, MapRef } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RecommendationResult } from '../lib/api';

interface MapContainerProps {
  workLat: number | null;
  workLng: number | null;
  onWorkLocationSelect: (lat: number, lng: number) => void;
  recommendations: RecommendationResult[];
  selectedLocalityId?: number | null;
  hoveredLocalityId?: number | null;
  onRecommendationSelect?: (id: number) => void;
  isPreSearch?: boolean;
}

export function MapContainer({
  workLat,
  workLng,
  onWorkLocationSelect,
  recommendations,
  selectedLocalityId,
  hoveredLocalityId,
  onRecommendationSelect,
  isPreSearch = false,
}: MapContainerProps) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    
    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    if (workLat !== null && workLng !== null) {
      bounds.extend([workLng, workLat]);
      hasPoints = true;
    }

    if (recommendations && recommendations.length > 0) {
      recommendations.forEach(rec => {
        if (rec.metadata.coordinates) {
          bounds.extend([rec.metadata.coordinates.lng, rec.metadata.coordinates.lat]);
          hasPoints = true;
        }
      });
    }

    if (hasPoints) {
      mapRef.current.fitBounds(bounds, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        duration: 800,
        maxZoom: 14 // Prevent zooming in too close if points are clustered
      });
    }
  }, [workLat, workLng, recommendations]);

  const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
    if (e.lngLat) {
      onWorkLocationSelect(e.lngLat.lat, e.lngLat.lng);
    }
  };

  return (
    <div className="w-full h-full relative bg-surface-secondary">
      {isPreSearch && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-500 delay-300">
          <div className="bg-surface-primary/90 backdrop-blur border border-border-default px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2">
            <span className="text-[12px] font-medium text-text-secondary tracking-wide">Click map to set workplace</span>
          </div>
        </div>
      )}
      <Map
        ref={mapRef}
        cursor={isPreSearch ? 'crosshair' : 'grab'}
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
          <Marker longitude={workLng} latitude={workLat} anchor="bottom" style={{ zIndex: 50 }}>
            <div className="flex flex-col items-center cursor-pointer group">
              <div className="bg-brand-primary text-text-inverse px-2 py-1 rounded text-[11px] font-bold shadow-elevated whitespace-nowrap mb-1 tracking-wider border border-surface-primary">
                WORK
              </div>
              <div className="w-4 h-4 bg-brand-primary rounded-full border-[2.5px] border-surface-primary shadow-elevated relative z-10"></div>
            </div>
          </Marker>
        )}

        {/* Recommendation Markers */}
        {recommendations.map((rec) => {
          if (!rec.metadata.coordinates) return null;
          const isSelected = selectedLocalityId === rec.locality_id;
          const isHovered = hoveredLocalityId === rec.locality_id;
          const isTop5 = rec.rank <= 5;
          
          let sizeClass = 'w-6 h-6 text-[11px]'; // Others (small)
          let bgStyle = 'var(--color-surface-secondary)';
          let textStyle = 'var(--color-text-secondary)';
          let borderStyle = '1px solid var(--color-border-strong)';
          let zIndex = 20;

          if (isSelected) {
            sizeClass = 'w-9 h-9 text-[14px]';
            bgStyle = 'var(--color-brand-primary)';
            textStyle = 'var(--color-text-inverse)';
            borderStyle = 'none';
            zIndex = 40;
          } else if (isHovered) {
            sizeClass = 'w-8 h-8 text-[13px]';
            bgStyle = 'var(--color-brand-surface)';
            textStyle = 'var(--color-brand-primary)';
            borderStyle = '2px solid var(--color-brand-primary)';
            zIndex = 30;
          } else if (isTop5) {
            sizeClass = 'w-7 h-7 text-[12px]';
            bgStyle = 'var(--color-brand-surface)';
            textStyle = 'var(--color-brand-primary)';
            borderStyle = '2px solid var(--color-brand-primary)';
            zIndex = 25;
          }

          return (
            <Marker
              key={rec.locality_id}
              longitude={rec.metadata.coordinates.lng}
              latitude={rec.metadata.coordinates.lat}
              anchor="bottom"
              style={{ zIndex }}
            >
              <div 
                className={`relative flex items-center justify-center font-bold shadow-elevated cursor-pointer transition-all duration-300 hover:scale-110 ${sizeClass}`} 
                style={{
                  background: bgStyle,
                  color: textStyle,
                  border: borderStyle,
                  borderRadius: '50% 50% 50% 0',
                  transform: 'rotate(-45deg)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRecommendationSelect) onRecommendationSelect(rec.locality_id);
                }}
              >
                <span style={{ transform: 'rotate(45deg)' }} className="leading-none">
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
