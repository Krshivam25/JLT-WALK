import React from 'react';
import MapboxGL from '@rnmapbox/maps';
import { HeatmapCell } from '../types';

interface Props {
  cells: HeatmapCell[];
}

export default function HeatmapOverlay({ cells }: Props) {
  if (cells.length === 0) return null;

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: cells.map((cell, i) => ({
      type: 'Feature' as const,
      id: `heat-${i}`,
      geometry: {
        type: 'Point' as const,
        coordinates: [cell.lon, cell.lat],
      },
      properties: {
        intensity: cell.intensity,
        sample_count: cell.sample_count,
      },
    })),
  };

  return (
    <MapboxGL.ShapeSource id="heatmap-source" shape={geojson}>
      <MapboxGL.HeatmapLayer
        id="heatmap-layer"
        style={{
          heatmapColor: [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,245,160,0)',
            0.3, 'rgba(0,245,160,0.3)',
            0.6, 'rgba(0,245,160,0.5)',
            1, 'rgba(0,245,160,0.8)',
          ],
          heatmapRadius: 30,
          heatmapIntensity: 1,
          heatmapWeight: ['get', 'intensity'],
          heatmapOpacity: 0.7,
        }}
      />
    </MapboxGL.ShapeSource>
  );
}
