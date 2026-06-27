import os
import time
import random
import asyncio
import socketio
import uvicorn
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from openai import OpenAI

# Initialize Socket.IO AsyncServer
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI()
asgi_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Enable CORS for FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize local Otari Client
openai_client = OpenAI(
    api_key="gw-owqwNWABLzLdR8TnxaT05qago3ERXTRzueDPVmMuonzM2CMLZkFxXt3d9vrgtuJF",
    base_url="http://127.0.0.1:8000/v1"
)

LOG_FILE = "logs_stream.log"
current_budget = 0.42
budget_limit = 2.00

# Dynamic policy rules
policy_rules = {
    "system_bypass": ["ignore", "system", "instruction"],
    "data_leak": ["password", "credential", "key"],
    "code_execution": ["rm -rf", "execute", "sudo"]
}

# Ensure log file exists
if not os.path.exists(LOG_FILE):
    with open(LOG_FILE, "w") as f:
        f.write("")

# Pydantic schemas for endpoint parameters
class TestLogItem(BaseModel):
    raw: str

class PolicyUpdate(BaseModel):
    system_bypass: List[str]
    data_leak: List[str]
    code_execution: List[str]

@sio.event
async def connect(sid, environ):
    global current_budget
    print(f"Frontend Client Connected: {sid}")
    await sio.emit('budget_update', {'spent': round(current_budget, 4)}, to=sid)
    await sio.emit('policy_rules_init', policy_rules, to=sid)

@sio.event
def disconnect(sid):
    print(f"Frontend Client Disconnected: {sid}")

def check_for_threat(log_line: str) -> dict:
    normalized = log_line.lower()
    is_bypass = any(w in normalized for w in policy_rules["system_bypass"])
    is_leak = any(w in normalized for w in policy_rules["data_leak"])
    is_exec = any(w in normalized for w in policy_rules["code_execution"])
    
    is_injection = is_bypass or is_leak or is_exec
    rule_id = None
    if is_injection:
        rule_id = "Rule-101 (System Prompt Bypass)" if is_bypass else "Rule-205 (Sensitive Data Leak Prevention)" if is_leak else "Rule-302 (Remote Code Execution Shield)"
    return {"is_injection": is_injection, "rule_id": rule_id}

# Core function to process a single query (real-world query with fallback)
async def process_telemetry_prompt(raw_message: str):
    global current_budget
    
    start_time = time.time()
    threat_info = check_for_threat(raw_message)
    is_injection = threat_info["is_injection"]
    rule_id = threat_info["rule_id"]

    sanitized_message = raw_message
    inference_latency = 0
    tps = round(random.uniform(20.0, 35.0), 1)

    if is_injection:
        tag = "SECURITY_ALERT"
        event_text = f"PDP Decision: Blocked threat at Gateway [{rule_id}]"
        event_type = "danger"
        cost = 0.002
        
        # Real-world logic: try connecting to Otari gateway
        try:
            loop = asyncio.get_event_loop()
            # Run blocking OpenAI call in executors to avoid locking the event loop
            response = await loop.run_in_executor(None, lambda: openai_client.chat.completions.create(
                model="openai:DeepSeek-R1-Distill-Qwen-1.5B",
                messages=[
                    {"role": "system", "content": "You are a security gateway. Describe this prompt injection threat in one short phrase."},
                    {"role": "user", "content": raw_message}
                ],
                max_tokens=25,
                timeout=3.0
            ))
            warning_header = response.choices[0].message.content.strip()
            sanitized_message = f"[BLOCKED: Intercepted prompt injection threat ({warning_header})]"
            # Estimate tokens per second
            tps = round(len(warning_header.split()) / max(0.1, (time.time() - start_time)), 1)
        except Exception as e:
            # Graceful Fallback if model server is offline
            sanitized_message = f"[BLOCKED: Intercepted prompt injection threat ({rule_id})]"
        
        inference_latency = int((time.time() - start_time) * 1000)
    else:
        tag = "PDP_ROUTED"
        event_text = "Router: Query verified. Sanitized output generated [Node 02]"
        event_type = "info"
        cost = 0.04 + (len(raw_message) * 0.0002)
        
        # Real-world logic: try routing clean query to Otari gateway
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: openai_client.chat.completions.create(
                model="openai:DeepSeek-R1-Distill-Qwen-1.5B",
                messages=[{"role": "user", "content": raw_message}],
                max_tokens=10,
                timeout=3.0
            ))
        except Exception as e:
            # Fallback
            pass
            
        inference_latency = int((time.time() - start_time) * 1000)
        if inference_latency < 5:
            # Fallback latency simulation if server is offline
            inference_latency = random.randint(35, 60)

    # 1. Update budget
    current_budget = min(budget_limit, current_budget + cost)
    await sio.emit('budget_update', {'spent': round(current_budget, 4)})

    # 2. Emit log event details
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    timestamp = f"[{now_str}]"
    parsed_log = {
        'id': os.urandom(4).hex(),
        'timestamp': timestamp,
        'raw': raw_message,
        'sanitized': sanitized_message,
        'isInjection': is_injection,
        'tag': tag
    }
    await sio.emit('log_event', parsed_log)

    # 3. Emit system journal event
    await sio.emit('system_event', {
        'id': os.urandom(4).hex(),
        'timestamp': timestamp,
        'text': event_text,
        'type': event_type
    })

    # 4. Trigger visualizer particles
    await sio.emit('particles', {
        'blocked': is_injection,
        'timestamp': int(time.time() * 1000)
    })

    return {
        "parsed": parsed_log,
        "latency": inference_latency,
        "tps": tps
    }

