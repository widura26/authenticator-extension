console.log('hello')
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START_SNIP") startSnip();
});

function startSnip() {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.cursor = "crosshair";
    overlay.style.height = "100vh";
    overlay.style.zIndex = "2147483647"; // max int
    overlay.style.pointerEvents = "all";

    const box = document.createElement("div");
    box.style = `
        position: absolute;
        border: 2px dashed red;
        background: rgba(255,0,0,0.1);
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    let startX, startY, dragging = false;

    overlay.addEventListener("mousedown", e => {
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
    });

    overlay.addEventListener("mousemove", e => {
        if (!dragging) return;
        const x = Math.min(e.clientX, startX);
        const y = Math.min(e.clientY, startY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);

        box.style.left = x + "px";
        box.style.top = y + "px";
        box.style.width = w + "px";
        box.style.height = h + "px";
    });

    overlay.addEventListener("mouseup", e => {
        dragging = false;
        const rect = box.getBoundingClientRect();
        overlay.remove();

        chrome.runtime.sendMessage({
        type: "SNIP_DONE",
        rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height)
        }
        });
    });

    window.addEventListener("keydown", e => {
        if (e.key === "Escape") overlay.remove();
    }, { once: true });
}