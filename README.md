# OOTD — AI Virtual Fitting Room & Stylist

<div align="center">
  <h3>See Any Outfit On You Before You Buy.</h3>
  <p>Photorealistic, maskless virtual try-on powered by <strong>FASHN VTON 1.5</strong> with a dedicated <strong>AI Fashion Stylist</strong>.</p>
</div>

---

## 🌟 Overview

**OOTD** is a full-stack, local-first virtual fitting room application. Users can upload a photo of themselves and any clothing item (or simply paste a link from an e-commerce store), and the on-device diffusion model synthesizes a photorealistic preview of them wearing the outfit.

In addition to virtual try-on, **Aura**, the built-in AI Stylist powered by multimodal Google Gemini, evaluates your look, provides a 10-point fit rating, and gives personalized styling advice on footwear, color matching, and accessories.

---

## ✨ Features

- **👗 Maskless Virtual Try-On**:
  - Direct pixel-space neural diffusion (MMDiT architecture).
  - Preserves exact pose, body proportions, lighting, and hair contours without manual masking.
  - Supports **Tops**, **Bottoms**, and **One-pieces / Dresses**.
  - Works with both **model photos** and **flat-lay/catalog shots**.

- **🔗 Link-to-Try-On (E-Commerce URL Fetch)**:
  - Paste a product page link from any online store (e.g. Zara, H&M, ASOS, Amazon).
  - Automatically parses and extracts high-resolution garment imagery ready for immediate fitting.

- **⏱️ Hardware-Calibrated Progress**:
  - Live progress feedback with dynamic phase transitions (`Fitting your outfit…` → `Adding final touches…`).
  - Calibrated timing estimates based on actual GPU execution profiles.

- **🎨 Dedicated AI Stylist ("Aura")**:
  - Full-screen Stylist dashboard and floating drawer.
  - 10-point scoring system evaluating silhouette, fit, and palette balance.
  - Interactive fashion chat to ask for shoe pairings, layering ideas, and occasion recommendations.

- **🔒 100% Private & Local Inference**:
  - User photos and garments are processed locally on your own GPU. No private photos are uploaded to third-party try-on cloud services.

- **⚡ Neo-Brutalist Aesthetic**:
  - High-contrast, tactile UI inspired by [Restless.ai](https://www.restless.ai/) (`#fff67c` neon yellow, `#141414` deep ink, paper cards, and custom medallion brand navigation).

---

## 🏗️ Architecture & Stack

```
OOTD-Model/
├── frontend/                     # React + Vite Application
│   ├── src/
│   │   ├── App.jsx               # Main SPA router (Home, Studio, Stylist)
│   │   ├── StylistPage.jsx       # Dedicated AI Stylist page
│   │   ├── StylistChat.jsx       # Floating AI Stylist drawer
│   │   └── styles.css            # Neo-brutalist design system
│   └── dist/                     # Compiled production build served by Python
│
├── fashn-vton-1.5/               # Deep Learning Backend & Server
│   ├── src/fashn_vton/           # Virtual Try-On Model Pipeline
│   │   ├── pipeline.py           # TryOnPipeline inference engine
│   │   ├── tryon_mmdit.py        # MMDiT diffusion model
│   │   ├── dwpose/               # Whole-body keypoint detector
│   │   └── preprocessing/        # Human parsing & agnostic synthesis
│   ├── web/
│   │   └── server.py             # Python HTTP server & API gateway
│   └── weights/                  # Local model weights & checkpoints
```

### Technology Highlights
- **Frontend**: React 18, Vite, Lucide Icons.
- **Backend**: Python 3.10+ stdlib `http.server` (zero extra backend framework overhead).
- **Computer Vision & Diffusion**: PyTorch, Torchvision, ONNX Runtime, DWPose, FASHN Human Parser.
- **Stylist Engine**: Google Gemini API via multimodal visual analysis.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: 18.x or higher + `npm`
- **GPU (Recommended)**: NVIDIA GPU with CUDA support (e.g., RTX 3050 4GB or higher).

### 2. Environment Setup

#### Setup Python Backend:
```bash
cd fashn-vton-1.5
python -m venv .venv

# On Windows PowerShell:
.venv\Scripts\Activate.ps1

# Install requirements
pip install -e .
```

#### Download Model Weights:
Ensure the required weights are present in `fashn-vton-1.5/weights`:
```bash
python scripts/download_weights.py --weights-dir ./weights
```

#### Build Frontend:
```bash
cd ../frontend
npm install
npm run build
```

---

## 💻 Running the Application

Launch the unified Python server from the repository root:

```bash
python fashn-vton-1.5/web/server.py
```

Open your browser at:
```
http://localhost:7860
```

---

## ⚡ Inference Presets & Hardware Benchmarks

Tested on **NVIDIA GeForce RTX 3050 Laptop GPU (4 GB VRAM)**:

| Preset | Diffusion Steps | Avg. Duration | Best For |
| :--- | :---: | :---: | :--- |
| **Fast** | 10 steps | ~34s | Quick draft preview |
| **Standard** | 20 steps | ~61s | Recommended balance of speed & quality |
| **High Quality** | 30 steps | ~88s | Crisp textures, sharp logos, and creases |
| **Ultra HD** | 50 steps | ~142s | Maximum detail output |

---

## 🛡️ License

This project incorporates the [FASHN VTON v1.5](https://fashn.ai) pipeline under the Apache 2.0 License.
Frontend application, UI, and custom integrations copyright (c) 2026.
