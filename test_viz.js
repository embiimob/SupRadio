const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
    console.log("Starting Chrome...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Serve our local file via file protocol
    const url = 'file://' + process.cwd() + '/index.html?q=test';

    // Setup a mock to override the audio fallback logic and provide heavy beat values
    await page.addInitScript(() => {
        window.AudioContext = class {
            constructor() { this.state = 'running'; }
            createAnalyser() { return { frequencyBinCount: 512, getByteTimeDomainData: () => {}, getByteFrequencyData: () => {} }; }
            createMediaElementSource() { return { connect: () => {} }; }
            destination = {};
        };

        // We'll intercept startVizAnimation or just override getAudioData globally since it's a global function
        window.addEventListener('DOMContentLoaded', () => {
             // Let it initialize normally first
             setTimeout(() => {
                 // Override the fallback math in getAudioData that parses audio
                 // by just monkey patching the global `bass`, `mid`, `high` if we can.
                 // Actually `getAudioData` returns an object. Let's patch it.
                 const originalGetAudioData = window.getAudioData;
                 window.getAudioData = function() {
                     // Provide fake heavy bass data
                     const fakeWave = new Uint8Array(512).fill(128); // flat wave
                     const fakeFreq = new Uint8Array(512);
                     for(let i=0; i<512; i++) {
                         // Add extreme bass response
                         if (i < 10) fakeFreq[i] = 255;
                         else fakeFreq[i] = 100;
                     }
                     return { wave: fakeWave, freq: fakeFreq };
                 };
             }, 500);
        });
    });

    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait a bit to let visuals run
    await page.waitForTimeout(2000);

    // Force mode 2 (3D Spinning Shapes)
    await page.evaluate(() => {
        if(window.dom && window.dom.visualizerCanvas) {
            window.currentVizMode = 2; // Spinning Shapes
            console.log("Forced mode 2");
        }
    });

    // Let it render heavy bass for a few frames to trigger a morph
    await page.waitForTimeout(1000);

    console.log("Taking Mode 2 morph screenshot...");
    await page.screenshot({ path: '/tmp/test_3d_morph.png', fullPage: true });

    await browser.close();
    console.log("Done.");
})();
