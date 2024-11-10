document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('imageInput');
    const originalImage = document.getElementById('originalImage');
    const compressedImage = document.getElementById('compressedImage');
    const originalSize = document.getElementById('originalSize');
    const compressedSize = document.getElementById('compressedSize');
    const downloadBtn = document.getElementById('downloadBtn');
    const customSize = document.getElementById('customSize');
    const customCompressBtn = document.getElementById('customCompressBtn');
    const clearBtn = document.getElementById('clearBtn');

    let originalFile = null;
    let compressedImageBlob = null;
    let previousCompressedFile = null;

    const successModal = document.getElementById('successModal');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    const imagePreviewModal = document.getElementById('imagePreviewModal');
    const previewImage = document.getElementById('previewImage');
    const closeButton = document.querySelector('.close-button');

    // 在文件头添加缓存对象
    let imageCache = new Map();

    const errorModal = document.getElementById('errorModal');

    // 添加输入框事件处理
    customSize.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            // 触发压缩按钮点击事件
            customCompressBtn.click();
        }
    });

    // 添加输入框聚焦事件
    customSize.addEventListener('focus', function() {
        if (this.value === '0') {
            this.value = '';
        }
    });

    // 添加输入框失去焦点事件
    customSize.addEventListener('blur', function() {
        if (this.value === '') {
            this.value = '0';
        }
    });

    // 添加文件大小格式化函数
    function formatFileSize(bytes) {
        const kb = Math.round(bytes / 1024);
        const mb = (bytes / (1024 * 1024)).toFixed(2);
        return `${kb} KB (${mb} MB)`;
    }

    // 修改压缩图片的函数，使用更精确的压缩策略
    async function compressImage(file, maxSizeMB) {
        let img = null;
        let objectUrl = null;
        
        try {
            if (!file.type.startsWith('image/')) {
                throw new Error('不支持的文件类型');
            }

            img = new Image();
            objectUrl = URL.createObjectURL(file);
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = objectUrl;
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);

            const targetSize = maxSizeMB * 1024 * 1024;
            let bestBlob = null;
            let bestDiff = Infinity;
            let quality = 1;
            
            // 使用更密集的质量值
            const qualitySteps = [];
            for (let q = 1; q >= 0.01; q -= 0.01) {
                qualitySteps.push(parseFloat(q.toFixed(3)));
            }

            // 第一阶段：遍历所有质量值
            for (quality of qualitySteps) {
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', quality);
                });

                const diff = Math.abs(blob.size - targetSize);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestBlob = blob;

                    // 如果误差小于100字节，立即返回
                    if (diff < 100) {
                        return blob;
                    }
                }

                // 如果已经小于目标大小，进行微调
                if (blob.size < targetSize && diff < 1024) {  // 1KB以内的误差
                    // 在当前质量附近进行精细调整
                    const fineQualities = [
                        quality + 0.008,
                        quality + 0.005,
                        quality + 0.003,
                        quality + 0.001,
                        quality - 0.001,
                        quality - 0.003,
                        quality - 0.005,
                        quality - 0.008
                    ].filter(q => q > 0 && q < 1);

                    for (const fineQuality of fineQualities) {
                        const fineBlob = await new Promise(resolve => {
                            canvas.toBlob(resolve, 'image/jpeg', fineQuality);
                        });

                        const fineDiff = Math.abs(fineBlob.size - targetSize);
                        if (fineDiff < bestDiff) {
                            bestDiff = fineDiff;
                            bestBlob = fineBlob;

                            // 如果误差小于100字节，立即返回
                            if (fineDiff < 100) {
                                return fineBlob;
                            }
                        }
                    }
                    break;
                }
            }

            // 最后的微调
            if (bestBlob && bestDiff > 100) {  // 如果误差仍然大于100字节
                const currentSize = bestBlob.size;
                const ratio = targetSize / currentSize;
                const finalQuality = Math.max(0.01, Math.min(1, quality * ratio));
                
                const finalBlob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', finalQuality);
                });

                if (Math.abs(finalBlob.size - targetSize) < bestDiff) {
                    bestBlob = finalBlob;
                }
            }

            return bestBlob;
        } catch (error) {
            console.error('压缩过程出错:', error);
            alert('图片压缩失败，请重试！');
            throw error; // 抛出错误以便外部捕获
        } finally {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
            if (img) {
                img.src = '';
            }
        }
    }

    // 修改 updateCompressedImage 函数
    function updateCompressedImage(compressedFile) {
        compressedImageBlob = compressedFile;
        const compressedUrl = URL.createObjectURL(compressedFile);
        compressedImage.src = compressedUrl;
        
        const compressedImg = new Image();
        compressedImg.onload = function() {
            document.getElementById('compressedDimensions').textContent = 
                `尺寸: ${this.width} × ${this.height}`;
        }
        compressedImg.src = compressedUrl;
        
        // 使用用户输入的目标大小
        const targetSizeKB = parseFloat(customSize.value);
        
        // 显示实际压缩后的大小
        const actualSizeKB = Math.round(compressedFile.size / 1024);
        const actualSizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
        
        // 如果实际大小与目标大小的差异在1KB以内，显示目标大小
        if (Math.abs(actualSizeKB - targetSizeKB) <= 1) {
            compressedSize.textContent = `大小: ${targetSizeKB} KB (${(targetSizeKB / 1024).toFixed(2)} MB)`;
        } else {
            compressedSize.textContent = `大小: ${actualSizeKB} KB (${actualSizeMB} MB)`;
        }
        
        downloadBtn.disabled = false;
    }

    imageInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        originalFile = file;
        const originalUrl = URL.createObjectURL(file);
        originalImage.src = originalUrl;
        
        const img = new Image();
        img.onload = function() {
            document.getElementById('originalDimensions').textContent = 
                `尺寸: ${this.width} × ${this.height}`;
        }
        img.src = originalUrl;
        
        originalSize.textContent = `大小: ${formatFileSize(file.size)}`;
        customCompressBtn.disabled = false;

        // 清空压缩后的图片显示
        compressedImage.src = '';
        compressedSize.textContent = '';
        document.getElementById('compressedDimensions').textContent = '';
        compressedImageBlob = null;
        downloadBtn.disabled = true;

        // 重置输入框值为0
        customSize.value = '0';
        // 同时更新MB显示
        sizeInMB.textContent = '0';
    });

    // 修改自定义压缩大小的点击事件处理
    customCompressBtn.addEventListener('click', async function() {
        if (!originalFile) return;
        
        const targetSizeKB = parseFloat(customSize.value);
        if (isNaN(targetSizeKB) || targetSizeKB <= 0) {
            alert('请输入有效的目标大小！');
            return;
        }

        // 检查压缩大小是否超过原始图片大小
        const originalSizeKB = originalFile.size / 1024;
        if (targetSizeKB >= originalSizeKB) {
            errorModal.style.display = 'flex';
            // 添加关闭按钮事件
            const closeErrorButton = errorModal.querySelector('.close-button');
            closeErrorButton.onclick = function() {
                errorModal.style.display = 'none';
                customSize.value = '0'; // 重置输入值
                customSize.focus(); // 聚焦输入框
            };

            // 点击模态框外部关闭
            errorModal.onclick = function(e) {
                if (e.target === errorModal) {
                    errorModal.style.display = 'none';
                    customSize.value = '0'; // 重置输入值
                    customSize.focus(); // 聚焦输入框
                }
            };

            return;
        }

        try {
            previousCompressedFile = compressedImageBlob;
            
            // 将KB转换为MB进行压缩
            const targetSizeMB = targetSizeKB / 1024;
            const compressedFile = await compressImage(originalFile, targetSizeMB);
            
            if (compressedFile) {  // 确保压缩成功
                // 更新模态框中的文本
                const modalTitle = successModal.querySelector('h2');
                modalTitle.textContent = `确定要压缩到${targetSizeKB} KB (${(targetSizeKB / 1024).toFixed(2)} MB)吗？`;
                
                // 显示模态框
                successModal.style.display = 'flex';
                
                // 确认按钮点击事件
                confirmBtn.onclick = function() {
                    successModal.style.display = 'none';
                    updateCompressedImage(compressedFile);  // 使用压缩后的文件
                    previousCompressedFile = compressedFile;
                };
                
                // 取消按钮点击事件
                cancelBtn.onclick = function() {
                    successModal.style.display = 'none';
                    if (previousCompressedFile) {
                        updateCompressedImage(previousCompressedFile);
                    } else {
                        // 如果没有之前的状态，清空压缩后的显示
                        compressedImage.src = '';
                        compressedSize.textContent = '';
                        document.getElementById('compressedDimensions').textContent = '';
                        compressedImageBlob = null;
                        downloadBtn.disabled = true;
                    }
                };
            }
        } catch (error) {
            console.error('压缩失败:', error);
            alert('图片压缩失败，请重试！');
        }
    });

    // 点击模态框外部关闭的处理也需要修改
    successModal.addEventListener('click', function(e) {
        if (e.target === successModal) {
            successModal.style.display = 'none';
            // 点击外部闭时的行为与取消相同
            if (previousCompressedFile) {
                updateCompressedImage(previousCompressedFile);
            } else {
                // 如果没有之前的状态，清空压缩后的显示
                compressedImage.src = '';
                compressedSize.textContent = '';
                document.getElementById('compressedDimensions').textContent = '';
                compressedImageBlob = null;
                downloadBtn.disabled = true;
            }
        }
    });

    downloadBtn.addEventListener('click', function() {
        if (!compressedImageBlob) return;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(compressedImageBlob);
        link.download = 'compressed-image.jpg';
        link.click();
    });

    // 修改预览图片函数
    function showPreviewImage(src, size, dimensions, blob) {
        // 立即显示加载状态
        imagePreviewModal.style.display = 'flex';
        
        // 检查存
        if (imageCache.has(src)) {
            previewImage.src = imageCache.get(src);
        } else {
            // 如果没有缓存，创建新的对象URL并缓存
            const objectUrl = URL.createObjectURL(blob);
            imageCache.set(src, objectUrl);
            previewImage.src = objectUrl;
        }

        // 移除旧信息元素并创建新的（使用 DocumentFragment 优化）
        const fragment = document.createDocumentFragment();
        const infoDiv = document.createElement('div');
        infoDiv.className = 'preview-info';
        infoDiv.innerHTML = `${size}<br>${dimensions}`;
        fragment.appendChild(infoDiv);

        // 移除旧的信息元素
        const oldInfo = imagePreviewModal.querySelector('.preview-info');
        if (oldInfo) {
            oldInfo.remove();
        }

        // 使用 requestAnimationFrame 优化渲染
        requestAnimationFrame(() => {
            const modalContent = imagePreviewModal.querySelector('.image-preview-content');
            modalContent.appendChild(fragment);
        });
    }

    // 修改图片点击事件，使用缓存
    originalImage.addEventListener('click', function() {
        if (this.src && originalFile) {
            const imageInfo = {
                size: originalSize.textContent,
                dimensions: document.getElementById('originalDimensions').textContent
            };
            showPreviewImage(this.src, imageInfo.size, imageInfo.dimensions, originalFile);
        }
    });

    compressedImage.addEventListener('click', function() {
        if (this.src && compressedImageBlob) {
            const imageInfo = {
                size: compressedSize.textContent,
                dimensions: document.getElementById('compressedDimensions').textContent
            };
            showPreviewImage(this.src, imageInfo.size, imageInfo.dimensions, compressedImageBlob);
        }
    });

    // 修改关闭预览函数，清理缓存
    function closePreview() {
        imagePreviewModal.style.display = 'none';
        const infoDiv = imagePreviewModal.querySelector('.preview-info');
        if (infoDiv) {
            infoDiv.remove();
        }
    }

    // 修改预览模态框的关闭按钮事件监听
    imagePreviewModal.querySelector('.close-button').addEventListener('click', function() {
        closePreview();
    });

    // 点击模态框外部关闭
    imagePreviewModal.addEventListener('click', function(e) {
        if (e.target === imagePreviewModal) {
            closePreview();
        }
    });

    // ESC键关闭
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && imagePreviewModal.style.display === 'flex') {
            closePreview();
        }
    });

    // 修改清空功能函数
    function clearImages() {
        // 清空原始图片
        originalImage.src = '';
        originalSize.textContent = '';
        document.getElementById('originalDimensions').textContent = '';
        originalFile = null;

        // 清空压缩后图片
        compressedImage.src = '';
        compressedSize.textContent = '';
        document.getElementById('compressedDimensions').textContent = '';
        compressedImageBlob = null;
        previousCompressedFile = null;

        // 重置按钮状态
        downloadBtn.disabled = true;
        customCompressBtn.disabled = true;

        // 重置输入框
        imageInput.value = '';
        customSize.value = '0';
        sizeInMB.textContent = '0';

        // 清理图片缓存
        imageCache.forEach(url => URL.revokeObjectURL(url));
        imageCache.clear();
    }

    // 添加清空按钮点击事件
    clearBtn.addEventListener('click', clearImages);

    // 在页面卸载时清理缓存
    window.addEventListener('beforeunload', function() {
        imageCache.forEach(url => URL.revokeObjectURL(url));
        imageCache.clear();
    });

    // 设置默认压缩大小为0
    customSize.value = '0';

    // ESC键也可以关闭错误模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (errorModal.style.display === 'flex') {
                errorModal.style.display = 'none';
                customSize.value = '0';
                customSize.focus();
            }
            // ... 其他模态框的ESC处理保持不变 ...
        }
    });

    // 在 DOMContentLoaded 事件中添加
    const sizeInKB = document.getElementById('sizeInKB');

    // 添加输入框值变化事件
    customSize.addEventListener('input', function() {
        const kbValue = parseFloat(this.value) || 0;
        sizeInKB.textContent = Math.round(kbValue * 1024);
    });

    // 修改输入框失去焦点事件
    customSize.addEventListener('blur', function() {
        if (this.value === '') {
            this.value = '0';
            sizeInKB.textContent = '0';
        }
    });

    // 修改输入框值变化事件，计算MB值
    customSize.addEventListener('input', function() {
        const kbValue = parseFloat(this.value) || 0;
        sizeInMB.textContent = (kbValue / 1024).toFixed(2);
    });

    // 修改输入框失去焦点事件
    customSize.addEventListener('blur', function() {
        if (this.value === '') {
            this.value = '0';
            sizeInMB.textContent = '0';
        }
    });
}); 