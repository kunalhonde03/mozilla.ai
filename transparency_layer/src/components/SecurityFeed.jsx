import React, { useState, useEffect, useRef } from 'react';
import { Shield, ShieldAlert, Trash2, Eye, EyeOff, Terminal } from 'lucide-react';
import socketService from '../services/socket';

export default function SecurityFeed() {
  const [logs, setLogs] = useState([]);
  const [injectionCount, setInjectionCount] = useState(0);
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  
  const rawContainerRef = useRef(null);
  const sanitizedContainerRef = useRef(null);

  useEffect(() => {
    // Subscribe to log stream events
    const unsubscribe = socketService.subscribe('logs', (newLog) => {
      setLogs(prev => {
        const updatedLogs = [...prev, newLog];
        if (updatedLogs.length > 50) updatedLogs.shift();
        return updatedLogs;
      });

      if (newLog.isInjection) {
        setInjectionCount(c => c + 1);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (rawContainerRef.current) {
      rawContainerRef.current.scrollTo({
        top: rawContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    if (sanitizedContainerRef.current) {
      sanitizedContainerRef.current.scrollTo({
        top: sanitizedContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
    setInjectionCount(0);
  };

  const filteredLogs = showBlockedOnly ? logs.filter(l => l.isInjection) : logs;

  // Format tags with appropriate terminal styling
  const renderTag = (tag) => {
    const isAlert = tag === 'SECURITY_ALERT';
    return (
      <span style={{ 
        background: isAlert ? 'rgba(255, 8, 68, 0.15)' : 'rgba(0, 242, 254, 0.1)',
        color: isAlert ? 'var(--neon-rose)' : 'var(--neon-blue)',
        border: `1px solid ${isAlert ? 'rgba(255, 8, 68, 0.25)' : 'rgba(0, 242, 254, 0.2)'}`,
        padding: '2px 5px',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        marginRight: '6px',
        display: 'inline-block'
      }}>
        {tag}
      </span>
    );
  };

  const highlightInjectionText = (text, isInjection) => {
    if (!isInjection) return <span style={{ color: 'var(--text-main)' }}>{text}</span>;
    
    // Extended pattern to match all realistic attack keywords in the new log pool
    const injectionPatterns = /(ignore all previous|ignore previous|system override|bypass|rm -rf|rfid|admin password|drop table|curl -X|jailbreak|dan with no|unrestricted terminal|forget you are|base64|multilingual|newline smuggling|disable_policy|grant_admin|token_budget=unlimited)/gi;
    const parts = text.split(injectionPatterns);
    
    if (parts.length === 1) return <span style={{ color: 'var(--neon-rose)', fontWeight: '500' }}>{text}</span>;

    return (
      <span style={{ color: 'var(--neon-rose)' }}>
        {parts.map((part, index) => {
          const isMatch = part.match(injectionPatterns);
          return isMatch ? (
            <strong key={index} style={{ 
              color: '#ff003c', 
              background: 'rgba(255, 8, 68, 0.25)',
              padding: '1px 3px',
              borderRadius: '2px',
              border: '1px solid rgba(255, 8, 68, 0.4)',
              textShadow: '0 0 8px rgba(255, 8, 68, 0.5)'
            }}>
              {part}
            </strong>
          ) : (
            part
          );
        })}
      </span>
    );
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '560px' }}>
      {/* Terminal Title Bar */}
      <div className="card-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px' }}>
        <div className="card-title" style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', letterSpacing: '0.5px' }}>
          <Terminal size={15} style={{ color: 'var(--neon-cyan)' }} />
          SYSTEM_BUS_SANITY_STREAM
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '10px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setShowBlockedOnly(!showBlockedOnly)}
          >
            {showBlockedOnly ? <Eye size={11} /> : <EyeOff size={11} />}
            {showBlockedOnly ? 'Show All' : 'Alerts Only'}
          </button>
          
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '10px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={clearLogs}
          >
            <Trash2 size={11} />
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Counter details */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        fontSize: '11px', 
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
        background: 'rgba(0,0,0,0.3)',
        padding: '6px 12px',
        borderRadius: '4px',
        margin: '10px 0',
        border: '1px solid rgba(255, 255, 255, 0.03)'
      }}>
        <div>FLOW_COUNT: {logs.length} packet(s)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ShieldAlert size={12} style={{ color: 'var(--neon-rose)' }} />
          <span>ALERT_TRIGGER_COUNT: <strong style={{ color: 'var(--neon-rose)' }}>{injectionCount}</strong></span>
        </div>
      </div>

      {/* Terminal Log Panes */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16px', 
        flexGrow: 1, 
        overflow: 'hidden' 
      }}>
        {/* RAW INGEST LOGS TERMINAL */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ 
            fontSize: '10px', 
            fontFamily: 'var(--font-mono)',
            fontWeight: '600', 
            color: 'var(--text-secondary)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--neon-blue)' }} />
            INGEST_CHANNEL_01 (RAW)
          </div>
          
          {/* Terminal Box */}
          <div 
            ref={rawContainerRef}
            style={{ 
              flexGrow: 1, 
              overflowY: 'auto', 
              background: '#040508', 
              borderRadius: '6px', 
              border: '1px solid rgba(255, 255, 255, 0.05)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.8)'
            }}
          >
            {filteredLogs.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                [Awaiting system ingress stream...]
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div 
                  key={`raw-${log.id}`} 
                  style={{ 
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: '1.6',
                    padding: '1px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px',
                    overflow: 'hidden'
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: '9px' }}>
                    {log.timestamp}
                  </span>
                  {renderTag(log.tag)}
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0
                  }}>
                    {highlightInjectionText(log.raw, log.isInjection)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SANITIZED EGRESS LOGS TERMINAL */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ 
            fontSize: '10px', 
            fontFamily: 'var(--font-mono)',
            fontWeight: '600', 
            color: 'var(--text-secondary)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--neon-green)' }} />
            EGRESS_CHANNEL_02 (EGRESS_PDP)
          </div>

          {/* Terminal Box */}
          <div 
            ref={sanitizedContainerRef}
            style={{ 
              flexGrow: 1, 
              overflowY: 'auto', 
              background: '#040508', 
              borderRadius: '6px', 
              border: '1px solid rgba(255, 255, 255, 0.05)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.8)'
            }}
          >
            {filteredLogs.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                [Awaiting system egress routing...]
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div 
                  key={`sanitized-${log.id}`} 
                  style={{ 
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: '1.6',
                    padding: '1px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px',
                    overflow: 'hidden'
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: '9px' }}>
                    {log.timestamp}
                  </span>
                  {renderTag(log.isInjection ? 'BLOCKED' : 'PDP_ROUTED')}
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                    color: log.isInjection ? 'var(--neon-rose)' : 'var(--neon-green)',
                    fontWeight: log.isInjection ? '700' : 'normal',
                    textShadow: log.isInjection ? '0 0 8px rgba(255, 8, 68, 0.2)' : 'none'
                  }}>
                    {log.sanitized}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
