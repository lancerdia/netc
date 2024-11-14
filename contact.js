// 获取子域名并存储在全局变量中
const cid = window.location.hostname.split('.')[0];

// Modal elements
const modalOverlay = document.getElementById('modalOverlay');
const openModalButton = document.getElementById('openModal');
const closeButton = document.getElementById('closeButton');
const confirmButton = document.getElementById('confirmButton');
const contactInput = document.getElementById('contact');

// Loading overlay elements
const loadingOverlay = document.createElement('div');
loadingOverlay.className = 'loading-overlay';
loadingOverlay.innerHTML = `
    <div class="loading-content">
        <div class="loader"></div>
        <div class="loading-text">信息提交中，请稍候...</div>
    </div>
`;
document.body.appendChild(loadingOverlay);

// Message overlay for success/error
const messageOverlay = document.createElement('div');
messageOverlay.className = 'message-overlay';
messageOverlay.innerHTML = `
    <div class="message-content">
        <div class="message-text"></div>
    </div>
`;
document.body.appendChild(messageOverlay);

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒
const SUBMISSION_TIMEOUT = 4000; // 4秒
const RETRY_TIMEOUT = 2000; // 2秒重试阈值
const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/0ca19c20-f040-494f-b3d2-2527aa21ede6';
const FEISHU_KEY = 'QLIG0SgEX8k2ppB3CaVuOc';

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 显示加载动画
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

// 隐藏加载动画
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// 显示消息
async function showMessage(message, duration = 1500) {
    messageOverlay.querySelector('.message-text').textContent = message;
    messageOverlay.style.display = 'flex';
    await delay(duration);
    messageOverlay.style.display = 'none';
}

// 提交到飞书
async function submitToFeishu(contact, cid, retryCount = 0) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), RETRY_TIMEOUT);
    });

    try {
        const response = await Promise.race([
            fetch(FEISHU_WEBHOOK, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    msg_type: 'text',
                    content: {
                        text: `新联系方式提交\n联系方式: ${contact}\n子域名: ${cid}`
                    }
                })
            }),
            timeoutPromise
        ]);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('飞书提交失败:', error);
        if (retryCount < MAX_RETRIES) {
            await delay(RETRY_DELAY);
            return submitToFeishu(contact, cid, retryCount + 1);
        }
        return false;
    }
}

// 提交到 Cloudflare Worker
async function submitToWorker(contact, cid, retryCount = 0) {
    const endpoint = 'https://myworker1.vipspeed.cloud/api/submit';
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), RETRY_TIMEOUT);
    });

    try {
        const response = await Promise.race([
            fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ contact, cid })
            }),
            timeoutPromise
        ]);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('Worker提交失败:', error);
        if (retryCount < MAX_RETRIES) {
            await delay(RETRY_DELAY);
            return submitToWorker(contact, cid, retryCount + 1);
        }
        return false;
    }
}

// 提交数据的主函数
async function submitData(contact, cid) {
    showLoading();
    
    let workerSuccess = false;
    let feishuSuccess = false;
    
    // 启动两个提交过程
    const workerPromise = submitToWorker(contact, cid);
    const feishuPromise = submitToFeishu(contact, cid);
    
    // 开始计时和检查
    const startTime = Date.now();
    
    while (Date.now() - startTime < SUBMISSION_TIMEOUT) {
        // 检查 Worker 响应
        if (!workerSuccess) {
            workerSuccess = await Promise.race([workerPromise, delay(1000)]);
            if (workerSuccess) break;
        }
        
        // 检查飞书响应
        if (!feishuSuccess) {
            feishuSuccess = await Promise.race([feishuPromise, delay(1000)]);
        }
        
        await delay(1000);
    }
    
    hideLoading();
    
    if (workerSuccess || feishuSuccess) {
        await showMessage('已提交，客服稍候将与您联系。');
        await delay(500);
        modalOverlay.style.display = 'none';
        return true;
    } else {
        await showMessage('抱歉！提交失败，请联系我司工作人员人工处理。');
        await delay(500);
        modalOverlay.style.display = 'none';
        return false;
    }
}

// Event listeners
openModalButton.addEventListener('click', (e) => {
    e.preventDefault();
    modalOverlay.style.display = 'block';
});

closeButton.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
});

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

confirmButton.addEventListener('click', async () => {
    const contact = contactInput.value.trim();
    if (!contact || !cid) return;
    
    confirmButton.disabled = true;
    await submitData(contact, cid);
    confirmButton.disabled = false;
});

// 页面加载时验证表单
validateForm();