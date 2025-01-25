// ==UserScript==
// @name         YouTube Timestamp Manager
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Add and manage YouTube timestamps with hyperlinks, and save/edit timestamps locally.
// @author       Chat GPT
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let clipboardData = ''; // Clear clipboardData at the start
    const preURL = 'https://www.youtube.com/watch?v=';

    // Function to format time in hh:mm:ss
    function formatTime(seconds) {
        const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    // Convert time in hh:mm:ss to seconds
    function timeToSeconds(time) {
        const [hrs, mins, secs] = time.split(':').map(Number);
        return hrs * 3600 + mins * 60 + secs;
    }

    // Add timestamp to clipboardData (stored in localStorage)
    function addTimestamp() {
        const video = document.querySelector('video');
        if (video) {
            const formattedTime = formatTime(video.currentTime);

            // Prompt user to enter custom text
            const userText = prompt(`Enter a text to add after the time (${formattedTime}):`, '');
            if (userText !== null) {
                const entry = `${formattedTime} ${userText.trim()}`;
                clipboardData += clipboardData ? `\n${entry}` : entry;

                // Save updated clipboard data to localStorage
                localStorage.setItem('youtube-timestamps', clipboardData);
            }
        }
    }

    // Extract clip ID from current URL
    function getClipId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    // Load data from localStorage
    function loadClipboardData() {
        clipboardData = localStorage.getItem('youtube-timestamps') || '';
    }

    // Clear data when starting a new video
    function clearLocalStorageForNewVideo() {
        const clipId = getClipId();
        const storedClipId = localStorage.getItem('youtube-clip-id');
        if (clipId !== storedClipId) {
            localStorage.setItem('youtube-clip-id', clipId); // Update stored clip ID
            localStorage.removeItem('youtube-timestamps'); // Clear timestamps for the new clip
            clipboardData = ''; // Reset clipboardData variable
        }
    }

    // Show timestamps in a new tab
    function showTimestamps() {
        loadClipboardData(); // Ensure clipboardData is up to date
        const clipId = getClipId();

        const videoTitle = document.title.replace('- YouTube', '').trim(); // Use page title
        const timestampHTML = clipboardData.trim() ? generateTimestampsHTML(clipboardData, clipId) : '<p>No timestamps available.</p>';

        // Create a new Blob with HTML content
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
                    textarea { width: 100%; height: 300px; }
                    button { background-color: #28a745; color: white; padding: 8px 12px; border: none; cursor: pointer; border-radius: 4px; }
                    button:hover { background-color: #218838; }
                    .clear-btn { background-color: #dc3545; }
                    .export-btn { background-color: #007bff; }
                    .import-btn { background-color: #ffc107; }
                </style>
            </head>
            <body>
                <h2>Timestamps of ${videoTitle}</h2>
                <div id="timestamps">${timestampHTML}</div>
                <h3>Edit Timestamps</h3>
                <form id="edit-form">
                    <textarea id="timestamps-input">${clipboardData}</textarea><br><br>
                    <button type="submit" id="save-timestamps" accesskey="s">Save</button>
                    <button type="button" class="clear-btn" id="clear-timestamps" accesskey="c">Clear</button>
                    <button type="button" class="import-btn" id="import-timestamps" accesskey="i">Import</button>
                    <button type="button" class="export-btn" id="export-timestamps" accesskey="e">Export</button>
                    <input type="file" id="file-input" style="display: none;" accept=".txt">
                </form>
                <script>
                    document.getElementById('edit-form').addEventListener('submit', function(event) {
                        event.preventDefault();
                        const updatedData = document.getElementById('timestamps-input').value;
                        localStorage.setItem('youtube-timestamps', updatedData);
                        document.getElementById('timestamps').innerHTML = generateTimestampsHTML(updatedData, "${clipId}");
                    });

                    document.getElementById('clear-timestamps').addEventListener('click', function() {
                        if (confirm("Are you sure you want to clear all timestamps?")) {
                            localStorage.removeItem('youtube-timestamps');
                            document.getElementById('timestamps').innerHTML = '';
                            document.getElementById('timestamps-input').value = '';
                        }
                    });

                    document.getElementById('export-timestamps').addEventListener('click', function() {
                        const videoTitle = document.title.replace('- YouTube', '').trim();
                        const filename = videoTitle + '.txt'; // Use video title only in the filename
                        const blob = new Blob([document.getElementById('timestamps-input').value], { type: 'text/plain;charset=utf-8' });

                        // Create a temporary link and trigger the download with user-selected filename
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = filename; // Use video title in filename

                        // Trigger the file save dialog
                        link.click();
                    });

                    document.getElementById('import-timestamps').addEventListener('click', function() {
                        document.getElementById('file-input').click();
                    });

                    document.getElementById('file-input').addEventListener('change', function(event) {
                        const file = event.target.files[0];
                        if (file && file.type === 'text/plain') {
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                const importedData = e.target.result;
                                document.getElementById('timestamps-input').value = importedData;
                                localStorage.setItem('youtube-timestamps', importedData);
                                document.getElementById('timestamps').innerHTML = generateTimestampsHTML(importedData, "${clipId}");
                            };
                            reader.readAsText(file);
                        } else {
                            alert("Please select a valid .txt file");
                        }
                    });

                    function generateTimestampsHTML(data, clipId) {
                        const lines = data.split('\\n');
                        return lines
                            .map((line, index) => {
                                const [time, ...textParts] = line.split(' ');
                                const text = textParts.join(' ');
                                const seconds = timeToSeconds(time);
                                const href = 'https://www.youtube.com/watch?v=' + clipId + '&t=' + seconds + 's';
                                return '<div class="timestamp"><a href="' + href + '" target="_blank">' + line + '</a></div>';
                            })
                            .join('');
                    }

                    function timeToSeconds(time) {
                        const [hrs, mins, secs] = time.split(':').map(Number);
                        return hrs * 3600 + mins * 60 + secs;
                    }
                </script>
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    // Generate HTML for timestamps with hyperlinks
    function generateTimestampsHTML(clipboardData, clipId) {
        const lines = clipboardData.split('\n');
        return lines
            .map((line, index) => {
                const [time, ...textParts] = line.split(' ');
                const text = textParts.join(' ');
                const seconds = timeToSeconds(time);
                const href = `${preURL}${clipId}&t=${seconds}s`;
                return `<div class="timestamp">
                            <a href="${href}" target="_blank">${line}</a>
                        </div>`;
            })
            .join('');
    }

    // Add controls (buttons) to the page
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
        addButton.accessKey = 'y';
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

        // Add access keys to buttons
        addButton.accessKey = 'y'; // Access key for Add Timestamp
        showButton.accessKey = 's'; // Access key for Show Timestamp
    }

    // Keyboard shortcut listener for timestamps page
    document.addEventListener('keydown', function (event) {
        if (event.key === 's' || event.key === 'S') {
            showTimestamps();
        }
        if (event.key === 'c' || event.key === 'C') {
            document.getElementById('clear-timestamps').click();
        }
        if (event.key === 'e' || event.key === 'E') {
            document.getElementById('export-timestamps').click();
        }
        if (event.key === 'i' || event.key === 'I') {
            document.getElementById('import-timestamps').click();
        }
    });

    const observer = new MutationObserver(() => addControls());
    observer.observe(document.body, { childList: true, subtree: true });

    clearLocalStorageForNewVideo(); // Clear localStorage if a new video starts
    loadClipboardData(); // Load timestamps from localStorage
})();
