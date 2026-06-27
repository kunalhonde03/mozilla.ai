import os
import time
import random
import asyncio
import socketio
import uvicorn
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

# Initialize Socket.IO AsyncServer
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI()

# Wrap FastAPI app with Socket.io
asgi_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Initialize local Otari Client
openai_client = OpenAI(
    api_key="gw-owqwNWABLzLdR8TnxaT05qago3ERXTRzueDPVmMuonzM2CMLZkFxXt3d9vrgtuJF",
    base_url="http://127.0.0.1:8000/v1"
)

LOG_FILE = "logs_stream.log"
current_budget = 0.42

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
    global current_budget
    file_pointer = os.path.getsize(LOG_FILE)
    
    print(f"Telemetry loop started. Tailing: {LOG_FILE}")
    
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
                
                # 2. If threat detected, route through Otari for sanitization
                if is_injection:
                    tag = "SECURITY_ALERT"
                    event_text = "PDP Decision: Blocked injection threat at Gateway [Node 04]"
                    event_type = "danger"
                    
                    start_time = time.time()
                    try:
                        # Call local Otari model to generate explanation of security warning
                        response = openai_client.chat.completions.create(
                            model="openai:DeepSeek-R1-Distill-Qwen-1.5B",
                            messages=[
                                {"role": "system", "content": "You are a cloud guardrail. Analyze this malicious input and print a brief warning header."},
                                {"role": "user", "content": raw_message}
                            ],
                            max_tokens=30
                        )
                        sanitized_message = f"[BLOCKED: Intercepted prompt injection threat ({response.choices[0].message.content.strip()})]"
                    except Exception as e:
                        print(f"Error querying Otari: {e}")
                        sanitized_message = "[BLOCKED: Intercepted prompt injection threat (Policy Bypass Attempt)]"
                    
                    inference_latency = int((time.time() - start_time) * 1000)
                    cost = 0.005 # Cheap cost for blocked events
                else:
                    tag = "PDP_ROUTED"
                    event_text = "Router: Query verified. Sanitized output generated [Node 02]"
                    event_type = "info"
                    
                    # For normal queries, route to local Llamafile to simulate process completion
                    start_time = time.time()
                    try:
                        openai_client.chat.completions.create(
                            model="openai:DeepSeek-R1-Distill-Qwen-1.5B",
                            messages=[
                                {"role": "user", "content": raw_message}
                            ],
                            max_tokens=10
                        )
                    except Exception as e:
                        print(f"Error: {e}")
                    inference_latency = int((time.time() - start_time) * 1000)
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
                await sio.emit("log_event", log_payload)
                
                # Emit system alert event
                event_payload = {
                    "id": str(random.randint(100000, 999999)),
                    "timestamp": timestamp_str,
                    "text": event_text,
                    "type": event_type
                }
                await sio.emit("system_event", event_payload)
                
                # Emit hardware metrics and latencies
                gate_latency = random.randint(5, 12)
                stats_payload = {
                    "cpu": random.randint(35, 60),
                    "ram": round(5.2 + random.random() * 0.5, 1),
                    "disk": round(0.5 + random.random() * 3.0, 1),
                    "gateLatency": gate_latency,
                    "inferenceLatency": inference_latency if inference_latency > 0 else random.randint(20, 45)
                }
                await sio.emit("hardware_stats", stats_payload)
                
                print(f"Emitted: {raw_message} -> isInjection: {is_injection}")

@sio.on('connect')
def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.on('disconnect')
def disconnect(sid):
    print(f"Client disconnected: {sid}")

@app.on_event("startup")
async def startup_event():
    # Start tailing loop as a background task when FastAPI starts
    asyncio.create_task(tail_log_stream())

if __name__ == "__main__":
    uvicorn.run(asgi_app, host="127.0.0.1", port=5000)
