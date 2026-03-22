// ==UserScript==
// @name         YouTube HP Filter - Ultra-Compact (Full Glow)
// @namespace    http://tampermonkey.net/
// @version      6.6.5
// @description  Original logic + Spaced readouts + Unified Thumb & Pill Glow.
// @match        *://*.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    if (window.self !== window.top) return;

    let audioCtx, source, hp1, hp2, currentVideo = null, is24dB = true;

    const minFreq = 25;
    const maxFreq = 600;
    const posToFreq = (p) => (p <= 2) ? 0 : Math.round(minFreq * Math.pow(maxFreq / minFreq, (p - 2) / 98));

    const style = document.createElement('style');

    // --- ADJUST GLOWS HERE ---
    const thumbGlow = "0 0 20px rgba(255, 0, 85, 0.0)";
    const pillGlow = "0 0 8px rgba(255, 0, 85, 1.0)"; // Subtle outer aura for the pill

    style.textContent = `
        #yt-hp-slider {
            -webkit-appearance: none;
            background: transparent;
            width: 100%;
            outline: none;
            margin: 0;
            cursor: pointer;
            height: 24px;
            overflow: visible !important;
        }

        #yt-hp-slider::-webkit-slider-runnable-track { height: 3px; border-radius: 2px; }

        #yt-hp-slider::-webkit-slider-thumb {
            height: 14px; width: 14px; border-radius: 50%;
            background: #fff; -webkit-appearance: none;
            margin-top: -5.5px; border: 0px solid #FF0055;
            transition: border-width 0.1s, box-shadow 0.2s;
            position: relative;
            z-index: 10;
        }

        #yt-hp-slider.active-thumb::-webkit-slider-thumb {
            border-width: 2px;
            box-shadow: ${thumbGlow} !important;
        }

        #yt-hp-slider::-moz-range-thumb {
            height: 14px; width: 14px; border-radius: 50%;
            background: #fff; border: 0px solid #FF0055;
        }

        #yt-hp-slider.active-thumb::-moz-range-thumb {
            border-width: 2px;
            box-shadow: ${thumbGlow} !important;
        }

        #yt-hp-container {
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
            border: 1px solid #333;
        }

        .info-panel {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-left: 0px;
            cursor: pointer;
            user-select: none;
            width: 50px;
            height: 30px;
        }

        .readout-freq, .readout-slope {
            color: #555;
            font-family: 'Roboto', sans-serif;
            transition: color 0.2s;
            white-space: nowrap;
        }

        .readout-freq { font-size: 13px; font-weight: bold; line-height: 1.1; margin-bottom: 3px; }
        .readout-slope { font-family: 'Arial Black', sans-serif; font-size: 10px; line-height: 1; letter-spacing: -0.5px; }
        .active-text { color: #fff !important; }
    `;
    document.head.appendChild(style);

    /* --- UI CONSTRUCTION --- */
    const container = document.createElement('div');
    container.id = 'yt-hp-container';
    Object.assign(container.style, {
        position: 'fixed', top: '8px', left: '102px', width: '200px', height: '40px',
        backgroundColor: '#0f0f0f', borderRadius: '20px', zIndex: '99999',
        display: 'flex', flexDirection: 'row', padding: '0 8px 0 12px',
        pointerEvents: 'all', alignItems: 'center'
    });

    const mainControls = document.createElement('div');
    mainControls.style.cssText = 'display:flex; flex-grow:1; align-items:center;';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.id = 'yt-hp-slider'; slider.min = '0'; slider.max = '100'; slider.value = '0';
    mainControls.append(slider);

    const infoPanel = document.createElement('div');
    infoPanel.className = 'info-panel';
    const freqDisplay = document.createElement('span');
    freqDisplay.className = 'readout-freq'; freqDisplay.innerText = 'HPF';
    const slopeDisplay = document.createElement('span');
    slopeDisplay.className = 'readout-slope'; slopeDisplay.innerText = '24dB';

    infoPanel.append(freqDisplay, slopeDisplay);
    container.append(mainControls, infoPanel);
    document.body.appendChild(container);

    function ensureAudio() {
        const video = document.querySelector('video.html5-main-video');
        if (!video || currentVideo === video) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            currentVideo = video;
            source = audioCtx.createMediaElementSource(video);
            hp1 = audioCtx.createBiquadFilter(); hp1.type = 'highpass';
            hp2 = audioCtx.createBiquadFilter(); hp2.type = 'highpass';
            source.connect(hp1); hp1.connect(hp2); hp2.connect(audioCtx.destination);
        } catch (e) { }
    }

    function updateUI() {
        const val = slider.value;
        const isOff = val <= 2;
        const ytRed = '#FF0055';

        if (isOff) {
            container.style.borderColor = '#333';
            container.style.boxShadow = 'none';
            slider.classList.remove('active-thumb');
        } else {
            container.style.borderColor = ytRed;
            // COMBINED INSET + OUTSET GLOW FOR PILL
            container.style.boxShadow = `inset 0 0 0 1px ${ytRed}, ${pillGlow}`;
            slider.classList.add('active-thumb');
        }

        freqDisplay.innerText = isOff ? 'HPF' : posToFreq(val) + 'Hz';
        freqDisplay.classList.toggle('active-text', !isOff);
        slopeDisplay.classList.toggle('active-text', !isOff);

        const color = `linear-gradient(90deg, #444 ${val}%, #fff ${val}%)`;
        const styleSheet = document.getElementById('dynamic-slider-style') || document.createElement('style');
        styleSheet.id = 'dynamic-slider-style';
        styleSheet.textContent = `#yt-hp-slider::-webkit-slider-runnable-track { background: ${color} !important; }`;
        if (!styleSheet.parentElement) document.head.appendChild(styleSheet);
    }

    slider.oninput = () => {
        if (audioCtx?.state === 'suspended') audioCtx.resume();
        ensureAudio();
        const freq = posToFreq(slider.value);
        if (hp1) {
            const target = freq === 0 ? 10 : freq;
            hp1.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.02);
            hp2.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.02);
            hp1.disconnect();
            if (is24dB) { hp1.connect(hp2); } else { hp1.connect(audioCtx.destination); }
        }
        updateUI();
    };

    infoPanel.onclick = () => {
        is24dB = !is24dB;
        slopeDisplay.innerText = is24dB ? '24dB' : '12dB';
        slider.oninput();
    };

    window.addEventListener('yt-navigate-finish', () => setTimeout(() => slider.oninput(), 1000));
    document.addEventListener('fullscreenchange', () => container.style.display = document.fullscreenElement ? 'none' : 'flex');
    document.addEventListener('click', () => { if (audioCtx?.state === 'suspended') audioCtx.resume(); }, { once: true });
    setTimeout(() => slider.oninput(), 1500);
})();