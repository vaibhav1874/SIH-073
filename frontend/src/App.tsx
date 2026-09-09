import React, { useState, useEffect } from 'react';
import { Station, AnomalyAlert, StaffUser } from './types';
import { apiService } from './services/api';
import { useTelemetryStream } from './hooks/useTelemetryStream';

import { Header } from './components/Navigation/Header';
import { TelemetryCards } from './components/Dashboard/TelemetryCards';
import { LivePipelineFlow } from './components/Dashboard/LivePipelineFlow';
import { TelemetryCharts } from './components/Dashboard/TelemetryCharts';
import { AIDiagnosisPanel } from './components/AnomalyAlert/AIDiagnosisPanel';
import { HealthMatrix } from './components/SensorHealth/HealthMatrix';
import { StationMap } from './components/MapView/StationMap';
import { AlertToast } from './components/AnomalyAlert/AlertToast';
import { AlertLogTable } from './components/AnomalyAlert/AlertLogTable';
import { FaultControlPanel } from './components/FaultInjector/FaultControlPanel';
import { BenchmarkHub } from './components/Metrics/BenchmarkHub';
import { LandingPage } from './components/Landing/LandingPage';
import { StaffAuthModal, PRESET_OFFICERS } from './components/Auth/StaffAuthModal';

export const App: React.FC = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('ABOHAR');
  const [activeTab, setActiveTab] = useState<'monitor' | 'alerts' | 'faults' | 'benchmark'>('monitor');
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('skyguard_auth_user');
        if (saved) return JSON.parse(saved);
      } catch (err) {
        console.error('Failed to parse saved user', err);
      }
    }
    return PRESET_OFFICERS.officer;
  });

  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'dashboard' || window.location.hash === '#dashboard') {
        return 'dashboard';
      }
    }
    return 'landing';
  });

  // Telemetry stream hook
  const {
    connectionStatus,
    latestTelemetry,
    telemetryHistory,
    activeAlert,
    clearAlert,
  } = useTelemetryStream(selectedStationId);

  // Fetch initial stations & alerts
  useEffect(() => {
    async function initData() {
      const sts = await apiService.getStations();
      setStations(sts);
      if (sts.length > 0 && !selectedStationId) {
        setSelectedStationId(sts[0].id);
      }
      const alts = await apiService.getAlerts();
      setAlerts(alts);
    }
    initData();
  }, [selectedStationId]);

  const reloadAlerts = async () => {
    const alts = await apiService.getAlerts();
    setAlerts(alts);
  };

  const handleLaunchDashboard = (tab?: 'monitor' | 'alerts' | 'faults' | 'benchmark', stationId?: string) => {
    if (tab) setActiveTab(tab);
    if (stationId) setSelectedStationId(stationId.toUpperCase());
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (user: StaffUser) => {
    setCurrentUser(user);
    if (user.assignedStation && user.assignedStation !== 'ALL') {
      setSelectedStationId(user.assignedStation);
    }
    // Redirect directly to mission control dashboard on login or signup
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    localStorage.removeItem('skyguard_auth_user');
    setCurrentUser(null);
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedStation = stations.find((s) => s.id === selectedStationId) || stations[0];
  const activeAlertCount = alerts.filter((a) => !a.is_acknowledged).length;

  // Render Landing Page
  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          onLaunchDashboard={handleLaunchDashboard}
          stations={stations}
          selectedStationId={selectedStationId}
          latestTelemetry={latestTelemetry}
          connectionStatus={connectionStatus}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
        <StaffAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      {/* Top Header */}
      <Header
        stations={stations}
        selectedStationId={selectedStationId}
        onSelectStation={setSelectedStationId}
        connectionStatus={connectionStatus}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeAlertCount={activeAlertCount}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onGoToLanding={() => {
          setCurrentView('landing');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Staff Authentication Modal */}
      <StaffAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Floating Anomaly Toast */}
      <AlertToast alert={activeAlert} onDismiss={clearAlert} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TAB 1: LIVE AWS MONITOR */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            {/* Real-Time Telemetry Pipeline Flow Architecture */}
            <LivePipelineFlow telemetry={latestTelemetry} />

            {/* Top Cards: Temperature, Humidity, Pressure with Arc Gauges */}
            <TelemetryCards telemetry={latestTelemetry} />

            {/* Mid Grid: Charts (2 cols) & Station GIS Map (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TelemetryCharts history={telemetryHistory} />
              </div>
              <div className="lg:col-span-1">
                <StationMap
                  stations={stations}
                  selectedStationId={selectedStationId}
                  onSelectStation={setSelectedStationId}
                />
              </div>
            </div>

            {/* Bottom Grid: 3-Arm AI Diagnosis (2 cols) & Sensor Health Matrix (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <AIDiagnosisPanel telemetry={latestTelemetry} />
              </div>
              <div className="lg:col-span-1">
                <HealthMatrix
                  health={latestTelemetry?.health || null}
                  stationName={selectedStation?.name}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ALERTS & TRIAGE CENTER */}
        {activeTab === 'alerts' && (
          <AlertLogTable alerts={alerts} onAlertAcknowledged={reloadAlerts} />
        )}

        {/* TAB 3: CONTROLLED FAULT INJECTOR */}
        {activeTab === 'faults' && (
          <FaultControlPanel
            stations={stations}
            selectedStationId={selectedStationId}
          />
        )}

        {/* TAB 4: MODEL BENCHMARKS */}
        {activeTab === 'benchmark' && <BenchmarkHub />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <div>
            <span>SkyGuard AI • SIH26073 | Ministry of Earth Sciences (MoES)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Model: Hybrid 3-Arm Ensemble (Rules + IF + LSTM)</span>
            <span>Station: {selectedStationId}</span>
            <span>Status: Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
