// app.js — EmotionSense AI Application
// Browser-based real-time emotion detection using face-api.js and Chart.js

;(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

  const DETECTION_INTERVAL_MS = 500;
  const MAX_HISTORY = 50;
  const HISTORY_DISPLAY_LIMIT = 20;

  /** Emoji lookup keyed by face-api expression name */
  const emotionEmojis = {
    happy:     '😊',
    sad:       '😢',
    angry:     '😠',
    neutral:   '😐',
    surprised: '😲',
    fearful:   '😨',
    disgusted: '🤢',
  };

  /**
   * face-api uses 'fearful' / 'disgusted' but the HTML bars use
   * data-emotion="fear" / data-emotion="disgust". This map translates.
   */
  const expressionToDataEmotion = {
    happy:     'happy',
    sad:       'sad',
    angry:     'angry',
    neutral:   'neutral',
    surprised: 'surprised',
    fearful:   'fear',
    disgusted: 'disgust',
  };

  /** Display-friendly labels */
  const expressionDisplayName = {
    happy:     'Happy',
    sad:       'Sad',
    angry:     'Angry',
    neutral:   'Neutral',
    surprised: 'Surprised',
    fearful:   'Fear',
    disgusted: 'Disgust',
  };

  const CHART_LABELS = [
    'Happy', 'Sad', 'Angry', 'Neutral', 'Surprised', 'Fear', 'Disgust',
  ];

  // face-api expression keys in the same order as CHART_LABELS
  const CHART_EXPRESSION_KEYS = [
    'happy', 'sad', 'angry', 'neutral', 'surprised', 'fearful', 'disgusted',
  ];

  // ── State ──────────────────────────────────────────────────────────────────

  let videoStream = null;
  let detectionInterval = null;
  let emotionChart = null;
  let detectionHistory = [];
  let modelsLoaded = false;

  // ── DOM References (resolved once on DOMContentLoaded) ─────────────────────

  let $video, $overlay, $startBtn, $startBtnPlaceholder, $stopBtn, $screenshotBtn, $downloadBtn,
      $fullscreenBtn, $clearHistoryBtn, $emotionEmoji, $emotionName, $emotionConfidence,
      $faceCount, $genderResult, $genderConfidence, $genderBarFill,
      $chartCanvas, $historyList, $cameraStatus, $modelStatus, $faceStatus,
      $loadingOverlay, $cameraPlaceholder, $privacyNotice, $dismissPrivacy;

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', async () => {
    cacheDOM();
    setupEventListeners();
    handlePrivacyNotice();
    initChart();
    await loadModels();
  });

  // ── DOM helpers ────────────────────────────────────────────────────────────

  function cacheDOM() {
    $video               = document.getElementById('video');
    $overlay             = document.getElementById('overlay');
    $startBtn            = document.getElementById('startCamera');
    $startBtnPlaceholder = document.getElementById('startCameraPlaceholder');
    $stopBtn             = document.getElementById('stopCamera');
    $screenshotBtn       = document.getElementById('screenshotBtn');
    $downloadBtn         = document.getElementById('downloadReport');
    $fullscreenBtn       = document.getElementById('fullscreenBtn');
    $clearHistoryBtn     = document.getElementById('clearHistory');
    $emotionEmoji        = document.getElementById('emotionEmoji');
    $emotionName         = document.getElementById('emotionName');
    $emotionConfidence   = document.getElementById('emotionConfidence');
    $faceCount           = document.getElementById('faceCount');
    $genderResult        = document.getElementById('genderResult');
    $genderConfidence    = document.getElementById('genderConfidence');
    $genderBarFill       = document.querySelector('#genderBar .bar-fill');
    $chartCanvas         = document.getElementById('emotionChart');
    $historyList         = document.getElementById('historyList');
    $cameraStatus        = document.getElementById('cameraStatus');
    $modelStatus         = document.getElementById('modelStatus');
    $faceStatus          = document.getElementById('faceStatus');
    $loadingOverlay      = document.getElementById('loadingOverlay');
    $cameraPlaceholder   = document.getElementById('cameraPlaceholder');
    $privacyNotice       = document.getElementById('privacyNotice');
    $dismissPrivacy      = document.getElementById('dismissPrivacy');
  }

  function setStatusActive(el, active) {
    if (!el) return;
    el.classList.toggle('active', active);
  }

  // ── Event Listeners ────────────────────────────────────────────────────────

  function setupEventListeners() {
    $startBtn?.addEventListener('click', startCamera);
    $startBtnPlaceholder?.addEventListener('click', startCamera);
    $stopBtn?.addEventListener('click', stopCamera);
    $screenshotBtn?.addEventListener('click', takeScreenshot);
    $downloadBtn?.addEventListener('click', downloadReport);
    $fullscreenBtn?.addEventListener('click', toggleFullscreen);
    $clearHistoryBtn?.addEventListener('click', clearHistory);
    $dismissPrivacy?.addEventListener('click', dismissPrivacyNotice);

    window.addEventListener('resize', resizeOverlay);
    window.addEventListener('beforeunload', stopCamera);
  }

  // ── Model Loading ──────────────────────────────────────────────────────────

  async function loadModels() {
    if (typeof faceapi === 'undefined') {
      showError('face-api.js library not found. Please check your internet connection.');
      hideLoadingOverlay();
      return;
    }

    showLoadingOverlay();

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
      ]);

      modelsLoaded = true;
      
      // Update Model status badge to active & change label
      setStatusActive($modelStatus, true);
      const dotEl = $modelStatus?.querySelector('.badge-dot');
      if (dotEl) dotEl.classList.remove('animate-pulse-amber');
      const labelEl = $modelStatus?.querySelector('.status-label');
      if (labelEl) labelEl.textContent = 'AI Ready';
      
      console.log('[EmotionSense] Models loaded successfully.');
    } catch (err) {
      console.error('[EmotionSense] Model loading failed:', err);
      showError('Failed to load AI models. Please reload the page.');
    } finally {
      setTimeout(hideLoadingOverlay, 400);
    }
  }

  function showLoadingOverlay() {
    if ($loadingOverlay) $loadingOverlay.style.opacity = '1';
    if ($loadingOverlay) $loadingOverlay.style.display = 'flex';
  }

  function hideLoadingOverlay() {
    if ($loadingOverlay) {
      $loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        $loadingOverlay.style.display = 'none';
      }, 300);
    }
  }

  // ── Camera Management ──────────────────────────────────────────────────────

  async function startCamera() {
    if (!modelsLoaded) {
      showError('AI models are still loading. Please wait a moment and try again.');
      return;
    }

    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });

      $video.srcObject = videoStream;
      $video.style.display = 'block';
      await $video.play();

      setStatusActive($cameraStatus, true);
      const labelEl = $cameraStatus?.querySelector('.status-label');
      if (labelEl) labelEl.textContent = 'Camera Connected';

      if ($cameraPlaceholder) $cameraPlaceholder.style.opacity = '0';
      setTimeout(() => {
        if ($cameraPlaceholder) $cameraPlaceholder.style.display = 'none';
      }, 300);

      // Update button disabled states
      if ($startBtn) $startBtn.disabled = true;
      if ($stopBtn) $stopBtn.disabled = false;
      if ($screenshotBtn) $screenshotBtn.disabled = false;
      if ($downloadBtn) $downloadBtn.disabled = false;

      // Wait a tick so the video dimensions are available for the overlay
      requestAnimationFrame(() => {
        resizeOverlay();
        startDetectionLoop();
      });

      console.log('[EmotionSense] Camera started.');
      showNotification('Camera feed connected');
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showError('Camera permission denied. Allow camera access in browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        showError('No camera found. Please connect a webcam.');
      } else {
        showError('Unable to access camera: ' + err.message);
      }
      console.error('[EmotionSense] Camera error:', err);
    }
  }

  function stopCamera() {
    // Stop detection loop
    if (detectionInterval !== null) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }

    // Stop media tracks
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      videoStream = null;
    }

    // Reset video element
    if ($video) {
      $video.pause();
      $video.srcObject = null;
      $video.style.display = 'none';
    }

    // Clear overlay
    clearCanvas();

    // Reset UI Badges
    setStatusActive($cameraStatus, false);
    const labelCam = $cameraStatus?.querySelector('.status-label');
    if (labelCam) labelCam.textContent = 'Camera Disconnected';

    setStatusActive($faceStatus, false);
    const labelFace = $faceStatus?.querySelector('.status-label');
    if (labelFace) labelFace.textContent = 'No Face Detected';

    if ($cameraPlaceholder) {
      $cameraPlaceholder.style.display = 'flex';
      requestAnimationFrame(() => {
        $cameraPlaceholder.style.opacity = '1';
      });
    }

    if ($faceCount) $faceCount.textContent = '0';
    if ($emotionEmoji) $emotionEmoji.textContent = '🎭';
    if ($emotionName) $emotionName.textContent = 'Awaiting Signal';
    if ($emotionConfidence) $emotionConfidence.textContent = '--';

    // Reset estimation labels
    if ($genderResult) $genderResult.textContent = 'Awaiting Face';
    if ($genderConfidence) $genderConfidence.textContent = '--';
    if ($genderBarFill) $genderBarFill.style.width = '0%';

    // Reset emotion bars
    const fills = document.querySelectorAll('.emotion-bar .bar-fill');
    fills.forEach(f => f.style.width = '0%');
    const values = document.querySelectorAll('.emotion-bar .bar-value');
    values.forEach(v => v.textContent = '0%');

    // Reset Chart.js
    if (emotionChart) {
      emotionChart.data.datasets[0].data = new Array(7).fill(0);
      emotionChart.update('none');
    }

    // Update button states
    if ($startBtn) $startBtn.disabled = false;
    if ($stopBtn) $stopBtn.disabled = true;
    if ($screenshotBtn) $screenshotBtn.disabled = true;
    if ($downloadBtn) $downloadBtn.disabled = (detectionHistory.length === 0);

    console.log('[EmotionSense] Camera stopped.');
    showNotification('Camera disconnected');
  }

  // ── Canvas helpers ─────────────────────────────────────────────────────────

  function resizeOverlay() {
    if (!$overlay || !$video) return;
    $overlay.width  = $video.videoWidth  || $video.clientWidth;
    $overlay.height = $video.videoHeight || $video.clientHeight;
    // Match CSS dimensions to the active display container
    $overlay.style.width  = $video.clientWidth  + 'px';
    $overlay.style.height = $video.clientHeight + 'px';
  }

  function clearCanvas() {
    if (!$overlay) return;
    const ctx = $overlay.getContext('2d');
    ctx.clearRect(0, 0, $overlay.width, $overlay.height);
  }

  // ── Face Detection Loop ────────────────────────────────────────────────────

  function startDetectionLoop() {
    if (detectionInterval !== null) clearInterval(detectionInterval);
    detectionInterval = setInterval(detectFaces, DETECTION_INTERVAL_MS);
  }

  async function detectFaces() {
    if (!$video || $video.paused || $video.ended || !modelsLoaded) return;

    try {
      const detections = await faceapi
        .detectAllFaces($video, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5,
        }))
        .withFaceExpressions()
        .withAgeAndGender();

      // Scale detections to the displayed video size
      const displaySize = { width: $video.clientWidth, height: $video.clientHeight };
      faceapi.matchDimensions($overlay, displaySize);
      const resized = faceapi.resizeResults(detections, displaySize);

      clearCanvas();

      if (resized.length > 0) {
        setStatusActive($faceStatus, true);
        const labelEl = $faceStatus?.querySelector('.status-label');
        if (labelEl) {
          labelEl.textContent = resized.length === 1 ? '1 Face Detected' : `${resized.length} Faces Detected`;
        }

        if ($faceCount) $faceCount.textContent = String(resized.length);

        drawDetections(resized);
        handlePrimaryFace(resized[0]);
      } else {
        setStatusActive($faceStatus, false);
        const labelEl = $faceStatus?.querySelector('.status-label');
        if (labelEl) labelEl.textContent = 'No Face Detected';

        if ($faceCount) $faceCount.textContent = '0';
        if ($emotionName) $emotionName.textContent = 'Awaiting Signal';
        if ($emotionEmoji) $emotionEmoji.textContent = '🎭';
        if ($emotionConfidence) $emotionConfidence.textContent = '--';

        // Reset estimation labels
        if ($genderResult) $genderResult.textContent = 'Awaiting Face';
        if ($genderConfidence) $genderConfidence.textContent = '--';
        if ($genderBarFill) $genderBarFill.style.width = '0%';

        // Reset emotion bars
        const fills = document.querySelectorAll('.emotion-bar .bar-fill');
        fills.forEach(f => f.style.width = '0%');
        const values = document.querySelectorAll('.emotion-bar .bar-value');
        values.forEach(v => v.textContent = '0%');

        // Reset Chart.js
        if (emotionChart) {
          emotionChart.data.datasets[0].data = new Array(7).fill(0);
          emotionChart.update('none');
        }
      }
    } catch (err) {
      console.error('[EmotionSense] Detection error:', err);
    }
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  function drawDetections(resized) {
    const ctx = $overlay.getContext('2d');

    resized.forEach((det) => {
      const { x, y, width, height } = det.detection.box;

      // Determine dominant emotion for label
      const expressions = det.expressions;
      const dominant    = getDominantExpression(expressions);
      const confidence  = (expressions[dominant] * 100).toFixed(1);
      const label       = `${expressionDisplayName[dominant] || dominant} ${confidence}%`;

      // Draw premium rounded bounding box in primary accent #4F8CFF
      ctx.strokeStyle = 'rgba(79, 140, 255, 0.9)'; 
      ctx.lineWidth   = 2.5;
      roundRect(ctx, x, y, width, height, 12);
      ctx.stroke();

      // Draw label background
      const fontSize   = 12;
      ctx.font         = `600 ${fontSize}px 'Inter', sans-serif`;
      const textWidth  = ctx.measureText(label).width;
      const labelH     = fontSize + 10;
      const labelX     = x;
      const labelY     = y - labelH - 6;

      ctx.fillStyle = 'rgba(23, 25, 35, 0.85)';
      roundRect(ctx, labelX, labelY, textWidth + 16, labelH, 6);
      ctx.fill();

      // Draw label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, labelX + 8, labelY + fontSize + 4);
    });
  }

  /** Draw a rounded rectangle path (does NOT stroke/fill — caller does that). */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Primary Face Processing ────────────────────────────────────────────────

  function handlePrimaryFace(det) {
    const expressions = det.expressions;
    const dominant    = getDominantExpression(expressions);
    const confidence  = expressions[dominant];

    // Emoji & name
    if ($emotionEmoji) $emotionEmoji.textContent = emotionEmojis[dominant] || '🎭';
    if ($emotionName)  $emotionName.textContent  = expressionDisplayName[dominant] || dominant;
    if ($emotionConfidence) {
      $emotionConfidence.textContent = `${(confidence * 100).toFixed(1)}% confidence`;
    }

    // Update all emotion bars
    updateEmotionBars(expressions);

    // Gender
    const gender           = det.gender;           // 'male' | 'female'
    const genderProbability = det.genderProbability; // 0-1
    if ($genderResult) $genderResult.textContent = capitalize(gender);
    if ($genderConfidence) {
      $genderConfidence.textContent = `${(genderProbability * 100).toFixed(1)}%`;
    }
    if ($genderBarFill) {
      $genderBarFill.style.width = `${(genderProbability * 100).toFixed(1)}%`;
    }

    // Chart
    updateChart(expressions);

    // History
    addHistoryEntry(dominant, confidence, gender);
  }

  function getDominantExpression(expressions) {
    return Object.entries(expressions)
      .reduce((best, [key, val]) => (val > best[1] ? [key, val] : best), ['neutral', 0])[0];
  }

  // ── Emotion Bars ───────────────────────────────────────────────────────────

  function updateEmotionBars(expressions) {
    for (const [exprKey, value] of Object.entries(expressions)) {
      const dataEmotion = expressionToDataEmotion[exprKey];
      if (!dataEmotion) continue;

      const barEl = document.querySelector(`.emotion-bar[data-emotion="${dataEmotion}"]`);
      if (!barEl) continue;

      const fill  = barEl.querySelector('.bar-fill');
      const span  = barEl.querySelector('.bar-value');
      const pct   = (value * 100).toFixed(1);

      if (fill) fill.style.width = `${pct}%`;
      if (span) span.textContent = `${pct}%`;
    }
  }

  // ── Chart.js Integration ───────────────────────────────────────────────────

  function initChart() {
    if (typeof Chart === 'undefined' || !$chartCanvas) {
      console.warn('[EmotionSense] Chart.js not available — chart disabled.');
      return;
    }

    // Modern SaaS color palette matching our stylesheet soft tones
    const CHART_COLORS = [
      '#FBBF24', // Happy
      '#60A5FA', // Sad
      '#EF4444', // Angry
      '#9CA3AF', // Neutral
      '#F97316', // Surprised
      '#A78BFA', // Fear
      '#34D399', // Disgust
    ];

    emotionChart = new Chart($chartCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: CHART_LABELS,
        datasets: [{
          data: new Array(7).fill(0),
          backgroundColor: CHART_COLORS.map((c) => c + 'CC'),  // slight transparency
          borderColor: CHART_COLORS,
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 10,
        }],
      },
      options: {
        indexAxis: 'y',   // horizontal bars
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: { 
              color: '#A1A8B8', 
              font: { family: 'Inter', size: 10 },
              callback: (v) => v + '%' 
            },
            grid:  { color: 'rgba(255,255,255,0.04)' },
            border: { display: false },
          },
          y: {
            ticks: { 
              color: '#FFFFFF', 
              font: { family: 'Inter', size: 11, weight: '500' } 
            },
            grid:  { display: false },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#171923',
            titleColor: '#FFFFFF',
            bodyColor: '#A1A8B8',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            bodyFont: { family: 'Inter' },
            titleFont: { family: 'Inter', weight: 'bold' },
            callbacks: {
              label: (ctx) => ` Confidence: ${ctx.parsed.x.toFixed(1)}%`,
            },
          },
        },
        animation: { duration: 250 },
      },
    });
  }

  // ── Chart updates ──────────────────────────────────────────────────────────

  function updateChart(expressions) {
    if (!emotionChart) return;

    const data = CHART_EXPRESSION_KEYS.map((key) =>
      parseFloat(((expressions[key] || 0) * 100).toFixed(1))
    );

    emotionChart.data.datasets[0].data = data;
    emotionChart.update('none'); // skip animation for real-time smoothness
  }

  // ── Detection History ──────────────────────────────────────────────────────

  let lastHistoryTimestamp = 0;
  const HISTORY_THROTTLE_MS = 1000; // avoid DOM thrashing

  function addHistoryEntry(emotion, confidence, gender) {
    const now = Date.now();
    if (now - lastHistoryTimestamp < HISTORY_THROTTLE_MS) return;
    lastHistoryTimestamp = now;

    const entry = {
      timestamp: new Date(now),
      emotion,
      emoji: emotionEmojis[emotion] || '🎭',
      confidence,
      gender: capitalize(gender),
    };

    detectionHistory.unshift(entry);
    if (detectionHistory.length > MAX_HISTORY) detectionHistory.pop();

    renderHistory();

    // Enable download button once history exists
    if ($downloadBtn) $downloadBtn.disabled = false;
  }

  function renderHistory() {
    if (!$historyList) return;

    if (detectionHistory.length === 0) {
      $historyList.innerHTML = `
        <div class="history-empty">
          <p>No detection history has been recorded. Start camera to initialize analysis.</p>
        </div>`;
      return;
    }

    // Build HTML for the most recent entries
    const items = detectionHistory.slice(0, HISTORY_DISPLAY_LIMIT).map((entry) => {
      const time = formatTime(entry.timestamp);
      const pct  = (entry.confidence * 100).toFixed(1);
      return `
        <div class="history-item">
          <span class="history-emoji">${entry.emoji}</span>
          <span class="history-details">
            <strong>${expressionDisplayName[entry.emotion] || entry.emotion}</strong> — ${pct}%
            <small>${entry.gender} · ${time}</small>
          </span>
        </div>`;
    });

    $historyList.innerHTML = items.join('');
    $historyList.scrollTop = 0;
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-GB', {
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  function clearHistory() {
    detectionHistory = [];
    renderHistory();
    // Disable download report if camera is not running and history is cleared
    if ($downloadBtn && (!$video || $video.paused)) {
      $downloadBtn.disabled = true;
    }
    showNotification('History log cleared');
  }

  // ── Screenshot ─────────────────────────────────────────────────────────────

  function takeScreenshot() {
    if (!$video || !videoStream) {
      showError('Camera is not active. Start the camera first.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width  = $video.videoWidth;
      canvas.height = $video.videoHeight;
      const ctx = canvas.getContext('2d');

      // Draw video frame
      ctx.drawImage($video, 0, 0, canvas.width, canvas.height);

      // Draw overlay (face boxes)
      if ($overlay) ctx.drawImage($overlay, 0, 0, canvas.width, canvas.height);

      // Add timestamp banner at the bottom
      const timestamp = new Date().toLocaleString();
      const bannerH   = 32;
      ctx.fillStyle   = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, canvas.height - bannerH, canvas.width, bannerH);
      ctx.fillStyle   = '#ffffff';
      ctx.font        = '14px sans-serif';
      ctx.fillText(`EmotionSense AI · ${timestamp}`, 10, canvas.height - 10);

      // Export as PNG
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const ts   = new Date().toISOString().replace(/[:.]/g, '-');
        a.href     = url;
        a.download = `emotionsense_screenshot_${ts}.png`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('Screenshot saved successfully!');
      }, 'image/png');
    } catch (err) {
      console.error('[EmotionSense] Screenshot error:', err);
      showError('Failed to capture screenshot.');
    }
  }

  // ── Download Report ────────────────────────────────────────────────────────

  function downloadReport() {
    try {
      const now = new Date();
      const currentEmotion = $emotionName?.textContent || 'None';
      const confidence = $emotionConfidence?.textContent || 'N/A';
      const faceCountVal = $faceCount?.textContent || '0';

      let historyText = '';
      if (detectionHistory.length === 0) {
        historyText = 'No detections recorded in this session.';
      } else {
        historyText = detectionHistory.map((e, index) => {
          const num = index + 1;
          const time = formatTime(e.timestamp);
          const pct = (e.confidence * 100).toFixed(1) + '%';
          return `  [${num.toString().padStart(2, '0')}] ${time} | Emotion: ${expressionDisplayName[e.emotion] || e.emotion} (${pct}) | Gender: ${e.gender}`;
        }).join('\n');
      }

      const reportText = `===========================================================
EMOTIONSENSE AI — SESSION DETECTION REPORT
===========================================================
Generated on:       ${now.toLocaleString()}
Faces Detected:     ${faceCountVal}

CURRENT STATUS:
-----------------------------------------------------------
Current Emotion:    ${currentEmotion}
Confidence Score:   ${confidence}
Gender Estimation:  ${$genderResult?.textContent || 'N/A'} (${$genderConfidence?.textContent || 'N/A'})

DETECTION HISTORY (Last ${HISTORY_DISPLAY_LIMIT} entries):
-----------------------------------------------------------
${historyText}

===========================================================
Disclaimer: These results are AI-generated estimates and should 
not be used for clinical, legal, or diagnostic purposes.
===========================================================`;

      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const ts   = now.toISOString().replace(/[:.]/g, '-');
      a.href     = url;
      a.download = `emotionsense_report_${ts}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      showNotification('Report downloaded successfully!');
    } catch (err) {
      console.error('[EmotionSense] Report error:', err);
      showError('Failed to generate report.');
    }
  }

  // ── Fullscreen Toggle ──────────────────────────────────────────────────────

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        if ($fullscreenBtn) {
          $fullscreenBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"/></svg>
            Exit`;
        }
      } else {
        document.exitFullscreen().catch(() => {});
        if ($fullscreenBtn) {
          $fullscreenBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            `;
        }
      }
    } catch (err) {
      console.warn('[EmotionSense] Fullscreen not supported:', err);
    }
  }

  // ── Privacy Notice ─────────────────────────────────────────────────────────

  function handlePrivacyNotice() {
    if (!$privacyNotice) return;

    const dismissed = sessionStorage.getItem('emotionsense_privacy_dismissed');
    if (dismissed) {
      $privacyNotice.style.display = 'none';
    } else {
      $privacyNotice.style.display = 'flex';
    }
  }

  function dismissPrivacyNotice() {
    if ($privacyNotice) $privacyNotice.style.display = 'none';
    sessionStorage.setItem('emotionsense_privacy_dismissed', '1');
  }

  // ── Toast Notifications ────────────────────────────────────────────────────

  function showNotification(message, type = 'success') {
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '⚡' : '❌'}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);
    
    // Trigger CSS animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remove toast after duration
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      });
    }, 3000);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  // Capitalize first letter helper
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function showError(message) {
    console.error('[EmotionSense]', message);
    showNotification(message, 'error');
  }
})();
