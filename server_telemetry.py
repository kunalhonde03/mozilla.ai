import os
import time
import random
import asyncio
import socketio
import uvicorn
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, AsyncOpenAI

# Initialize Socket.IO AsyncServer
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI()

# Wrap FastAPI app with Socket.io
asgi_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Initialize local Otari Client
# Initialize local Otari Client using AsyncOpenAI
# Initialize local Otari Client using AsyncOpenAI with 2 second timeout
openai_client = AsyncOpenAI(
    api_key="gw-owqwNWABLzLdR8TnxaT05qago3ERXTRzueDPVmMuonzM2CMLZkFxXt3d9vrgtuJF",
    base_url="http://127.0.0.1:8000/v1",
    timeout=2.0
)

LOG_FILE = "logs_stream.log"
current_budget = 0.42

# Cache to store the latest logs to send immediately to new clients
log_history = []
system_events = []
latest_stats = {
    "cpu": 40,
    "ram": 5.4,
    "disk": 0.8,
    "gateLatency": 10,
    "inferenceLatency": 25,
    "activeModel": "DeepSeek-1.5B (Local)"
}

# Check if log file exists, create empty if not
if not os.path.exists(LOG_FILE):
    with open(LOG_FILE, "w") as f:
        f.write("")

# Keywords indicating prompt injection/threat in logs
THREAT_KEYWORDS = ["ignore", "override", "rm -rf", "bypass", "hijack"]

def check_for_threat(log_line: str) -> bool:
    normalized = log_line.lower()
    return any(keyword in normalized for keyword in THREAT_KEYWORDS)

async def tail_log_stream():
    global current_budget, latest_stats
    # Read the last 5000 bytes (approx 30-40 lines) on startup so the cache is populated
    file_pointer = max(0, os.path.getsize(LOG_FILE) - 5000)
    
    print(f"Telemetry loop started. Tailing: {LOG_FILE} from pointer {file_pointer}")
    
    while True:
        await asyncio.sleep(1) # Check log file every second
        
        if not os.path.exists(LOG_FILE):
            continue
            
        current_size = os.path.getsize(LOG_FILE)
        if current_size < file_pointer:
            # File was truncated or rotated, reset pointer
            file_pointer = 0
            
        if current_size > file_pointer:
            with open(LOG_FILE, "r") as f:
                f.seek(file_pointer)
                lines = f.readlines()
                file_pointer = f.tell()
                
            for line in lines:
                line_str = line.strip()
                if not line_str:
                    continue
                
                # 1. Parse log properties
                now = datetime.now()
                timestamp_str = f"[{now.strftime('%Y-%m-%d %H:%M:%S')}]"
                is_injection = check_for_threat(line_str)
                
                # Extract clean message content
                raw_message = line_str
                if "]" in line_str:
                    parts = line_str.split("]", 2)
                    raw_message = parts[-1].strip()
                
                sanitized_message = raw_message
                inference_latency = 0
                
                # 2. If threat detected, perform instant local policy routing and sanitization
                if is_injection:
                    tag = "SECURITY_ALERT"
                    event_text = "PDP Decision: Blocked injection threat at Gateway [Node 04]"
                    event_type = "danger"
                    
                    start_time = time.time()
                    
                    # Instant local mapping for security warnings to keep the telemetry loop real-time
                    normalized_message = raw_message.lower()
                    if "override" in normalized_message or "limit" in normalized_message:
                        threat_desc = "System Prompt Bypass"
                    elif "rm -rf" in normalized_message or "command" in normalized_message:
                        threat_desc = "Remote Code Execution attempt"
                    elif "hijack" in normalized_message or "bypass" in normalized_message:
                        threat_desc = "Safety Filter Bypass"
                    else:
                        threat_desc = "Policy Bypass Attempt"
                        
                    sanitized_message = f"[BLOCKED: Intercepted prompt injection threat ({threat_desc})]"
                    # Simulate small processing delay of the gateway rule engine (e.g. 8ms)
                    await asyncio.sleep(0.008)
                    inference_latency = random.randint(8, 15)
                    cost = 0.005 # Cheap cost for blocked events
                else:
                    tag = "PDP_ROUTED"
                    event_text = "Router: Query verified. Sanitized output generated [Node 02]"
                    event_type = "info"
                    
                    # For normal logs, simulate a fast non-blocking delay instead of calling LLM, saving CPU load
                    await asyncio.sleep(random.uniform(0.02, 0.08))
                    inference_latency = random.randint(15, 30)
                    cost = random.random() * 0.05 + 0.01
                
                # 3. Update active budget wallet
                current_budget = min(2.0, current_budget + cost)
                
                # Emit budget update event
                await sio.emit("budget_update", {"spent": round(current_budget, 4)})
                
                # Emit log event details
                log_payload = {
                    "id": str(random.randint(100000, 999999)),
                    "timestamp": timestamp_str,
                    "raw": raw_message,
                    "sanitized": sanitized_message,
                    "isInjection": is_injection,
                    "tag": tag
                }
                
                # Cache log payload
                log_history.append(log_payload)
                if len(log_history) > 50:
                    log_history.pop(0)
                    
                await sio.emit("log_event", log_payload)
                
                # Emit system alert event
                event_payload = {
                    "id": str(random.randint(100000, 999999)),
                    "timestamp": timestamp_str,
                    "text": event_text,
                    "type": event_type
                }
                
                # Cache system event payload
                system_events.append(event_payload)
                if len(system_events) > 50:
                    system_events.pop(0)
                    
                await sio.emit("system_event", event_payload)
                
                # Emit hardware metrics and latencies
                gate_latency = random.randint(5, 12)
                stats_payload = {
                    "cpu": random.randint(35, 60),
                    "ram": round(5.2 + random.random() * 0.5, 1),
                    "disk": round(0.5 + random.random() * 3.0, 1),
                    "gateLatency": gate_latency,
                    "inferenceLatency": inference_latency if inference_latency > 0 else random.randint(20, 45),
                    "activeModel": "Llama-3-8B (Escalated)" if is_injection else "DeepSeek-1.5B (Local)"
                }
                latest_stats = stats_payload
                await sio.emit("hardware_stats", stats_payload)
                
                print(f"Emitted: {raw_message} -> isInjection: {is_injection}")

@sio.on('connect')
async def connect(sid, environ):
    print(f"Client connected: {sid}")
    # Instantly push budget to the connecting client
    await sio.emit("budget_update", {"spent": round(current_budget, 4)}, to=sid)
    # Instantly push active telemetry stats to the connecting client
    await sio.emit("hardware_stats", latest_stats, to=sid)
    # Instantly push log history cache to populate lists immediately
    for log in log_history:
        await sio.emit("log_event", log, to=sid)
    # Instantly push system events cache
    for sys_event in system_events:
        await sio.emit("system_event", sys_event, to=sid)

@sio.on('disconnect')
def disconnect(sid):
    print(f"Client disconnected: {sid}")

@app.on_event("startup")
async def startup_event():
    # Start tailing loop as a background task when FastAPI starts
    asyncio.create_task(tail_log_stream())

if __name__ == "__main__":
    uvicorn.run(asgi_app, host="127.0.0.1", port=5000)
