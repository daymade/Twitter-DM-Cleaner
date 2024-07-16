// ==UserScript==
// @name         Twitter DM Cleaner
// @homepage     https://github.com/daymade/Twitter-DM-Cleaner
// @namespace    https://greasyfork.org/users/1121182
// @version      0.5
// @author       daymade
// @license      MIT
// @description  Highlight potential harassment messages in Twitter DMs, support batch deleting conversations
// @match        https://x.com/messages
// @match        https://x.com/messages/requests
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // 添加 Tampermonkey 菜单选项
    GM_registerMenuCommand("批量删除骚扰消息", () => {
        const highlightedConversations = document.querySelectorAll('[data-testid="conversation"][data-highlighted="true"]');
        const highlightedCount = highlightedConversations.length;
        const confirmed = confirm(`检测到 ${highlightedCount} 条已标记为骚扰的消息。是否批量删除？`);

        if (confirmed) {
            const deleteChoice = prompt("选择要删除的消息数量：1, 10, 或 全部", "全部");
            if (deleteChoice === "1") {
                bulkDeleteHarassmentMessages(1);
            } else if (deleteChoice === "10") {
                bulkDeleteHarassmentMessages(10);
            } else if (deleteChoice.toLowerCase() === "全部") {
                bulkDeleteHarassmentMessages(Infinity);
            }
        }
    });

    // 白名单存储
    const WHITELIST_STORAGE_KEY = 'harassmentWhitelist';

    // 初始化或获取白名单
    function getWhitelist() {
        return GM_getValue(WHITELIST_STORAGE_KEY, []);
    }

    // 添加用户到白名单
    function addToWhitelist(screenname) {
        const whitelist = getWhitelist();
        if (!whitelist.includes(screenname)) {
            whitelist.push(screenname);
            GM_setValue(WHITELIST_STORAGE_KEY, whitelist);
        }
    }

    // 判断是否在白名单中
    function isInWhitelist(screenname) {
        const whitelist = getWhitelist();
        return whitelist.includes(screenname);
    }

    // 判断是否为潜在骚扰消息
    function isPotentialHarassment(screenname) {
        if (isInWhitelist(screenname)) {
            return false;
        }

        // 移除 @ 符号
        screenname = screenname.replace('@', '');

        const totalLength = screenname.length;
        const digitCount = (screenname.match(/\d/g) || []).length;
        const letterCount = (screenname.match(/[a-zA-Z]/g) || []).length;
        const specialCharCount = totalLength - digitCount - letterCount;

        // 计算各种字符的比例
        const digitRatio = digitCount / totalLength;
        const letterRatio = letterCount / totalLength;
        const specialCharRatio = specialCharCount / totalLength;

        // 检查是否存在连续的数字
        const hasConsecutiveDigits = /\d{4,}/.test(screenname);

        // 检查是否存在年份样式的数字（如2020, 2021等）
        const hasYearLikeNumber = /(?:19|20)\d{2}/.test(screenname);

        // 检查是否存在过多的大写字母
        const uppercaseRatio = (screenname.match(/[A-Z]/g) || []).length / letterCount;

        // 评分系统
        let score = 0;

        if (digitRatio > 0.3) score += 2;
        if (specialCharRatio > 0.1) score += 1;
        if (hasConsecutiveDigits) score += 2;
        if (hasYearLikeNumber) score -= 1;
        if (uppercaseRatio > 0.5) score += 1;
        if (totalLength > 15) score += 1;

        // 如果用户名中包含常见的名字，减少分数
        const commonNames = ['peter', 'lin', 'andrew', 'adams', 'ollie', 'denise', 'nahum'];
        if (commonNames.some(name => screenname.toLowerCase().includes(name))) {
            score -= 1;
        }

        return score >= 3;
    }

    // 高亮潜在骚扰消息
    function highlightHarassmentMessages() {
        const conversations = document.querySelectorAll('[data-testid="conversation"]');

        conversations.forEach(conversation => {
            const textElements = conversation.querySelectorAll('div[dir="ltr"]');
            const messageElement = conversation.querySelector('span[data-testid="tweetText"]');

            if (textElements.length >= 3) {
                const name = textElements[0].textContent.trim();
                const screenName = textElements[2].textContent.trim().replace('@', '');
                const message = messageElement?.textContent.trim() || 'non-text-message';

                // 避免重复高亮
                if (conversation.dataset.highlighted) return;

                // 判断是否为潜在骚扰消息
                const isHarassment = isPotentialHarassment(screenName);
                console.log(`User: ${name}, Screen name: ${screenName}, Message: ${message}, IsHarassment: ${isHarassment}`);

                if (isHarassment) {
                    console.log(`Highlighting conversation for user ${name} because screenname "${screenName}" is all lowercase.`);
                    conversation.style.opacity = '0.2';
                    conversation.style.backgroundColor = '#f0f0f0';
                    conversation.dataset.highlighted = 'true'; // 标记为已高亮

                    // 添加白名单按钮
                    const whitelistButton = document.createElement('button');
                    whitelistButton.textContent = "添加到白名单";
                    whitelistButton.style.marginRight = "10px";
                    whitelistButton.style.width = "106px";
                    whitelistButton.onclick = () => {
                        addToWhitelist(screenName);
                        conversation.style.opacity = '1';
                        conversation.style.backgroundColor = '';
                        conversation.dataset.highlighted = '';
                    };
                    conversation.appendChild(whitelistButton);
                }
            } else {
                console.log("Skipping conversation due to insufficient text elements or missing message element.");
            }
        });
    }

    // 批量删除骚扰私信
    function bulkDeleteHarassmentMessages(deleteCount) {
        const conversations = document.querySelectorAll('[data-testid="conversation"][data-highlighted="true"]');
        let deletedCount = 0;

        conversations.forEach(conversation => {
            if (deletedCount < deleteCount) {
                deleteConversation(conversation);
                deletedCount++;
            }
        });
    }

    // 删除私信
    function deleteConversation(conversation) {
        // 模拟点击 X 按钮
        const optionsButton = conversation.querySelector('button[aria-label="Options menu"]');
        if (optionsButton) {
            optionsButton.click();

            // 等待弹出菜单出现再点击删除
            setTimeout(() => {
                const deleteButton = Array.from(document.querySelectorAll('div[role="menuitem"]'))
                    .find(item => item.textContent.includes('Delete conversation') ||
                        item.textContent.includes('删除对话'));
                if (deleteButton) {
                    deleteButton.click();
                }
            }, 2000);
        }
    }

    // 监听页面变化，能高亮新收到的私信
    function observePageChanges() {
        const observer = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                if (mutation.type === 'childList') {
                    highlightHarassmentMessages();
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 初始化
    function init() {
        highlightHarassmentMessages();
        observePageChanges();
    }

    // 等待页面加载完成后执行
    window.addEventListener('load', init);
})();