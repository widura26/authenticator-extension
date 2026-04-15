// Import the jsQR library into the Service Worker context
importScripts("jsQR.js");

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type === "SNIP_DONE") {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
            cropImage(dataUrl, msg.rect, msg.devicePixelRatio);
        });
    }
});

async function cropImage(dataUrl, rect, scale) {
    try {
        // In Service Workers, we use fetch + createImageBitmap instead of new Image()
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const img = await createImageBitmap(blob);

        const canvas = new OffscreenCanvas(rect.w * scale, rect.h * scale);
        const ctx = canvas.getContext("2d");

        ctx.drawImage(
            img,
            rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale, // Source
            0, 0, rect.w * scale, rect.h * scale                           // Destination
        );

        // Extract image data for jsQR
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
            await processAndSaveQR(code.data);
        } else {
            console.error("QR Code not found in the selected area.");
        }
    } catch (error) {
        console.error("Error during image cropping:", error);
    }
}

async function processAndSaveQR(rawValue) {
    try {
        const url = new URL(rawValue);
        if (url.protocol !== 'otpauth:') {
            throw new Error('Not a valid 2FA format');
        }

        const params = new URLSearchParams(url.search);
        const secret = params.get('secret');
        let issuer = params.get('issuer') || url.pathname.split('/').pop().split(':')[0];
        issuer = decodeURIComponent(issuer);

        if (secret) {
            const cleanSecret = secret.replace(/[\s\-=]/g, '').toUpperCase();
            
            // Save to chrome storage
            const result = await chrome.storage.sync.get(['accounts']);
            const accounts = result.accounts || [];
            
            accounts.push({ 
                issuer, 
                secret: cleanSecret, 
                id: Date.now() 
            });

            await chrome.storage.sync.set({ accounts });
            console.log("Account saved successfully:", issuer);
        }
    } catch (e) {
        console.error("Failed to parse QR Code data:", e);
    }
}