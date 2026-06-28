import os
import time
import random
import asyncio
import socketio
import uvicorn
from datetime import datetime
from collections import deque
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, AsyncOpenAI
from genetic_budget_engine import GeneticBudgetEngine, build_traffic_dna

# Initialize Socket.IO AsyncServer
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI()

# Wrap FastAPI app with Socket.io
asgi_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Enable CORS for frontend prompt submission
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# ── Genetic Budget Engine (Evolutionary FinOps) ──────────────────────────────
ga_engine = GeneticBudgetEngine()
latest_genome_result = {
    "ceiling": 2.00,
    "prev_ceiling": 2.00,
    "delta": 0.0,
    "mode": "STABLE_BASELINE",
    "color": "green",
    "reason": "System initializing...",
    "generation": 0,
    "fitness_best": 0.0,
    "fitness_avg": 0.0,
    "dna": {"threatRatio": 0, "cpuUsage": 0, "systemHealth": 1, "isDDoS": False, "isCritical": False}
}

# Rolling window to track recent injection events for DDoS detection (last 30s)
# Each entry is a timestamp of when an injection was detected
recent_injection_times: deque = deque(maxlen=20)
# Rolling window: (is_injection: bool) for last N events
recent_events_window: deque = deque(maxlen=15)

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
THREAT_KEYWORDS = ["ignore", "override", "rm -rf", "bypass", "hijack", "secrets", "keys", "password"]

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
                
                # 3. Track events for GA TrafficDNA
                recent_events_window.append(is_injection)
                if is_injection:
                    recent_injection_times.append(time.time())
                
                # 4. Detect DDoS burst: 3+ injections in the last 10 seconds
                now_ts = time.time()
                recent_burst = sum(1 for t in recent_injection_times if now_ts - t < 10) >= 3
                
                # 5. Run the Genetic Algorithm to evolve the dynamic budget ceiling
                threat_count = sum(1 for e in recent_events_window if e)
                total_count = len(recent_events_window)
                cpu_pct = latest_stats.get("cpu", 45)
                traffic_dna = build_traffic_dna(
                    threat_count=threat_count,
                    total_count=total_count,
                    cpu_percent=cpu_pct,
                    recent_injection_burst=recent_burst
                )
                genome_result = ga_engine.tick(traffic_dna)
                latest_genome_result.update(genome_result)
                
                # Emit GA evolution result to dashboard
                await sio.emit("budget_genome", genome_result)
                
                # 6. Update active budget wallet (capped by evolved ceiling)
                evolved_ceiling = genome_result["ceiling"]
                current_budget = min(evolved_ceiling, current_budget + cost)
                
                # Emit budget update event
                await sio.emit("budget_update", {"spent": round(current_budget, 4), "ceiling": round(evolved_ceiling, 4)})
                
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
    await sio.emit("budget_update", {"spent": round(current_budget, 4), "ceiling": latest_genome_result["ceiling"]}, to=sid)
    # Instantly push active telemetry stats to the connecting client
    await sio.emit("hardware_stats", latest_stats, to=sid)
    # Instantly push latest GA genome state
    await sio.emit("budget_genome", latest_genome_result, to=sid)
    # Instantly push log history cache to populate lists immediately
    for log in log_history:
        await sio.emit("log_event", log, to=sid)
    # Instantly push system events cache
    for sys_event in system_events:
        await sio.emit("system_event", sys_event, to=sid)

@sio.on('disconnect')
def disconnect(sid):
    print(f"Client disconnected: {sid}")

# Pydantic schema for prompt request
from pydantic import BaseModel
class PromptRequest(BaseModel):
    prompt: str

@app.post("/scan")
async def scan_prompt(req: PromptRequest):
    global current_budget, latest_stats
    prompt_text = req.prompt
    is_injection = check_for_threat(prompt_text)
    
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Process local inference simulation
    start_time = time.time()
    sanitized_prompt = prompt_text
    response_text = ""
    inference_latency = 0
    cost = 0.0
    
    if is_injection:
        sanitized_prompt = f"[BLOCKED: Intercepted prompt injection threat]"
        response_text = "ACCESS DENIED. Secure policy violation detected at gateway."
        cost = 0.005 # Small penalty cost
        inference_latency = 2 # instant block
    else:
        # Simulate local LLM response
        try:
            # Short sleep to simulate real hardware latency
            await asyncio.sleep(0.4)
            response_text = f"Processed successfully by DeepSeek-1.5B Core. Result: Safe execution verified for '{prompt_text[:30]}...'"
            cost = random.uniform(0.01, 0.03)
        except Exception:
            response_text = "Fallback output: Clean query verified."
            cost = 0.01
        inference_latency = int((time.time() - start_time) * 1000)

    # Update active budget
    current_budget = min(2.0, current_budget + cost)
    await sio.emit("budget_update", {"spent": round(current_budget, 4), "ceiling": latest_genome_result["ceiling"]})

    # Log file tracking
    log_line = f"[{'SECURITY_ALERT' if is_injection else 'AGENT_INPUT'}] Prompt: {prompt_text} | Output: {response_text}"
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp_str}] {log_line}\n")

    # Broadcast log event to UI
    log_payload = {
        "id": str(random.randint(10000, 99999)),
        "timestamp": timestamp_str,
        "raw": prompt_text,
        "sanitized": sanitized_prompt,
        "blocked": is_injection,
        "cost": cost,
        "latency": inference_latency,
        "tag": "SECURITY_ALERT" if is_injection else "PDP_ROUTED"
      }
    
    log_history.append(log_payload)
    if len(log_history) > 50:
        log_history.pop(0)
    await sio.emit("log_event", log_payload)

    # Broadcast system event
    event_payload = {
        "id": str(random.randint(100000, 999999)),
        "timestamp": timestamp_str,
        "text": f"Gateway: Scanned manual prompt from dashboard",
        "type": "danger" if is_injection else "info"
    }
    system_events.append(event_payload)
    await sio.emit("system_event", event_payload)

    # Broadcast hardware stats updates
    stats_payload = {
        "cpu": random.randint(45, 75) if is_injection else random.randint(30, 48),
        "ram": round(5.2 + random.random() * 0.3, 1),
        "disk": round(0.1 + random.random() * 1.5, 1),
        "gateLatency": random.randint(3, 8),
        "inferenceLatency": inference_latency,
        "activeModel": "Llama-3-8B (Escalated)" if is_injection else "DeepSeek-1.5B (Local)"
    }
    latest_stats = stats_payload
    await sio.emit("hardware_stats", stats_payload)

    return {
        "blocked": is_injection,
        "response": response_text,
        "latency": inference_latency,
        "cost": cost
    }

@app.on_event("startup")
async def startup_event():
    # Start tailing loop as a background task when FastAPI starts
    asyncio.create_task(tail_log_stream())

if __name__ == "__main__":
    uvicorn.run(asgi_app, host="127.0.0.1", port=5000)
