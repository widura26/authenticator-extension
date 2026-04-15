// Import the jsQR library into the Service Worker context
importScripts("jsQR.js");

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type === "SNIP_DONE") {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
            // Pass sender.tab.id so we can send an alert back to the page
            cropImage(dataUrl, msg.rect, msg.devicePixelRatio, sender.tab.id);
        });
    }
});

// Listener for the final save confirmation from the content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SAVE_CONFIRMED") {
        saveAccountToStorage(msg.account).then(() => {
            sendResponse({ status: "saved" });
        });
        return true; 
    }
});

async function cropImage(dataUrl, rect, scale, tabId) {
    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const img = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(rect.w * scale, rect.h * scale);
        const ctx = canvas.getContext("2d");

        ctx.drawImage(
            img,
            rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale,
            0, 0, rect.w * scale, rect.h * scale
        );

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
            const account = parseQRData(code.data);
            if (account) {
                chrome.tabs.sendMessage(tabId, { type: "CONFIRM_SCAN", account });
            } else {
                throw new Error("Invalid 2FA format");
            }
        } else {
            chrome.tabs.sendMessage(tabId, { type: "SHOW_ALERT", message: "QR Code not found." });
        }
    } catch (error) {
        chrome.tabs.sendMessage(tabId, { type: "SHOW_ALERT", message: "Scan failed: " + error.message });
    }
}

function parseQRData(rawValue) {
    try {
        const url = new URL(rawValue);
        if (url.protocol !== 'otpauth:') return null;

        const params = new URLSearchParams(url.search);
        const secret = params.get('secret');
        let issuer = params.get('issuer') || url.pathname.split('/').pop().split(':')[0];
        if (!secret) return null;

        return {
            issuer: decodeURIComponent(issuer),
            secret: secret.replace(/[\s\-=]/g, '').toUpperCase(),
            id: Date.now()
        };
    } catch (e) {
        return null;
    }
}

async function saveAccountToStorage(account) {
    const result = await chrome.storage.sync.get(['accounts']);
    const accounts = result.accounts || [];
    accounts.push(account);
    await chrome.storage.sync.set({ accounts });
}