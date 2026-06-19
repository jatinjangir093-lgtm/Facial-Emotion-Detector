# 🎭 EmotionSense AI — Real-Time Browser-Based Emotion Detection

EmotionSense AI is a premium, client-side web application designed to detect, analyze, and visualize human facial expressions in real time. Powered by on-device neural networks, the application maps facial keypoints, calculates emotional probability distributions, estimates gender classifications, and charts real-time trend analytics—all with **100% local privacy**.

---

## ✨ Key Features

- **Real-Time Facial Expression Mapping**
  Tracks faces instantly and overlays smooth bounding boxes showcasing the dominant emotion and prediction confidence.
- **Seven Emotion Classifications**
  Detects and gauges probabilities for:
  - 😊 **Happy**
  - 😢 **Sad**
  - 😠 **Angry**
  - 😐 **Neutral**
  - 😲 **Surprised**
  - 😨 **Fear**
  - 🤢 **Disgust**
- **Dynamic Trend Visualization**
  A horizontal bar chart powered by `Chart.js` maps emotional probability in real time.
- **Demographic Classification**
  Estimates gender attributes based on geometric facial measurements.
- **Session History Logging**
  Maintains a running chronological log of detected emotional states throughout your session.
- **Interactive Control Bar**
  - **Start/Stop Feed**: Safely initialize or suspend camera capture.
  - **Snapshot Capture**: Capture a high-res image of the video feed including face-tracking markers, overlay branding, and timestamp.
  - **Detailed Reports**: Export a structured `.txt` report containing session statistics and history logs.
  - **Fullscreen Toggle & History Clear**: Dedicated controls for distraction-free viewports and data erasure.
- **Privacy Secured**
  Zero data leaves the browser. Processing is computed on-device via WebAssembly/GPU acceleration.
- **Stunning SaaS Aesthetic**
  Vibrant colors, dark mode, mesh backgrounds, card layouts, loading progress animations, and dynamic toast notifications.

---

## 🛠️ Technology Stack

- **Frontend Core**: Semantic HTML5, Vanilla JavaScript (ES6+ modular IIFE architecture)
- **Styling & Theme**: Vanilla CSS3 (Custom design system variables, glassmorphism, responsive grid layouts)
- **Neural Network Engine**: Vlad Mandic’s high-performance fork of [face-api.js](https://github.com/vladmandic/face-api) (powered by TensorFlow.js)
- **Analytics Visualization**: [Chart.js](https://www.chartjs.org/) (Canvas-based dynamic horizontal chart rendering)

---

## 📁 Project Structure

```text
Emotion detector/
├── index.html        # App layout, status badges, video viewer, & HTML grids
├── styles.css        # Core design system tokens, layout structures, & animations
├── app.js            # Model loaders, detection loops, capture actions, & Chart.js logic
└── README.md         # Documentation and instructions
```

---

## 🚀 Getting Started

No compilation, database setups, or dependency downloads are required. The project is completely client-side:

1. **Clone or Download the Files**
   Ensure `index.html`, `styles.css`, and `app.js` are in the same folder.
2. **Launch the Application**
   - Double-click `index.html` to open it in your web browser.
   - *Recommended:* Run a local server for a production-like environment (e.g., using the VS Code `Live Server` extension or command-line tools like `npx serve` or `python -m http.server`).
3. **Run the AI Detector**
   - Wait a moment for the **"Initializing AI Engine"** screen to disappear (which securely caches weights via Vlad Mandic's CDN).
   - Accept the browser camera permissions when prompted.
   - Click **Start Camera** to begin.

---

## 🔒 Privacy & On-Device Security

Your privacy is the absolute priority:
- All computational workloads execute exclusively in your browser.
- No video feeds, images, cropped faces, or biometric data are transmitted to any cloud servers or third-party platforms.
- Session logs and charts persist only in your browser tab's RAM and are completely erased upon refreshing or closing the window.

---

## ⚠️ Disclaimer

The estimates provided by the application (including emotion classifications and gender attributes) are based on statistical neural network predictions of facial patterns. They should be treated as estimations and are **not** intended for clinical, scientific, legal, or diagnostic assessments.