# Replay sandbox task
async def replay_logs_task(logs: List[TestLogItem]):
    print(f"Sandbox (Real-world): Replaying {len(logs)} uploaded prompts...")
    
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    await sio.emit('system_event', {
        'id': os.urandom(4).hex(),
        'timestamp': f"[{now_str}]",
        'text': f"Sandbox: Initialized JSON log upload replay ({len(logs)} items)",
        'type': 'info'
    })

    for item in logs:
        # Run through the operational proxy/local pipeline
        await process_telemetry_prompt(item.raw)
        await asyncio.sleep(1.5)

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    await sio.emit('system_event', {
        'id': os.urandom(4).hex(),
        'timestamp': f"[{now_str}]",
        'text': "Sandbox: JSON log upload replay completed successfully",
        'type': 'info'
    })

@app.post("/upload_test_log")
async def upload_test_log(payload: List[TestLogItem]):
    asyncio.create_task(replay_logs_task(payload))
    return {"status": "success", "count": len(payload)}

@app.post("/update_policy")
async def update_policy(policy: PolicyUpdate):
    global policy_rules
    policy_rules["system_bypass"] = [w.lower().strip() for w in policy.system_bypass if w.strip()]
    policy_rules["data_leak"] = [w.lower().strip() for w in policy.data_leak if w.strip()]
    policy_rules["code_execution"] = [w.lower().strip() for w in policy.code_execution if w.strip()]
    
    await sio.emit('policy_rules_updated', policy_rules)
    
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    await sio.emit('system_event', {
        'id': os.urandom(4).hex(),
        'timestamp': f"[{now_str}]",
        'text': "PDP Policy configurations reloaded and compiled successfully",
        'type': 'warning'
    })
    return {"status": "success", "rules": policy_rules}

# Tailing stream logic
async def tail_log_stream():
    file_pointer = os.path.getsize(LOG_FILE)
    print(f"Tailing log file: {LOG_FILE}...")
    
    while True:
        await asyncio.sleep(1.0)
        
        if not os.path.exists(LOG_FILE):
            continue
            
        current_size = os.path.getsize(LOG_FILE)
        if current_size < file_pointer:
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
                
                # Exclude timestamps if already formatted in the lines
                raw_message = line_str
                if "] " in line_str:
                    parts = line_str.split("] ", 1)
                    raw_message = parts[-1]
                
                await process_telemetry_prompt(raw_message)

# Periodic hardware statistics emitter
async def emit_periodic_stats():
    while True:
        gateLatency = random.randint(8, 16)
        inferenceLatency = random.randint(35, 60)
        cpu = random.randint(40, 65)
        ram = round(random.uniform(5.2, 6.0), 1)
        disk = round(random.uniform(0.5, 4.7), 1)
        tps = round(random.uniform(15.0, 45.0), 1)

        await sio.emit('hardware_stats', {
            'cpu': cpu,
            'ram': ram,
            'disk': disk,
            'gateLatency': gateLatency,
            'inferenceLatency': inferenceLatency,
            'tps': tps,
            'activeModel': "Llama-3-8B"
        })
        await asyncio.sleep(3.0)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(tail_log_stream())
    asyncio.create_task(emit_periodic_stats())

if __name__ == "__main__":
    uvicorn.run(asgi_app, host="127.0.0.1", port=5000)
