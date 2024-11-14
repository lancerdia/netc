// 获取子域名并存储在全局变量中
const cid = window.location.hostname.split('.')[0];

// Modal elements
const modalOverlay = document.getElementById('modalOverlay');
const openModalButton = document.getElementById('openModal');
const closeButton = document.getElementById('closeButton');
const confirmButton = document.getElementById('confirmButton');
const contactInput = document.getElementById('contact');

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒
const TIMEOUT = 5000; // 5秒

// 打开"联系方式录入"弹窗
openModalButton.addEventListener('click', (e) => {
    e.preventDefault();
    modalOverlay.style.display = 'block';
});

// 关闭弹窗
closeButton.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
});

// 验证表单
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

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 提交数据的核心函数
async function submitData(contact, cid, retryCount = 0) {
    const endpoints = [
        'https://myworker1.vipspeed.cloud/api/submit',
        // 可以添加备用 endpoint
    ];

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT);
    });

    for (const endpoint of endpoints) {
        try {
            const response = await Promise.race([
                fetch(endpoint, {
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

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('提交成功:', data);
            return true;

        } catch (error) {
            console.error(`尝试提交到 ${endpoint} 失败:`, error);
            
            // 如果还有重试次数，等待后重试
            if (retryCount < MAX_RETRIES) {
                console.log(`将在 ${RETRY_DELAY/1000} 秒后重试，剩余重试次数: ${MAX_RETRIES - retryCount}`);
                await delay(RETRY_DELAY);
                return submitData(contact, cid, retryCount + 1);
            }
            
            // 如果是最后一个 endpoint 且没有重试次数了，备份数据到 localStorage
            if (endpoint === endpoints[endpoints.length - 1]) {
                const backupData = {
                    contact,
                    cid,
                    timestamp: new Date().toISOString()
                };
                
                // 保存到 localStorage
                const backupList = JSON.parse(localStorage.getItem('contactBackups') || '[]');
                backupList.push(backupData);
                localStorage.setItem('contactBackups', JSON.stringify(backupList));
                
                console.error('所有提交尝试均失败，数据已备份到 localStorage');
                return false;
            }
        }
    }
}

// 提交按钮事件处理
confirmButton.addEventListener('click', async () => {
    const contact = contactInput.value.trim();
    
    if (!contact || !cid) return;

    confirmButton.disabled = true;
    
    try {
        const success = await submitData(contact, cid);
        
        if (success) {
            modalOverlay.style.display = 'none';
            alert('提交成功！');
        } else {
            alert('提交失败，但数据已被保存。我们会在网络恢复后自动重新提交。');
        }
    } catch (error) {
        console.error('提交过程发生错误:', error);
        alert('提交时发生错误，请稍后重试或联系我司工作人员。');
    } finally {
        confirmButton.disabled = false;
    }
});


// 定期检查并重新提交备份数据
async function checkAndSubmitBackups() {
    const backupList = JSON.parse(localStorage.getItem('contactBackups') || '[]');
    
    if (backupList.length === 0) return;
    
    const newBackupList = [];
    
    for (const backup of backupList) {
        try {
            const success = await submitData(backup.contact, backup.cid);
            if (!success) {
                newBackupList.push(backup);
            }
        } catch (error) {
            console.error('重新提交备份数据失败:', error);
            newBackupList.push(backup);
        }
    }
    
    localStorage.setItem('contactBackups', JSON.stringify(newBackupList));
}

// 每5秒检查一次备份数据
setInterval(checkAndSubmitBackups, 5 * 1000);


// 页面加载时验证表单
validateForm();