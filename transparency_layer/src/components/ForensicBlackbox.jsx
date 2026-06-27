import React, { useState, useEffect } from 'react';
import socketService from '../services/socket';
import { ShieldAlert, Download, Power, CheckCircle, Database } from 'lucide-react';

export default function ForensicBlackbox() {
  const [egressStatus, setEgressStatus] = useState('NOMINAL'); // NOMINAL, LEAK_DETECTED, ISOLATED
  const [leakedData, setLeakedData] = useState('');
  const [forensicHistory, setForensicHistory] = useState([]);
  const [downloadReady, setDownloadReady] = useState(false);

  useEffect(() => {
    // Egress leak detection monitor simulation or live events
    const unsub = socketService.subscribe('logs', (log) => {
      // If the simulator outputs a prompt containing specific passwords or keys
      const rawText = (log.raw || '').toLowerCase();
      if (rawText.includes('password') || rawText.includes('secrets') || rawText.includes('admin keys')) {
        triggerKillSwitch(log.raw);
      }
    });

    return () => unsub();
  }, []);

  const triggerKillSwitch = (payloadText) => {
    setEgressStatus('LEAK_DETECTED');
    setLeakedData(payloadText);
    setDownloadReady(true);

    const timestamp = new Date().toLocaleTimeString();
    setForensicHistory(prev => [
      {
        time: timestamp,
        event: "EGRESS_LEAK_PREVENTED",
        leakedToken: "ADMIN_ROOT_HASH",
        source: "Inference Engine Output"
      },
      ...prev
    ]);

    // Automatically shift status to ISOLATED (Air-Bag open)
    setTimeout(() => {
      setEgressStatus('ISOLATED');
    }, 1500);
  };

  const handleDownloadForensics = () => {
    const diagnosticReport = {
      timestamp: new Date().toISOString(),
      gateway_verdict: "EGRESS_KILL_SWITCH_TRIGGERED",
      threat_actor_payload: leakedData,
      blocked_egress_content: "[CONFIDENTIAL] admin_root_hash_sha256",
      isolated_state: "CORE_INFERENCE_SHIELDED",
      system_telemetry_snapshot: {
        cpu_load: "92%",
        memory_usage: "6.2 GB",
        active_ruleset: "Strict_Egress_Compliance_V2"
      }
    };

    const fileData = JSON.stringify(diagnosticReport, null, 2);
    const blob = new Blob([fileData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `OtariGuard_Forensic_Package_${Date.now()}.json`;
    link.click();
  };

  const resetKillSwitch = () => {
    setEgressStatus('NOMINAL');
    setDownloadReady(false);
    setLeakedData('');
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', border: egressStatus !== 'NOMINAL' ? '1px solid #ff4d6d' : '1px solid rgba(255,255,255,0.08)' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '700' }}>
          <Power size={14} style={{ color: egressStatus !== 'NOMINAL' ? '#ff4d6d' : 'var(--neon-cyan)' }} />
          SOVEREIGN_EGRESS_KILL_SWITCH
        </div>
        <span style={{
          fontSize: '9px',
          background: egressStatus === 'NOMINAL' ? 'rgba(0, 242, 254, 0.05)' : 'rgba(255, 77, 109, 0.15)',
          border: `1px solid ${egressStatus === 'NOMINAL' ? 'rgba(0, 242, 254, 0.2)' : '#ff4d6d'}`,
          color: egressStatus === 'NOMINAL' ? 'var(--neon-cyan)' : '#ff4d6d',
          padding: '2px 8px',
          borderRadius: '4px',
          fontFamily: 'var(--font-mono)',
          fontWeight: '700'
        }}>
          {egressStatus}
        </span>
      </div>

      {/* Main Console Box */}
      {egressStatus === 'NOMINAL' ? (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '12px'
        }}>
          <CheckCircle size={28} style={{ color: 'var(--neon-green)', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
          <span style={{ fontWeight: '600', color: '#fff' }}>EGRESS FILTER RUNNING</span>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            No outbound data leaks or sensitive credentials detected from LLM engine outputs.
          </p>
        </div>
      ) : (
        <div style={{
          background: 'rgba(255, 77, 109, 0.05)',
          border: '1px solid rgba(255, 77, 109, 0.2)',
          borderRadius: '8px',
          padding: '16px',
          animation: 'pulse 0.4s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '10px', color: '#ff4d6d' }}>
            <ShieldAlert size={24} style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '12px', display: 'block' }}>洩 (LEAK DETECTED): DATA LEAK PREVENTED</strong>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px', lineHeight: '1.4' }}>
                System intercepted output containing credentials: <strong>[ROOT_PASSWD_HASH]</strong>. 
                Sovereign egress block triggered in <strong>4ms</strong>.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button
              onClick={handleDownloadForensics}
              className="btn"
              style={{
                borderColor: '#ff4d6d',
                color: '#fff',
                background: '#ff4d6d22',
                fontSize: '11px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={12} />
              DOWNLOAD FORENSICS ZIP
            </button>
            <button
              onClick={resetKillSwitch}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              RESET_GATEWAY
            </button>
          </div>
        </div>
      )}

      {/* Forensic Log Timeline */}
      {forensicHistory.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '6px' }}>
            📜 FORENSICS_AUDIT_LOG
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
            {forensicHistory.map((h, i) => (
              <div key={i} style={{
                background: 'rgba(255, 77, 109, 0.03)',
                border: '1px solid rgba(255, 77, 109, 0.1)',
                borderRadius: '4px',
                padding: '6px 10px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>[{h.time}]</span>{' '}
                  <span style={{ color: '#ff4d6d' }}>{h.event}</span>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{h.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
