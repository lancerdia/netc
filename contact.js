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
const SUBMISSION_TIMEOUT = 9000; // 总体提交超时时间保持9秒
const WORKER_TIMEOUT = 3500; // Worker 单次请求超时改为3.5秒
const FEISHU_TIMEOUT = 3500; // 飞书单次请求超时改为3.5秒
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
async function showSuccessMessage(message, duration = 1800) {
  const messageOverlay = document.querySelector('.message-overlay');
  const messageContainer = document.createElement('div');
  messageContainer.classList.add('message-container');

  const checkmarkAnimation = document.createElement('div');
  checkmarkAnimation.classList.add('checkmark-animation');
  checkmarkAnimation.innerHTML = `
    <svg viewBox="0 0 52 52">
      <path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
    </svg>
  `;
  messageContainer.appendChild(checkmarkAnimation);

  const messageText = document.createElement('div');
  messageText.classList.add('message-text');
  messageText.textContent = message.replace('\n', '\n');
  messageContainer.appendChild(messageText);

  messageOverlay.classList.add('success');
  messageOverlay.appendChild(messageContainer);
  messageOverlay.style.display = 'flex';

  await delay(duration);

  messageOverlay.style.display = 'none';
  messageOverlay.innerHTML = '';
  messageOverlay.classList.remove('success');
}

async function showErrorMessage(message, duration = 180000) {
  const messageOverlay = document.querySelector('.message-overlay');
  const messageContainer = document.createElement('div');
  messageContainer.classList.add('message-container');

  const xAnimation = document.createElement('div');
  xAnimation.classList.add('x-animation');
  xAnimation.innerHTML = `
    <svg viewBox="0 0 52 52">
      <path d="M35.7 16.3l-19.4 19.4M16.3 16.3l19.4 19.4" />
    </svg>
  `;
  messageContainer.appendChild(xAnimation);

  const messageText = document.createElement('div');
  messageText.classList.add('message-text');
  messageText.textContent = message.replace('\n', '\n');
  messageContainer.appendChild(messageText);

  messageOverlay.classList.add('error');
  messageOverlay.appendChild(messageContainer);
  messageOverlay.style.display = 'flex';

  await delay(duration);

  messageOverlay.style.display = 'none';
  messageOverlay.innerHTML = '';
  messageOverlay.classList.remove('error');
}

async function showMessage(message, duration = 1800) {
  // 将原有的单行文字分割成两行
  const lines = message.split('\n');
  // 更新 messageOverlay 中的文字内容
  messageOverlay.querySelector('.message-text').innerHTML = lines.join('<br>');
  messageOverlay.style.display = 'flex';
  await delay(duration);
  messageOverlay.style.display = 'none';
}

// 提交到飞书
async function submitToFeishu(contact, cid, retryCount = 0) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FEISHU_TIMEOUT);

        const response = await fetch(FEISHU_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                msg_type: 'text',
                content: {
                    text: `新联系方式提交\n联系方式: ${contact}\n子域名: ${cid}`
                }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log(`飞书提交成功`);
        const data = await response.json();
        return data.StatusCode === 0 || data.code === 0;

    } catch (error) {
        console.error('飞书提交失败:', error);
        
        // 如果是超时或网络错误，且还有重试次数，则重试
        if ((error.name === 'AbortError' || error.name === 'TypeError') && retryCount < MAX_RETRIES) {
            console.log(`飞书提交超时，正在进行第${retryCount + 1}次重试`);
            await delay(RETRY_DELAY);
            return submitToFeishu(contact, cid, retryCount + 1);
        }
        
        return false;
    }
}

// 提交到 Cloudflare Worker
async function submitToWorker(contact, cid, retryCount = 0) {
    const endpoint = 'https://myworker1.vipspeed.cloud/api/submit';
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), WORKER_TIMEOUT);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contact, cid }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log(`Worker提交成功`);
        const data = await response.json();
        return data.status === 'success';

    } catch (error) {
        console.error('Worker提交失败:', error);
        
        // 如果是超时或网络错误，且还有重试次数，则重试
        if ((error.name === 'AbortError' || error.name === 'TypeError') && retryCount < MAX_RETRIES) {
            console.log(`Worker提交超时，正在进行第${retryCount + 1}次重试`);
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
    let workerPromise = submitToWorker(contact, cid);
    let feishuPromise = submitToFeishu(contact, cid);
    
    const startTime = Date.now();
    
    try {
        // 使用 Promise.race 同时等待两个提交结果和总超时
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, SUBMISSION_TIMEOUT));
        
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
            
            if (workerSuccess || feishuSuccess) break;
            await delay(1000);
        }
        
        hideLoading();
        
        if (workerSuccess || feishuSuccess) {
            await showSuccessMessage('已提交\n客服稍后将与您联系');
            await delay(400);
            modalOverlay.style.display = 'none';
            return true;
        } else {
            await showErrorMessage('抱歉！提交失败\n请联系我司人员处理');
            await delay(400);
            modalOverlay.style.display = 'none';
            return false;
        }
    } catch (error) {
        console.error('提交过程发生错误:', error);
        hideLoading();
        await showErrorMessage('抱歉！提交失败\n请联系我司人员处理');
        await delay(400);
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