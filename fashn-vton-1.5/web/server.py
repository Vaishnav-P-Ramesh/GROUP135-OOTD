#!/usr/bin/env python3
"""
OOTD web server — landing + studio wired to OOTD Model.
Uses Python stdlib HTTP server + PIL (no extra web framework).
"""

import base64
import io
import json
import os
import re
import sys
import urllib.request
import urllib.error
import urllib.parse
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


def fetch_garment_from_url(url: str) -> str:
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=14) as resp:
        content_type = resp.headers.get("Content-Type", "").lower()
        data = resp.read()

    clean_url_path = url.lower().split("?")[0]
    is_direct_img = any(content_type.startswith(t) for t in ["image/", "application/octet-stream"]) or any(
        clean_url_path.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"]
    )

    if is_direct_img:
        img_bytes = data
    else:
        html = data.decode("utf-8", errors="ignore")
        m = re.search(r'<meta\s+[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', html, re.I)
        if not m:
            m = re.search(r'<meta\s+[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', html, re.I)
        if not m:
            m = re.search(r'<meta\s+[^>]*property=["\']og:image:secure_url["\'][^>]*content=["\']([^"\']+)["\']', html, re.I)
        if not m:
            m = re.search(r'<meta\s+[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']', html, re.I)
        if not m:
            m = re.search(r'<meta\s+[^>]*name=["\']twitter:image:src["\'][^>]*content=["\']([^"\']+)["\']', html, re.I)
        if not m:
            m = re.search(r'<link\s+[^>]*rel=["\']image_src["\'][^>]*href=["\']([^"\']+)["\']', html, re.I)

        if not m:
            json_ld_matches = re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL | re.I)
            for jld in json_ld_matches:
                try:
                    parsed = json.loads(jld)
                    if isinstance(parsed, dict) and "image" in parsed:
                        img_val = parsed["image"]
                        if isinstance(img_val, str) and img_val.strip():
                            m = type("Match", (), {"group": lambda self, n: img_val.strip()})()
                            break
                        elif isinstance(img_val, list) and len(img_val) > 0 and isinstance(img_val[0], str):
                            m = type("Match", (), {"group": lambda self, n: img_val[0].strip()})()
                            break
                except Exception:
                    pass

        if not m:
            img_matches = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html, re.I)
            candidates = [img for img in img_matches if any(k in img.lower() for k in ["product", "large", "zoom", "detail", "item", "main"])]
            if candidates:
                m = type("Match", (), {"group": lambda self, n: candidates[0]})()
            elif img_matches:
                valid_imgs = [img for img in img_matches if not any(img.lower().endswith(ext) for ext in [".svg", ".ico", ".gif"])]
                if valid_imgs:
                    m = type("Match", (), {"group": lambda self, n: valid_imgs[0]})()

        if m:
            extracted_img_url = urllib.parse.urljoin(url, m.group(1).replace("&amp;", "&"))
            img_req = urllib.request.Request(extracted_img_url, headers=headers)
            with urllib.request.urlopen(img_req, timeout=14) as img_resp:
                img_bytes = img_resp.read()
        else:
            raise ValueError("Could not extract a clothing image from this store page. Try pasting a direct image link.")

    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    max_dim = 1200
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    out_buf = io.BytesIO()
    img.save(out_buf, format="JPEG", quality=92)
    b64 = base64.b64encode(out_buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"
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

        elif self.path == "/api/stylist/chat":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length).decode("utf-8")
                payload = json.loads(body)

                user_message = payload.get("message", "How do I style this outfit?")
                image_data = payload.get("image", None)
                api_key = payload.get("apiKey") or os.environ.get("GEMINI_API_KEY")

                if not api_key:
                    self._send_json(400, {
                        "error": "No Gemini API key provided. Please provide your Gemini API key in the stylist panel or set the GEMINI_API_KEY environment variable."
                    })
                    return

                # Construct Gemini request
                system_instruction = (
                    "You are Aura, an elite, chic, and encouraging personal fashion stylist and image consultant for OOTD. "
                    "TONE & STYLE RULES: "
                    "1. Sound natural, chic, and discerning, like a top-tier personal stylist. "
                    "2. If asked to rate or critique an outfit, format strictly as follows:\n"
                    "Rating: X/10\n\n"
                    "• What Works: 1 concise sentence highlighting what is right (color, silhouette, vibe).\n"
                    "• What Needs Work: 1 concise sentence explaining what is wrong (proportions, contrast, footwear clash).\n"
                    "• Quick Fix: 1 actionable sentence to instantly elevate the look.\n"
                    "3. If asked for specific styling elements (jewelry, shoes, bags, colors), answer strictly for those items without forcing unrelated categories. "
                    "4. If listing multiple elements or recommendations, place each item on its own separate line starting with '• '. "
                    "5. ABSOLUTELY NEVER use markdown asterisks (no '**', no '*'). Plain natural text only. "
                    "6. Keep total output very concise and scannable."
                )

                parts = []
                if image_data:
                    # If it's a relative URL or local path, convert to base64
                    base64_content = None
                    mime_type = "image/png"

                    if image_data.startswith("data:"):
                        if ";base64," in image_data:
                            header, base64_content = image_data.split(";base64,", 1)
                            mime_type = header.replace("data:", "")
                    elif image_data.startswith("/api/sample/"):
                        sample_file = "model.webp" if "person" in image_data else "garment.webp"
                        target_p = REPO_ROOT / "examples" / "data" / sample_file
                        if target_p.is_file():
                            base64_content = base64.b64encode(target_p.read_bytes()).decode("utf-8")
                            mime_type = "image/webp"
                    elif image_data.startswith("assets/sample-") or image_data.startswith("/assets/sample-"):
                        # Support landing page assets if passed
                        clean_fname = os.path.basename(image_data)
                        target_p = REPO_ROOT.parent / "frontend" / "public" / "assets" / clean_fname
                        if target_p.is_file():
                            base64_content = base64.b64encode(target_p.read_bytes()).decode("utf-8")
                            mime_type = "image/webp"

                    if base64_content:
                        parts.append({
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64_content
                            }
                        })

                parts.append({"text": user_message})

                req_body = {
                    "contents": [{
                        "role": "user",
                        "parts": parts
                    }],
                    "systemInstruction": {
                        "parts": [{"text": system_instruction}]
                    },
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 800
                    }
                }

                # Comprehensive fallback list prioritized by lowest latency and current free tier availability
                fallback_models = [
                    "gemini-3.1-flash-lite",
                    "gemini-3-flash-preview",
                    "gemini-3.5-flash-lite",
                    "gemini-flash-lite-latest",
                    "gemini-3.8-flash",
                    "gemini-3.5-flash",
                    "gemini-flash-latest",
                    "gemini-2.5-flash"
                ]

                reply_text = ""
                last_error = None

                for model_name in fallback_models:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                    req = urllib.request.Request(
                        url,
                        data=json.dumps(req_body).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    )
                    try:
                        with urllib.request.urlopen(req, timeout=15) as response:
                            res_data = json.loads(response.read().decode("utf-8"))
                            candidates = res_data.get("candidates", [])
                            if candidates:
                                parts_out = candidates[0].get("content", {}).get("parts", [])
                                reply_text = "".join([p.get("text", "") for p in parts_out])
                            if reply_text:
                                print(f"Successfully answered using model: {model_name}")
                                break
                    except urllib.error.HTTPError as http_err:
                        last_error = http_err.read().decode("utf-8", errors="ignore")
                        print(f"Model {model_name} returned {http_err.code}, falling back to next available model...")
                        continue
                    except Exception as err:
                        last_error = str(err)
                        print(f"Model {model_name} error: {err}, falling back to next available model...")
                        continue

                # If fixed list fails, dynamically fetch all models supporting generateContent
                if not reply_text:
                    try:
                        list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                        with urllib.request.urlopen(list_url, timeout=10) as l_resp:
                            m_data = json.loads(l_resp.read().decode("utf-8"))
                            dynamic_candidates = [
                                m["name"].replace("models/", "")
                                for m in m_data.get("models", [])
                                if "generateContent" in m.get("supportedGenerationMethods", [])
                                and m["name"].replace("models/", "") not in fallback_models
                            ]

                        for dyn_model in dynamic_candidates:
                            dyn_url = f"https://generativelanguage.googleapis.com/v1beta/models/{dyn_model}:generateContent?key={api_key}"
                            dyn_req = urllib.request.Request(
                                dyn_url,
                                data=json.dumps(req_body).encode("utf-8"),
                                headers={"Content-Type": "application/json"}
                            )
                            try:
                                with urllib.request.urlopen(dyn_req, timeout=12) as d_resp:
                                    d_res_data = json.loads(d_resp.read().decode("utf-8"))
                                    cands = d_res_data.get("candidates", [])
                                    if cands:
                                        p_out = cands[0].get("content", {}).get("parts", [])
                                        reply_text = "".join([p.get("text", "") for p in p_out])
                                    if reply_text:
                                        print(f"Dynamic fallback answered using: {dyn_model}")
                                        break
                            except Exception:
                                continue
                    except Exception as dyn_err:
                        print(f"Dynamic discovery error: {dyn_err}")

                # Clean up any leftover asterisks and ensure proper line breaks for bullets
                def clean_stylist_text(raw: str) -> str:
                    if not raw:
                        return raw
                    import re
                    # Remove markdown asterisks
                    cleaned = raw.replace("**", "").replace("*", "")
                    # Ensure each bullet point is on its own separate line with breathing room
                    cleaned = re.sub(r'\s*•\s*', r'\n\n• ', cleaned)
                    cleaned = re.sub(r'(\.|\!|\?)\s+(Footwear|Accessories|Outerwear):', r'\1\n\n• \2:', cleaned, flags=re.IGNORECASE)
                    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
                    return cleaned.strip()

                if reply_text:
                    self._send_json(200, {"success": True, "reply": clean_stylist_text(reply_text)})
                else:
                    self._send_json(500, {"error": f"Gemini API error: {last_error or 'No response generated'}"})

            except Exception as e:
                import traceback
                traceback.print_exc()
                self._send_json(500, {"error": str(e)})

        elif self.path == "/api/fetch-garment":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length).decode("utf-8")
                payload = json.loads(body)
                url = payload.get("url", "").strip()

                if not url:
                    self._send_json(400, {"error": "Please enter a valid clothing product URL or image link."})
                    return

                print(f"Fetching garment from store link: {url}")
                data_url = fetch_garment_from_url(url)
                self._send_json(200, {"success": True, "image": data_url})

            except Exception as e:
                import traceback
                traceback.print_exc()
                self._send_json(500, {"error": f"Could not load garment from link: {str(e)}"})
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
