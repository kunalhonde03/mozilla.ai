import React, { useState, useRef } from 'react';
import { Upload, X, Play, RefreshCw, FileText, CheckCircle } from 'lucide-react';
import socketService from '../services/socket';

export default function SandboxModal({ isOpen, onClose }) {
  const [dragActive, setDragActive] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processJsonFile = (file) => {
    setErrorMsg('');
    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      setErrorMsg("Invalid file type. Please upload a .json file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        
        // Validate schema: must be an array of objects
        if (!Array.isArray(json)) {
          throw new Error("JSON must be a list/array of items.");
        }
        
        const validated = json.map((item, idx) => {
          // If it's a string, wrap it. Otherwise check for raw key
          if (typeof item === 'string') {
            return { raw: item };
          }
          if (typeof item === 'object' && item !== null && (item.raw || item.text)) {
            return { raw: item.raw || item.text };
          }
          throw new Error(`Item index ${idx} is invalid. Must be a string or have a 'raw' field.`);
        });

        setFileData(validated);
      } catch (err) {
        setErrorMsg(`JSON validation error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processJsonFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processJsonFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const runReplay = async () => {
    if (!fileData || fileData.length === 0) return;
    
    setReplaying(true);
    setReplayProgress(0);

    // If connected to a live socket backend, trigger backend replay
    if (!socketService.useSimulation && socketService.socket?.connected) {
      try {
        const response = await fetch(`${socketService.backendUrl}/upload_test_log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fileData)
        });
        
        if (response.ok) {
          // The backend will stream events via Socket.io, frontend will receive it
          console.log("Sandbox logs uploaded successfully to backend for streaming");
          // Fake local progress tracker for the modal UI
          let current = 0;
          const interval = setInterval(() => {
            current += 1;
            setReplayProgress(current);
            if (current >= fileData.length) {
              clearInterval(interval);
              setReplaying(false);
            }
          }, 1500);
          return;
        }
      } catch (err) {
        console.warn("Backend sandbox upload failed, falling back to local replay simulation:", err);
      }
    }

    // Client-side simulation fallback: loop and feed logs locally
    let index = 0;
    let budgetSpent = socketService.currentBudget;
    
    // Add start notification in system events
    const startStr = `[${new Date().toLocaleTimeString()}]`;
    socketService.listeners.events?.forEach(cb => cb({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: startStr,
      text: `Sandbox (Local): Initialized JSON log upload replay (${fileData.length} items)`,
      type: 'info'
    }));

    const interval = setInterval(() => {
      if (index >= fileData.length) {
        clearInterval(interval);
        setReplaying(false);
        // Add complete notification
        socketService.listeners.events?.forEach(cb => cb({
          id: Math.random().toString(36).substr(2, 9),
          timestamp: `[${new Date().toLocaleTimeString()}]`,
          text: "Sandbox (Local): JSON log upload replay completed successfully",
          type: 'info'
        }));
        return;
      }

      const prompt = fileData[index].raw;
      const isInjection = prompt.includes("CRITICAL") || prompt.toLowerCase().includes('injection') || prompt.toLowerCase().includes('bypass') || prompt.toLowerCase().includes('ignore');
      
      let sanitized = prompt;
      let cost = 0.04;
      if (isInjection) {
        sanitized = "[BLOCKED: Intercepted prompt injection threat]";
        cost = 0.002;
      }

      budgetSpent = Math.min(2.0, budgetSpent + cost);
      
      const nowStr = `[${new Date().toLocaleTimeString()}]`;
      const parsedLog = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: nowStr,
        raw: prompt,
        sanitized: sanitized,
        isInjection: isInjection,
        tag: isInjection ? 'SECURITY_ALERT' : 'PDP_ROUTED'
      };

      // Push states to update visualizers, counters, and feeds
      socketService.emitBudget(Number(budgetSpent.toFixed(4)));
      socketService.emitLog(parsedLog);
      
      // Update journal event
      const eventText = isInjection 
        ? `Sandbox (Local) Decision: Blocked injection threat at Gateway` 
        : `Sandbox (Local): Query verified and routed successfully`;
      
      socketService.listeners.events?.forEach(cb => cb({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: nowStr,
        text: eventText,
        type: isInjection ? 'danger' : 'info'
      }));

      index += 1;
      setReplayProgress(index);
    }, 1500);
  };

  const clearFile = () => {
    setFileData(null);
    setReplayProgress(0);
    setErrorMsg('');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(5, 6, 8, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '520px',
        background: 'var(--bg-card-solid)',
        border: '1px solid var(--border-neon)',
        boxShadow: '0 0 30px rgba(0, 242, 254, 0.15)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          disabled={replaying}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Upload size={18} style={{ color: 'var(--neon-cyan)' }} />
          <h3 style={{ margin: 0, letterSpacing: '0.5px' }}>Developer Sandbox Console</h3>
        </div>
        
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
          Upload custom JSON datasets of request vectors (prompt injections or standard queries) to replay them and test the security enforcer gateway pipeline.
        </p>

        {/* Drag & Drop Target Area */}
        {!fileData ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            style={{
              border: `2px dashed ${dragActive ? 'var(--neon-cyan)' : 'var(--border-medium)'}`,
              background: dragActive ? 'rgba(0, 242, 254, 0.05)' : 'rgba(0,0,0,0.2)',
              borderRadius: '8px',
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
          >
            <input 
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleChange}
            />
            <Upload size={32} style={{ color: dragActive ? 'var(--neon-cyan)' : 'var(--text-secondary)', margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>
              Drag & drop test log JSON file here
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              or click to browse local files
            </div>
          </div>
        ) : (
          /* File Loaded Verification Block */
          <div style={{
            background: 'rgba(0, 245, 160, 0.03)',
            border: '1px solid rgba(0, 245, 160, 0.2)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileText size={24} style={{ color: 'var(--neon-green)' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Test Dataset Loaded</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{fileData.length} request vectors parsed</div>
              </div>
            </div>
            {!replaying && (
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '10px', padding: '4px 8px' }}
                onClick={clearFile}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Errors */}
        {errorMsg && (
          <div style={{
            background: 'rgba(255, 8, 68, 0.05)',
            border: '1px solid rgba(255, 8, 68, 0.2)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '11px',
            color: 'var(--neon-rose)',
            fontFamily: 'var(--font-mono)'
          }}>
            {errorMsg}
          </div>
        )}

        {/* Replay progress indicator */}
        {replaying && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span>Streaming Replay Progress</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>{replayProgress} / {fileData.length} items</span>
            </div>
            <div style={{ height: '4px', width: '100%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${(replayProgress / fileData.length) * 100}%`, 
                backgroundColor: 'var(--neon-green)',
                boxShadow: '0 0 8px var(--neon-green)',
                transition: 'width 0.3s ease-out'
              }} />
            </div>
          </div>
        )}

        {/* Modal Controls */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'end', marginTop: '10px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={replaying}
          >
            Cancel
          </button>
          
          <button 
            className="btn" 
            disabled={!fileData || replaying} 
            onClick={runReplay}
            style={{
              opacity: (!fileData || replaying) ? 0.5 : 1,
              cursor: (!fileData || replaying) ? 'not-allowed' : 'pointer'
            }}
          >
            <Play size={14} />
            Run Replay
          </button>
        </div>
      </div>
    </div>
  );
}
