document.addEventListener('DOMContentLoaded', () => {
    const codesList = document.getElementById('codes-list');
    const addForm = document.getElementById('add-form');
    const addBtn = document.getElementById('add-btn');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const issuerInput = document.getElementById('issuer-input');
    const secretInput = document.getElementById('secret-input');
    const qrBtn = document.getElementById('qr-btn');
    const qrInput = document.getElementById('qr-input');
    const startBtn = document.getElementById("startBtn");

    // Load accounts from storage
    loadAccounts();

    // Update codes every second
    setInterval(refreshCodes, 1000);

    // UI Event Listeners
    addBtn.addEventListener('click', () => {
        addForm.classList.remove('hidden');
        codesList.classList.add('hidden');
    });

    cancelBtn.addEventListener('click', () => {
        addForm.classList.add('hidden');
        codesList.classList.remove('hidden');
        clearInputs();
        if (typeof stopCamera === 'function') {
            stopCamera();
        }
    });

    // QR Code Scanning Logic
    if (qrBtn) {
        qrBtn.addEventListener('click', () => qrInput.click());
    }

    // --- BAGIAN LOGIKA SCAN FILE ---

    if (qrInput) {
        qrInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Reset input value so the same file can be selected again if needed
            e.target.value = '';

            const reader = new FileReader();
            reader.onload = (event) => {
                const image = new Image();
                image.onload = () => {
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    context.drawImage(image, 0, 0);
                    
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    
                    if (typeof jsQR === 'undefined') {
                        alert('jsQR library is not loaded. Please ensure jsQR.js is included in popup.html');
                        return;
                    }

                    // Menggunakan library jsQR
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    
                    if (code) {
                        processQRCode(code.data);
                    } else {
                        alert('QR Code tidak terdeteksi. Pastikan gambar jelas.');
                    }
                };
                image.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function processQRCode(rawValue) {
        try {
            // Format standar: otpauth://totp/Issuer:Account?secret=KODE&issuer=Issuer
            const url = new URL(rawValue);
            if (url.protocol !== 'otpauth:') {
                throw new Error('Bukan format 2FA yang valid');
            }

            const params = new URLSearchParams(url.search);
            const secret = params.get('secret');
            
            // Ambil issuer dari parameter atau dari pathname
            let issuer = params.get('issuer') || url.pathname.split('/').pop().split(':')[0];
            issuer = decodeURIComponent(issuer);

            if (secret) {
                issuerInput.value = issuer;
                // Sanitize secret (remove spaces, dashes, padding)
                const cleanSecret = secret.replace(/[\s\-=]/g, '').toUpperCase();
                
                saveAccount(issuer, cleanSecret).then(() => {
                    alert(`Berhasil menambahkan akun: ${issuer}`);
                    addForm.classList.add('hidden');
                    codesList.classList.remove('hidden');
                    loadAccounts();
                });
            } else {
                alert('QR Code does not contain a secret key.');
            }
        } catch (e) {
            console.error(e);
            alert('Format QR Code tidak dikenali.');
        }
    }

    saveBtn.addEventListener('click', async () => {
        const issuer = issuerInput.value.trim();
        // Remove spaces, dashes, and padding (=) characters
        const secret = secretInput.value.trim().replace(/[\s\-=]/g, '').toUpperCase();

        if (!issuer || !secret) {
            alert('Please fill in both fields.');
            return;
        }

        // Basic validation for Base32
        if (!/^[A-Z2-7]+$/.test(secret)) {
            alert('Invalid Secret Key. It should only contain letters A-Z and numbers 2-7.');
            return;
        }

        await saveAccount(issuer, secret);
        addForm.classList.add('hidden');
        codesList.classList.remove('hidden');
        clearInputs();
        loadAccounts();
    });

    function clearInputs() {
        issuerInput.value = '';
        secretInput.value = '';
    }

    async function saveAccount(issuer, secret) {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['accounts'], (result) => {
                const accounts = result.accounts || [];
                accounts.push({ issuer, secret, id: Date.now() });
                chrome.storage.sync.set({ accounts }, resolve);
            });
        });
    }

    function loadAccounts() {
        chrome.storage.sync.get(['accounts'], (result) => {
            const accounts = result.accounts || [];
            renderAccounts(accounts);
        });
    }

    async function renderAccounts(accounts) {
        codesList.innerHTML = '';
        if (accounts.length === 0) {
            codesList.innerHTML = '<div class="empty-state">No accounts added yet.</div>';
            return;
        }

        for (const account of accounts) {
            const code = await generateTOTP(account.secret);
            
            const item = document.createElement('div');
            item.className = 'code-item';
            item.innerHTML = `
                <div>
                    <span class="account-name">${account.issuer}</span>
                    <div class="code-display">${code}</div>
                </div>
                <div class="delete-btn" data-id="${account.id}">
                    <svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events: none;">
                        <path fill="#ccc" d="M6,19c0,1.1,0.9,2,2,2h8c1.1,0,2-0.9,2-2V7H6V19z M19,4h-3.5l-1-1h-5l-1,1H5v2h14V4z"/>
                    </svg>
                </div>
            `;
            codesList.appendChild(item);
        }

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                deleteAccount(id);
            });
        });
    }

    function deleteAccount(id) {
        if(!confirm("Remove this account?")) return;
        
        chrome.storage.sync.get(['accounts'], (result) => {
            const accounts = result.accounts || [];
            const newAccounts = accounts.filter(acc => acc.id !== id);
            chrome.storage.sync.set({ accounts: newAccounts }, loadAccounts);
        });
    }

    function refreshCodes() {
        // Only re-render if the list is visible
        if (!codesList.classList.contains('hidden')) {
            loadAccounts();
        }
    }

    async function generateTOTP(secret) {
        try {
            const keyData = base32toBuffer(secret);
            const key = await window.crypto.subtle.importKey(
                "raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
            );

            const epoch = Math.floor(Date.now() / 1000);
            const timeStep = 30;
            const counter = Math.floor(epoch / timeStep);

            const counterBuf = new ArrayBuffer(8);
            const dataView = new DataView(counterBuf);
            dataView.setBigUint64(0, BigInt(counter), false); // Big-endian

            const signature = await window.crypto.subtle.sign("HMAC", key, counterBuf);
            const signatureArray = new Uint8Array(signature);

            const offset = signatureArray[signatureArray.length - 1] & 0xf;
            const binary =
                ((signatureArray[offset] & 0x7f) << 24) |
                ((signatureArray[offset + 1] & 0xff) << 16) |
                ((signatureArray[offset + 2] & 0xff) << 8) |
                (signatureArray[offset + 3] & 0xff);

            const otp = binary % 1000000;
            return otp.toString().padStart(6, '0');
        } catch (e) {
            return "ERROR";
        }
    }

    function base32toBuffer(base32) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        base32 = base32.replace(/\s/g, '').replace(/=+$/, '').toUpperCase();
        const len = base32.length;
        const buffer = new Uint8Array(Math.floor(len * 5 / 8));
        
        let bits = 0;
        let value = 0;
        let index = 0;

        for (let i = 0; i < len; i++) {
            const val = alphabet.indexOf(base32[i]);
            if (val === -1) continue;

            value = (value << 5) | val;
            bits += 5;

            if (bits >= 8) {
                buffer[index++] = (value >>> (bits - 8)) & 255;
                bits -= 8;
                value &= (1 << bits) - 1; // Mencegah overflow
            }
        }
        return buffer.buffer;
    }

    document.getElementById("startBtn").addEventListener("click", async () => {
        console.log('clicked')
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.tabs.sendMessage(tab.id, { type: "START_SNIP" }, (response) => {
            if (chrome.runtime.lastError) {
                alert("Cannot scan this page. Please refresh the page and try again. (Note: Scanning does not work on chrome:// or system pages)");
                console.error("Connection error:", chrome.runtime.lastError.message);
            } else {
                window.close();
            }
        });
    });
});