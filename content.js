console.log('hello')
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_SNIP") {
      startSnip();
      sendResponse({ status: "started" }); // Acknowledge the message
  }
  // Listener to display alerts triggered by the background script
  if (msg.type === "SHOW_ALERT") {
      alert(msg.message);
  }
  // Handle confirmation request
  if (msg.type === "CONFIRM_SCAN") {
      showConfirmationModal(msg.account);
  }
});

function showConfirmationModal(account) {
    const modal = document.createElement("div");
    modal.id = "auth-confirm-modal";
    Object.assign(modal.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        width: "300px",
        backgroundColor: "white",
        border: "1px solid #ccc",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: "2147483647",
        padding: "16px",
        fontFamily: "sans-serif",
        color: "#333"
    });

    modal.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
            QR Scan Successful
        </div>
        <div style="margin-bottom: 16px; font-size: 14px;">
            Do you want to add this account?<br>
            <strong style="display: block; margin-top: 4px;">${account.issuer}</strong>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button id="auth-cancel-btn" style="padding: 6px 12px; cursor: pointer; border: 1px solid #ccc; background: white; border-radius: 4px;">Cancel</button>
            <button id="auth-confirm-btn" style="padding: 6px 12px; cursor: pointer; border: none; background: #4285f4; color: white; border-radius: 4px; font-weight: bold;">Add Account</button>
        </div>
    `;

    document.body.appendChild(modal);

    const removeModal = () => modal.remove();

    modal.querySelector("#auth-cancel-btn").onclick = removeModal;
    modal.querySelector("#auth-confirm-btn").onclick = () => {
        chrome.runtime.sendMessage({ type: "SAVE_CONFIRMED", account }, (response) => {
            // Replace content with success message
            modal.innerHTML = `
                <div style="color: green; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    Account Saved!
                </div>
            `;
            setTimeout(removeModal, 2000);
        });
    };
}

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
        console.log("mouse down")
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
        console.log("mouse move")

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
            },
            devicePixelRatio: window.devicePixelRatio
        });
        console.log("mouse up")
    });

    window.addEventListener("keydown", e => {
        if (e.key === "Escape") overlay.remove();
    }, { once: true });
}