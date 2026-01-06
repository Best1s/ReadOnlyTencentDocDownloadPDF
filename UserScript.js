// ==UserScript==
// @name         腾讯文档导出PDF-极速版（参考极简逻辑）
// @namespace    http://tampermonkey.net/
// @version      10.0
// @description  极简逻辑+极致提速，保留白背景修复，无冗余等待
// @author       User
// @match        https://docs.qq.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @require      https://cdn.bootcdn.net/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// ==/UserScript==

(async () => {
    'use strict';

    // 极简工具函数（仅保留必要）
    const waitForJSPDF = () => new Promise(resolve => {
        const check = () => window.jspdf ? resolve() : setTimeout(check, 200);
        check();
    });
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // 极致提速配置（基于你的参考逻辑调优）
    const CONFIG = {
        chapterWait: 2000,      // 章节切换等待从3500→2000（大幅提速）
        scrollDelay: 800,       // 滚动后等待从1200→800（减少无意义等待）
        scrollStep: 0.9,        // 滚动步长从0.7→0.9（单次滚动更多，减少循环次数）
        stableChecks: 4,        // 稳定检查轮次从8→4（减少无效循环）
        maxScrollTime: 40000,   // 章节超时从60000→40000（缩短无效等待）
    };

    // 沿用参考脚本的滚动容器选择逻辑（确保滚动有效）
    const getMainScroller = () => {
        return document.querySelector('.navigation-panel-scroller') ||
               document.querySelector('.melo-editor-canvas-container') ||
               document.querySelector('.page-content-container') ||
               document.documentElement;
    };

    // 沿用参考脚本的大纲获取逻辑（极简去重）
    const getValidChapters = () => {
        const textElements = document.querySelectorAll('.headline-inner-text');
        const chapters = new Set();
        textElements.forEach(textEl => {
            let parent = textEl.parentElement;
            for (let i = 0; i < 6 && parent; i++) {
                if (parent.onclick || parent.getAttribute('role') === 'button' || /outline|headline/i.test(parent.className)) {
                    chapters.add(parent);
                    break;
                }
                parent = parent.parentElement;
            }
        });
        return Array.from(chapters).filter((item, index, self) =>
            index === self.findIndex(t => t.innerText.trim() === item.innerText.trim())
        );
    };

    // 仅保留必要的白背景修复（解决黑背景，不新增任何冗余逻辑）
    const processCanvasToDataURL = (canvas) => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');
        // 填充白色背景（唯一修复点，其余完全复用参考逻辑）
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(canvas, 0, 0);
        // 用JPEG格式（比PNG快、体积小）
        return tempCanvas.toDataURL('image/jpeg', 0.9);
    };

    // 沿用参考脚本的按钮样式（仅微调提示文字）
    const btn = document.createElement('button');
    btn.innerHTML = '⚡ 极速导出PDF';
    btn.style = 'position:fixed;top:60px;right:20px;z-index:9999;padding:10px 15px;background:#007BFF;color:#fff;border:none;border-radius:4px;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.2);';
    // 防止重复添加按钮
    if (!document.querySelector('[style*="z-index:9999"][innerHTML="⚡ 极速导出PDF"]')) {
        document.body.appendChild(btn);
    }

    btn.onclick = async () => {
        btn.disabled = true;
        btn.innerHTML = '捕获中...';
        try {
            await startExport();
            alert('⚡ 极速导出完成！');
        } catch (e) {
            alert(`导出失败：${e.message}`);
            console.error('失败详情：', e);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '⚡ 极速导出PDF';
        }
    };

    // 完全复用参考脚本的核心导出逻辑（无任何冗余修改）
    async function startExport() {
        await waitForJSPDF();
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });

        const chapters = getValidChapters();
        const scroller = getMainScroller();

        if (!chapters.length) return alert('未找到大纲，请确保大纲已展开');

        const allCanvases = new Set();
        for (let i = 0; i < chapters.length; i++) {
            const chapterName = chapters[i].innerText.trim();
            console.log(`\n[TDOCS] 采集章节: ${chapterName}`);

            chapters[i].click();
            await sleep(CONFIG.chapterWait); // 极简章节等待

            // 极简智能滚动（完全复用参考逻辑，仅调优参数）
            let scrollPos = 0;
            let stableRounds = 0;
            const startTime = Date.now();
            let lastCanvasCount = allCanvases.size;

            while (stableRounds < CONFIG.stableChecks) {
                if (Date.now() - startTime > CONFIG.maxScrollTime) {
                    console.warn(`[TDOCS] 章节 [${chapterName}] 滚动超时`);
                    break;
                }

                // 大跨步滚动（0.9倍可视区，减少循环次数）
                scrollPos += scroller.clientHeight * CONFIG.scrollStep;
                scroller.scrollTop = scrollPos;
                await sleep(CONFIG.scrollDelay); // 极短滚动等待

                // 极简Canvas捕获（仅判断是否新增，无冗余检测）
                const currentCanvases = document.querySelectorAll('.melo-page-canvas-view canvas');
                let addedThisRound = 0;
                currentCanvases.forEach(c => {
                    if (!allCanvases.has(c)) {
                        allCanvases.add(c);
                        addedThisRound++;
                    }
                });

                stableRounds = addedThisRound > 0 ? 0 : stableRounds + 1;
                console.log(`[TDOCS] 滚动至 ${Math.floor(scrollPos)}px, 新增Canvas: ${addedThisRound}`);

                if (scrollPos >= scroller.scrollHeight - 50) {
                    console.log(`[TDOCS] 章节 [${chapterName}] 到达底部`);
                    break;
                }
            }
            console.log(`[TDOCS] 章节 [${chapterName}] 采集完成，累计 ${allCanvases.size} 页`);
        }

        // 极简PDF构建（无冗余排序/检测）
        const canvasArray = Array.from(allCanvases);
        console.log(`\n[TDOCS] 构建 PDF，共 ${canvasArray.length} 页`);
        for (let i = 0; i < canvasArray.length; i++) {
            const imgData = processCanvasToDataURL(canvasArray[i]);
            const imgWidth = pdf.internal.pageSize.getWidth();
            const imgHeight = (canvasArray[i].height / canvasArray[i].width) * imgWidth;
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        }

        pdf.save(`${document.title || '腾讯文档极速导出'}.pdf`);
    }
})();
