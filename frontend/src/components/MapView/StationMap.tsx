import React, { useEffect, useRef } from 'react';
import { Station } from '../../types';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';

interface StationMapProps {
  stations: Station[];
  selectedStationId: string;
  onSelectStation: (id: string) => void;
}

export const StationMap: React.FC<StationMapProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map centered on India to view all multi-state observatories
      const map = L.map(mapContainerRef.current, {
        center: [22.0, 78.5],
        zoom: 4.5,
        zoomControl: true,
        attributionControl: false,
      });

      // Clean Dark theme map tiles (Esri Dark Gray Canvas - free & keyless, zero watermark)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    // Add markers for stations
    stations.forEach((st) => {
      const isSelected = st.id === selectedStationId;
      const isWarning = st.status === 'Warning';
      const isCritical = st.status === 'Critical';

      const color = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

      // Custom SVG Marker Icon
      const customIcon = L.divIcon({
        className: 'custom-station-pin',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            ${
              isSelected
                ? `<div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background-color: ${color}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                : ''
            }
            <div style="
              width: ${isSelected ? '22px' : '16px'};
              height: ${isSelected ? '22px' : '16px'};
              border-radius: 9999px;
              background-color: ${color};
              border: 2px solid #090d16;
              box-shadow: 0 0 12px ${color};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 9px;
              font-weight: bold;
              cursor: pointer;
            ">
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([st.latitude, st.longitude], { icon: customIcon }).addTo(map);

      marker.on('click', () => {
        onSelectStation(st.id);
      });

      marker.bindPopup(`
        <div style="color: #0f172a; font-family: sans-serif; min-width: 160px; padding: 4px;">
          <h4 style="margin: 0; font-weight: bold; font-size: 13px;">${st.name}</h4>
          <p style="margin: 2px 0 6px; font-size: 11px; color: #64748b;">${st.state} • Elev: ${st.elevation_m}m</p>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
            <span>Status:</span>
            <strong style="color: ${color};">${st.status}</strong>
          </div>
          <button id="btn-select-${st.id}" style="
            margin-top: 8px;
            width: 100%;
            background-color: #0284c7;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
          ">Focus Station</button>
        </div>
      `);

      markersRef.current[st.id] = marker;
    });

    // Fly smoothly to selected station
    const sel = stations.find((s) => s.id === selectedStationId);
    if (sel) {
      map.flyTo([sel.latitude, sel.longitude], 8, { animate: true, duration: 1.2 });
    }
  }, [stations, selectedStationId, onSelectStation]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-slate-100">GIS AWS Station Network</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {stations.length} Active IMD Observatories
        </span>
      </div>

      <div className="relative w-full h-72 rounded-xl overflow-hidden border border-slate-800">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Legend Overlay */}
        <div className="absolute bottom-2 left-2 z-20 bg-slate-950/90 border border-slate-800 rounded-lg p-2 text-[10px] space-y-1 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300">Healthy</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-300">Warning / Drift</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-slate-300">Critical Anomaly</span>
          </div>
        </div>
      </div>
    </div>
  );
};
