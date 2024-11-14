// 获取子域名并存储在全局变量中
const cid = window.location.hostname.split('.')[0];

// Modal elements
const modalOverlay = document.getElementById('modalOverlay');
const openModalButton = document.getElementById('openModal');
const closeButton = document.getElementById('closeButton');
const confirmButton = document.getElementById('confirmButton');
const contactInput = document.getElementById('contact');

// Open modal
openModalButton.addEventListener('click', (e) => {
    e.preventDefault();
    modalOverlay.style.display = 'block';
});

// Close modal
closeButton.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
});

// Validate form
function validateForm() {
    const contact = contactInput.value.trim();
    if (contact && cid) {
        confirmButton.classList.add('active');
        confirmButton.disabled = false;
    } else {
        confirmButton.classList.remove('active');
        confirmButton.disabled = true;
    }
}

// Handle form submission
confirmButton.addEventListener('click', async () => {
    const contact = contactInput.value.trim();
    
    if (!contact || !cid) return;

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 4000);
    });

    try {
        // 发送到 Cloudflare Worker
        await Promise.race([
            fetch('https://contact-form.lancerdia.workers.dev', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contact,
                    cid
                })
            }),
            timeoutPromise
        ]);

        modalOverlay.style.display = 'none';
    } catch (error) {
        if (error.message === 'Timeout') {
            console.log('等待4秒后，后台无响应');
        }
        modalOverlay.style.display = 'none';
    }
});

// Initialize form validation
validateForm();