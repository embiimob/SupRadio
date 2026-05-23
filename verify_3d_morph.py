from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Load with query to skip trend loading delays if possible
    page.goto("file:///app/index.html?q=test")
    page.wait_for_timeout(1000)

    # Force the 3D spinning mode (Mode 2)
    page.evaluate("""
        if(window.dom && window.dom.visualizerCanvas) {
            window.currentVizMode = 2; // Spinning Shapes
            console.log("Forced mode 2");
        }
    """)
    page.wait_for_timeout(1000)

    # Mock heavy audio to trigger morphing logic immediately
    page.evaluate("""
        const originalGetAudioData = window.getAudioData;
        window.getAudioData = function() {
            // Provide fake heavy bass data
            const fakeWave = new Uint8Array(512).fill(128); // flat wave
            const fakeFreq = new Uint8Array(512);
            for(let i=0; i<512; i++) {
                // Extreme bass response to trigger beat > 0.8
                if (i < 10) fakeFreq[i] = 255;
                else fakeFreq[i] = 100;
            }
            return { wave: fakeWave, freq: fakeFreq };
        };
    """)

    # Let the morph logic trigger and render
    page.wait_for_timeout(3000)

    # Take screenshot at the key moment showing morphs
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(2000)  # Hold final state for the video

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()
