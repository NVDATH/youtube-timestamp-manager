// ==UserScript==
// @name         YouTube Timestamp Manager
// @namespace    http://tampermonkey.net/
// @version      5.6
// @description  Add and manage YouTube timestamps with hyperlinks, and save/edit timestamps locally.
// @author       Claude.AI
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let clipboardData = '';
    const preURL = 'https://www.youtube.com/watch?v=';

    function formatTime(seconds) {
        const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    function timeToSeconds(time) {
        const [hrs, mins, secs] = time.split(':').map(Number);
        return hrs * 3600 + mins * 60 + secs;
    }

    function addTimestamp() {
        const video = document.querySelector('video');
        if (video) {
            const formattedTime = formatTime(video.currentTime);
            const userText = prompt(`Enter a text to add after the time (${formattedTime}):`, '');
            if (userText !== null) {
                loadClipboardData();
                const entry = `${formattedTime} ${userText.trim()}`;
                clipboardData += clipboardData ? `\n${entry}` : entry;
                localStorage.setItem('youtube-timestamps', clipboardData);
            }
        }
    }

    function getClipId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    function loadClipboardData() {
        clipboardData = localStorage.getItem('youtube-timestamps') || '';
    }

    function clearLocalStorageForNewVideo() {
        const clipId = getClipId();
        const storedClipId = localStorage.getItem('youtube-clip-id');
        if (clipId !== storedClipId) {
            localStorage.setItem('youtube-clip-id', clipId);
            localStorage.removeItem('youtube-timestamps');
            clipboardData = '';
        }
    }

    function showTimestamps() {
        loadClipboardData();
        const clipId = getClipId();
        const videoTitle = document.title.replace('- YouTube', '').trim();

        const timeToSecondsStr = timeToSeconds.toString();

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Timestamps of ${videoTitle}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f9; }
        h2 { color: #333; }
        .timestamp { margin-bottom: 10px; }
        .timestamp a { color: #007bff; text-decoration: none; }
        .timestamp a:hover { text-decoration: underline; }
        textarea { width: 100%; height: 200px; box-sizing: border-box; font-family: monospace; }
        button { background-color: #28a745; color: white; padding: 8px 12px; border: none; cursor: pointer; border-radius: 4px; margin-right: 6px; }
        button:hover { opacity: 0.85; }
        .clear-btn { background-color: #dc3545; }
        .export-btn { background-color: #007bff; }
        .import-btn { background-color: #ffc107; color: #333; }
    </style>
</head>
<body>
    <h2>Timestamps of ${videoTitle}</h2>
    <div id="timestamps"></div>
    <h3>Edit Timestamps</h3>
    <textarea id="timestamps-input">${clipboardData}</textarea><br><br>
    <button id="save-timestamps">Save (Alt+S)</button>
    <button class="clear-btn" id="clear-timestamps">Clear (Alt+C)</button>
    <button class="import-btn" id="import-timestamps">Import (Alt+I)</button>
    <button class="export-btn" id="export-timestamps">Export (Alt+E)</button>
    <input type="file" id="file-input" style="display: none;" accept=".txt">

    <script>
        const CLIP_ID = "${clipId}";
        const BASE_URL = 'https://www.youtube.com/watch?v=';

        ${timeToSecondsStr}

        // Use DOM manipulation instead of innerHTML to avoid Trusted Types CSP error
        function refreshPreview(data) {
            const container = document.getElementById('timestamps');

            // Remove all existing children
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }

            if (!data.trim()) {
                const p = document.createElement('p');
                p.textContent = 'No timestamps available.';
                container.appendChild(p);
                return;
            }

            data.split('\\n').forEach(function(line) {
                if (!line.trim()) return;
                const parts = line.split(' ');
                const time = parts[0];
                const seconds = timeToSeconds(time);
                const href = BASE_URL + CLIP_ID + '&t=' + seconds + 's';

                const div = document.createElement('div');
                div.className = 'timestamp';

                const a = document.createElement('a');
                a.href = href;
                a.target = '_blank';
                a.textContent = line;

                div.appendChild(a);
                container.appendChild(div);
            });
        }

        // Storage helpers — write back to YouTube's localStorage via opener
        function storageSet(key, value) {
            try {
                if (window.opener && !window.opener.closed) {
                    window.opener.localStorage.setItem(key, value);
                } else {
                    localStorage.setItem(key, value);
                }
            } catch(e) { console.error('storageSet error', e); }
        }
        function storageRemove(key) {
            try {
                if (window.opener && !window.opener.closed) {
                    window.opener.localStorage.removeItem(key);
                } else {
                    localStorage.removeItem(key);
                }
            } catch(e) { console.error('storageRemove error', e); }
        }

        // Initial render
        refreshPreview(document.getElementById('timestamps-input').value);

        document.getElementById('save-timestamps').addEventListener('click', function () {
            const updatedData = document.getElementById('timestamps-input').value;
            storageSet('youtube-timestamps', updatedData);
            refreshPreview(updatedData);
        });

        document.getElementById('clear-timestamps').addEventListener('click', function () {
            if (confirm("Are you sure you want to clear all timestamps?")) {
                storageRemove('youtube-timestamps');
                document.getElementById('timestamps-input').value = '';
                refreshPreview('');
            }
        });

        document.getElementById('export-timestamps').addEventListener('click', function () {
            const filename = document.title.replace('Timestamps of ', '').trim() + '.txt';
            const blob = new Blob([document.getElementById('timestamps-input').value], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        });

        document.getElementById('import-timestamps').addEventListener('click', function () {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input').addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (file && file.type === 'text/plain') {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const importedData = e.target.result;
                    document.getElementById('timestamps-input').value = importedData;
                    storageSet('youtube-timestamps', importedData);
                    refreshPreview(importedData);
                };
                reader.readAsText(file);
            } else {
                alert("Please select a valid .txt file");
            }
        });

        document.addEventListener('keydown', function (event) {
            if (!event.altKey) return;
            if (event.key === 's' || event.key === 'S') { event.preventDefault(); document.getElementById('save-timestamps').click(); }
            if (event.key === 'c' || event.key === 'C') { event.preventDefault(); document.getElementById('clear-timestamps').click(); }
            if (event.key === 'e' || event.key === 'E') { event.preventDefault(); document.getElementById('export-timestamps').click(); }
            if (event.key === 'i' || event.key === 'I') { event.preventDefault(); document.getElementById('import-timestamps').click(); }
        });
    </script>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    function addControls() {
        const container = document.querySelector('.ytp-right-controls');
        if (!container || document.getElementById('add-timestamp')) return;

        const addButton = document.createElement('button');
        addButton.id = 'add-timestamp';
        addButton.textContent = 'Add Timestamp';
        addButton.style.cssText = `
            margin-left: 10px;
            background-color: #ff0000;
            color: white;
            border: none;
            padding: 5px 10px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
        `;
        addButton.addEventListener('click', addTimestamp);
        container.appendChild(addButton);

        const showButton = document.createElement('button');
        showButton.id = 'show-timestamp';
        showButton.textContent = 'Show Timestamp';
        showButton.style.cssText = `
            margin-left: 10px;
            background-color: #007bff;
            color: white;
            border: none;
            padding: 5px 10px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
        `;
        showButton.addEventListener('click', showTimestamps);
        container.appendChild(showButton);
    }

    const observer = new MutationObserver(() => addControls());
    observer.observe(document.body, { childList: true, subtree: true });

    clearLocalStorageForNewVideo();
    loadClipboardData();
})();
