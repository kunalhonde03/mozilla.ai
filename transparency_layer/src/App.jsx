import React, { useState, useEffect } from 'react';
import { Shield, Settings, Server, Radio, Play, Pause, Cpu, HardDrive, CircleDot, Database } from 'lucide-react';
import socketService from './services/socket';
import BudgetEnforcer from './components/BudgetEnforcer';
import SecurityFeed from './components/SecurityFeed';
import TopologyVisualizer from './components/TopologyVisualizer';
import EventsLog from './components/EventsLog';
import SandboxModal from './components/SandboxModal';
import ExplainabilityView from './components/ExplainabilityView';

export default function App() {
  const [isSimulating, setIsSimulating] = useState(true);
  const [socketUrl, setSocketUrl] = useState('http://localhost:5000');
  const [showConfig, setShowConfig] = useState(false);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hwStats, setHwStats] = useState({
    cpu: 45,
    ram: 5.6,
    disk: 1.8
  });

  useEffect(() => {
    socketService.connect(socketUrl);
    setIsSimulating(socketService.useSimulation);

    const handleBudgetStatus = () => {
      if (!socketService.useSimulation && socketService.socket?.connected) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    };

    const unsubscribeStats = socketService.subscribe('stats', (data) => {
      setHwStats({
        cpu: data.cpu,
        ram: data.ram,
        disk: data.disk
      });
    });

    const interval = setInterval(handleBudgetStatus, 1000);
    return () => {
      clearInterval(interval);
      unsubscribeStats();
      socketService.disconnect();
    };
  }, [socketUrl]);

  const toggleSimulation = () => {
    const nextState = !isSimulating;
    setIsSimulating(nextState);
    socketService.enableSimulation(nextState);
  };

  const handleConnectLive = (e) => {
    e.preventDefault();
    setIsSimulating(false);
    socketService.enableSimulation(false);
    socketService.connect(socketUrl);
    setShowConfig(false);
  };

  // Helper to render ASCII progress bars for terminal authenticity
  const renderAsciiBar = (percentage, color) => {
    const totalBlocks = 10;
    const filledBlocks = Math.round((percentage / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: color }}>
        [{bar}] {percentage}%
      </span>
    );
  };

  return (
    <div className="dashboard-container" style={{ paddingBottom: '80px' }}>
      {/* HEADER SECTION */}
      <header className="dashboard-header">
        <div className="logo-section">
          <div style={{
            background: 'linear-gradient(135deg, var(--neon-cyan) 0%, var(--neon-blue) 100%)',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(0, 242, 254, 0.3)'
          }}>
            <Shield size={22} style={{ color: '#06070a' }} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              OtariGuard <span className="logo-accent">FinOps</span>
              <span style={{ 
                fontSize: '9px', 
                border: '1px solid rgba(0, 242, 254, 0.3)', 
                color: 'var(--neon-cyan)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)',
                marginLeft: '8px',
                letterSpacing: '1px',
                background: 'rgba(0, 242, 254, 0.05)'
              }}>v1.4.0</span>
            </h1>
            <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              SYSTEM_PDP_DECISION_PORTAL_SHIELD
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Connection Status Badge */}
          <div className="status-badge" style={{ fontFamily: 'var(--font-mono)' }}>
            {isSimulating ? (
              <>
                <span className="pulse-dot-cyan" style={{ background: 'var(--neon-yellow)' }} />
                <span style={{ color: 'var(--neon-yellow)' }}>SIMULATOR_ACTIVE</span>
              </>
            ) : isConnected ? (
              <>
                <span className="pulse-dot-green" />
                <span style={{ color: 'var(--neon-green)' }}>PDP_GATE_ONLINE</span>
              </>
            ) : (
              <>
                <span className="pulse-dot-rose" />
                <span style={{ color: 'var(--neon-rose)' }}>PDP_GATE_OFFLINE</span>
              </>
            )}
          </div>

          {/* Developer Sandbox Button */}
          <button 
            className="btn"
            onClick={() => setIsSandboxOpen(true)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '12px', 
              borderColor: 'var(--neon-green)', 
              color: 'var(--neon-green)', 
              background: 'rgba(0, 245, 160, 0.04)' 
            }}
          >
            <Database size={13} />
            SANDBOX
          </button>

          {/* Config Controls */}
          <button 
            className="btn btn-secondary"
            onClick={() => setShowConfig(!showConfig)}
            title="Configure Connection"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            <Settings size={14} />
            CONFIG
          </button>

          {/* Simulator Toggle Button */}
          <button 
            className="btn" 
            onClick={toggleSimulation}
            style={{ 
              borderColor: isSimulating ? 'var(--neon-yellow)' : 'var(--neon-cyan)',
              color: isSimulating ? 'var(--neon-yellow)' : 'var(--neon-cyan)',
              background: isSimulating ? 'rgba(255, 210, 0, 0.04)' : 'rgba(0, 242, 254, 0.04)',
              fontSize: '12px'
            }}
          >
            {isSimulating ? <Pause size={13} /> : <Play size={13} />}
            {isSimulating ? 'HALT_SIM' : 'RUN_SIM'}
          </button>
        </div>
      </header>

      {/* EXPANDABLE CONFIG PANEL */}
      {showConfig && (
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(13,16,26,0.95)', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
          <form onSubmit={handleConnectLive} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1, minWidth: '240px' }}>
              <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                GATEWAY_SOCKET_ENDPOINT
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Server size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  value={socketUrl}
                  onChange={(e) => setSocketUrl(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    padding: '8px 12px 8px 32px',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px'
                  }}
                  placeholder="e.g. http://localhost:5000"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn">
                <Radio size={14} />
                CONNECT_LIVE
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setIsSimulating(true);
                  socketService.enableSimulation(true);
                  setShowConfig(false);
                }}
              >
                RESTORE_SIM
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DASHBOARD MODULES */}
      <main className="dashboard-grid">
        {/* Left Column (Topology + System Journal + Security Terminal Logs) */}
        <div className="left-column">
          {/* ThreeJS Flow Visualizer */}
          <TopologyVisualizer />

          {/* Actionable System Journal Event Log */}
          <EventsLog />
          
          {/* Security Log Feed */}
          <SecurityFeed />
        </div>

        {/* Right Column (Wallet Enforcer + Sandbox Explainability View + Specs) */}
        <div className="right-column">
          {/* Wallet Enforcer Gauge & Latency Table */}
          <BudgetEnforcer />

          {/* Sandbox Explainability View (Side-by-Side Ingress vs Egress) */}
          <ExplainabilityView />

          {/* Quick Specs / Transparency details */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="card-header" style={{ marginBottom: '4px' }}>
              <div className="card-title" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                GATEWAY_POLICY_SPECIFICATIONS
              </div>
            </div>
            
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ lineHeight: '1.5' }}>
                Active safety enforcer filters incoming prompt token packages at the gateway. 
                Downstream local inference cores are shielded from malicious system prompt manipulations.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>ENGINE_TYPE</div>
                  <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600', marginTop: '2px' }}>Llamafile PDP</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MODEL_TARGET</div>
                  <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600', marginTop: '2px' }}>Llama-3-8B-Instruct</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>HARD_TOKEN_LIMIT</div>
                  <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600', marginTop: '2px' }}>$2.00 hard limit</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>STREAMING_STATE</div>
                  <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600', marginTop: '2px' }}>IO_POLLING</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sandbox Modal */}
      <SandboxModal isOpen={isSandboxOpen} onClose={() => setIsSandboxOpen(false)} />

      {/* COMMAND AND CONTROL BOTTOM HARDWARE STATUS BAR */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        background: 'rgba(6, 7, 10, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        padding: '8px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Left Status: Engine Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <CircleDot size={12} className="pulse-dot-green" style={{ animationDuration: '1.5s' }} />
          <span>CORE_ENGINE: <strong style={{ color: 'var(--neon-green)' }}>llamafile-server</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span>HOST: <strong>localhost:8080</strong></span>
        </div>

        {/* Center Status: Hardware Utilizations */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {/* CPU Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={12} style={{ color: 'var(--neon-cyan)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>CPU:</span>
            {renderAsciiBar(hwStats.cpu, 'var(--neon-cyan)')}
          </div>

          {/* RAM Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={12} style={{ color: 'var(--neon-blue)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>RAM:</span>
            <span style={{ color: 'var(--neon-blue)' }}>{hwStats.ram}GB / 16.0GB</span>
          </div>

          {/* Disk Util */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>DISK I/O:</span>
            <span style={{ color: 'var(--neon-yellow)' }}>{hwStats.disk} MB/s</span>
          </div>
        </div>

        {/* Right Status: Clock & Run state */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
          <span>BUS_RATE: ~3.3 packets/s</span>
          <span style={{ color: 'var(--text-secondary)' }}>SYS_OK</span>
        </div>
      </footer>
    </div>
  );
}
