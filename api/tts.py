import asyncio
import base64
import json
import edge_tts
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = json.loads(self.rfile.read(length))
        
        text = body.get('text')
        voice_type = body.get('voice') # male or female or None
        role = body.get('role', 'A')
        speed_val = float(body.get('speed', '1.0'))

        # Voice Selection Logic
        if voice_type == 'female' or (not voice_type and role == 'B'):
            voice = "en-US-JennyNeural"
        else:
            voice = "en-US-GuyNeural"

        # Rate Selection (Speed)
        rate = f"{int((speed_val - 1.0) * 100):+d}%"

        async def gen():
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            audio = b""
            align = []
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
                elif chunk["type"] == "WordBoundary":
                    # Convert 100ns ticks to Seconds (offset / 1e7)
                    start_sec = chunk["offset"] / 10000000.0
                    end_sec = (chunk["offset"] + chunk["duration"]) / 10000000.0
                    align.append({
                        "word": chunk["text"],
                        "start": start_sec,
                        "end": end_sec
                    })
            return audio, align

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            audio_data, alignment = loop.run_until_complete(gen())

            res = {
                "audio": base64.b64encode(audio_data).decode('utf-8'),
                "alignment": alignment
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(res).encode())
        except Exception as e:
            self.send_response(500)
            self.wfile.write(str(e).encode())
