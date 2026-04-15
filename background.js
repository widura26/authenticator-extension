chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type === "SNIP_DONE") {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
        cropImage(dataUrl, msg.rect);
        });
    }
});

function cropImage(dataUrl, rect) {
    const img = new Image();
    img.src = dataUrl;

    img.onload = async () => {
        const scale = devicePixelRatio;

        const canvas = new OffscreenCanvas(rect.w * scale, rect.h * scale);
        const ctx = canvas.getContext("2d");

        ctx.drawImage(
        img,
        rect.x * scale,
        rect.y * scale,
        rect.w * scale,
        rect.h * scale,
        0,
        0,
        rect.w * scale,
        rect.h * scale
        );

        const blob = await canvas.convertToBlob();
        console.log("CROPPED IMAGE SIZE:", blob.size);
    };
}