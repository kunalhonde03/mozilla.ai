import React, { useState, useEffect, useRef } from 'react';
import { Activity, ShieldAlert, Cpu, Layers } from 'lucide-react';
import socketService from '../services/socket';

export default function EventsLog() {
  const [events, setEvents] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    // Subscribe to system event stream
    const unsubscribe = socketService.subscribe('events', (newEvent) => {
      setEvents(prev => {
        const updated = [...prev, newEvent];
        // Keep last 30 entries
        if (updated.length > 30) updated.shift();
        return updated;
      });
    });

    return () => unsubscribe();
  }, []);

  // Auto scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [events]);

  const getEventIcon = (text) => {
    if (text.includes('Blocked') || text.includes('ALERT')) {
      return <ShieldAlert size={12} style={{ color: 'var(--neon-rose)' }} />;
    }
    if (text.includes('Escalated') || text.includes('Model')) {
      return <Layers size={12} style={{ color: 'var(--neon-yellow)' }} />;
    }
    return <Cpu size={12} style={{ color: 'var(--neon-cyan)' }} />;
  };

  return (
    <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', height: '140px', overflow: 'hidden' }}>
      <div className="card-header" style={{ marginBottom: '6px', borderBottom: 'none', paddingBottom: '0' }}>
        <div className="card-title" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={12} style={{ color: 'var(--neon-cyan)' }} />
          SYSTEM_EVENT_JOURNAL.log
        </div>
        <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          STREAM: ACTIVE
        </div>
      </div>

      <div 
        ref={containerRef}
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          background: '#040508',
          borderRadius: '4px',
          padding: '8px 10px',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)'
        }}
      >
        {events.length === 0 ? (
          <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            [Awaiting system journal log entries...]
          </div>
        ) : (
          events.map((ev) => {
            const isDanger = ev.text.includes('Blocked') || ev.text.includes('ALERT');
            return (
              <div 
                key={`ev-${ev.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  lineHeight: '1.3',
                  padding: '2px 0',
                  color: isDanger ? 'var(--neon-rose)' : 'var(--text-main)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.01)'
                }}
              >
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{ev.timestamp}</span>
                <span style={{ display: 'inline-flex', flexShrink: 0 }}>{getEventIcon(ev.text)}</span>
                <span style={{ wordBreak: 'break-all' }}>{ev.text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
