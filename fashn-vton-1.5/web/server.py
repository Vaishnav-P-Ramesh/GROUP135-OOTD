#!/usr/bin/env python3
"""
OOTD web server — landing + studio wired to OOTD Model.
Uses Python stdlib HTTP server + PIL (no extra web framework).
"""

import base64
import io
import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from PIL import Image

# Add src to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

pipeline = None

def get_pipeline():
    global pipeline
    if pipeline is None:
        from fashn_vton import TryOnPipeline
        weights_dir = REPO_ROOT / "weights"
        print(f"Loading TryOnPipeline from {weights_dir}...")
        pipeline = TryOnPipeline(weights_dir=str(weights_dir))
        print("Pipeline loaded successfully!")
    return pipeline


def decode_base64_image(data_url: str) -> Image.Image:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    image_bytes = base64.b64decode(data_url)
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def encode_image_base64(img: Image.Image) -> str:
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    b64_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"


DIST_ROOT = REPO_ROOT.parent / "frontend" / "dist"

class StudioHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict):
        response = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/sample/person":
            sample_path = REPO_ROOT / "examples" / "data" / "model.webp"
            content = sample_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/webp")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        elif self.path == "/api/sample/garment":
            sample_path = REPO_ROOT / "examples" / "data" / "garment.webp"
            content = sample_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/webp")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        else:
            # Serve built React SPA if available, fallback to legacy web/
            clean_path = self.path.split("?")[0].lstrip("/")
            target = None
            if DIST_ROOT.exists():
                candidate = (DIST_ROOT / clean_path).resolve()
                if candidate.is_file() and str(candidate).startswith(str(DIST_ROOT.resolve())):
                    target = candidate
                elif (DIST_ROOT / "index.html").exists():
                    target = DIST_ROOT / "index.html"
            
            if not target:
                legacy = (REPO_ROOT / "web" / ("index.html" if not clean_path else clean_path)).resolve()
                if legacy.is_file():
                    target = legacy

            if target and target.is_file():
                content = target.read_bytes()
                mime, _ = mimetypes.guess_type(str(target))
                self.send_response(200)
                self.send_header("Content-Type", mime or "application/octet-stream")
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "Not Found")

    def do_POST(self):
        if self.path == "/api/tryon":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length).decode("utf-8")
                payload = json.loads(body)

                person_img = decode_base64_image(payload["person_image"])
                garment_img = decode_base64_image(payload["garment_image"])
                category = payload.get("category", "tops")
                garment_photo_type = payload.get("garment_photo_type", "model")
                num_timesteps = int(payload.get("num_timesteps", 20))

                pipe = get_pipeline()
                print(f"Running virtual try-on ({category}, {garment_photo_type}, {num_timesteps} steps)...")
                
                result = pipe(
                    person_image=person_img,
                    garment_image=garment_img,
                    category=category,
                    garment_photo_type=garment_photo_type,
                    num_timesteps=num_timesteps,
                    num_samples=1,
                    guidance_scale=1.5,
                )

                output_image = result.images[0]
                
                # Save to disk as well
                output_dir = REPO_ROOT / "outputs"
                output_dir.mkdir(exist_ok=True)
                output_file = output_dir / "latest_tryon.png"
                output_image.save(output_file)

                # Return base64 for immediate display
                b64_output = encode_image_base64(output_image)
                self._send_json(200, {"success": True, "output_image": b64_output})

            except Exception as e:
                import traceback
                traceback.print_exc()
                self._send_json(500, {"error": str(e)})
        else:
            self.send_error(404, "Not Found")


def run(port: int = 7860):
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, StudioHandler)
    print(f"\n=======================================================")
    print(f" FASHN VTON 1.5 Studio running at: http://localhost:{port}")
    print(f"=======================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 7860
    run(port)
