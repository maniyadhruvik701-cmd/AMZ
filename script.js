const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const convertBtn = document.getElementById('convert-btn');
const historyContainer = document.getElementById('history-container');
const filterContainer = document.getElementById('filter-container');
const selectAllCheckbox = document.getElementById('select-all');
const bulkPrintBtn = document.getElementById('bulk-print-btn');

let selectedFiles = [];
let historyData = [];
let currentFilter = 'all';

// --- Server Configuration ---
let API_BASE = '';

// If running on localhost, use relative path (empty string).
// If running on GitHub or elsewhere, use the fixed Ngrok URL.
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (!isLocal) {
    API_BASE = 'https://nonencyclopedical-unsomberly-casimira.ngrok-free.dev';
    console.log('Using Remote Server:', API_BASE);
}

// Initial Load
loadHistory();

async function loadHistory() {
    try {

        const response = await fetch(`${API_BASE}/history?t=${Date.now()}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        historyData = await response.json();
        renderFilters();
        renderHistoryList();
    } catch (error) {
        console.error('Failed to load history', error);
    }
}

// --- Filtering Logic ---
function renderFilters() {
    // Extract unique folders
    const folders = new Set(historyData
        .map(item => item.folder)
        .filter(f => f && f.trim() !== '')
    );
    const sortedFolders = Array.from(folders).sort();

    // Clear existing filters
    filterContainer.innerHTML = '';

    // 'All' Filter
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-pill';
    allBtn.textContent = 'All';
    allBtn.dataset.folder = 'all';
    allBtn.onclick = () => setFilter('all', allBtn);
    filterContainer.appendChild(allBtn);

    sortedFolders.forEach(folder => {
        const btn = document.createElement('button');
        btn.className = 'filter-pill';
        btn.textContent = folder;
        btn.dataset.folder = folder;
        btn.onclick = () => setFilter(folder, btn);
        filterContainer.appendChild(btn);
    });

    // Set active state
    const activeBtn = filterContainer.querySelector(`[data-folder="${currentFilter}"]`) || allBtn;
    setActiveFilterStyle(activeBtn);

    // Delete All Button
    const deleteAllBtn = document.createElement('button');
    deleteAllBtn.className = 'filter-pill';
    deleteAllBtn.innerHTML = '<i class="fa-solid fa-dumpster"></i> Delete All Folders';
    deleteAllBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
    deleteAllBtn.style.color = '#ef4444';
    deleteAllBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    deleteAllBtn.style.fontWeight = '600';
    deleteAllBtn.style.marginLeft = 'auto';
    deleteAllBtn.onclick = () => deleteFolder('ALL_FOLDERS');
    deleteAllBtn.onmouseenter = () => {
        deleteAllBtn.style.backgroundColor = '#ef4444';
        deleteAllBtn.style.color = 'white';
    };
    deleteAllBtn.onmouseleave = () => {
        deleteAllBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
        deleteAllBtn.style.color = '#ef4444';
    };
    filterContainer.appendChild(deleteAllBtn);
}

function setFilter(folder, btnElement) {
    currentFilter = folder;
    setActiveFilterStyle(btnElement);
    renderHistoryList();
}

function setActiveFilterStyle(activeBtn) {
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
}

// --- History Rendering ---
function renderHistoryList() {
    historyContainer.innerHTML = '';

    // 1. Specific Filter Selected -> Show Flat List
    if (currentFilter !== 'all') {
        const filteredItems = historyData.filter(item => item.folder === currentFilter);

        if (filteredItems.length === 0) {
            historyContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)">No files found.</div>';
            return;
        }

        filteredItems.forEach(item => {
            historyContainer.appendChild(createHistoryItemElement(item));
        });
        updateBulkPrintButton();
        return;
    }

    // 2. 'All' Selected -> Show Grouped View
    const groups = {};
    const singles = [];

    historyData.forEach(item => {
        if (item.folder) {
            if (!groups[item.folder]) groups[item.folder] = [];
            groups[item.folder].push(item);
        } else {
            singles.push(item);
        }
    });

    // Render Groups
    // Sort folder names
    const sortedFolderNames = Object.keys(groups).sort();

    if (Object.keys(groups).length === 0 && singles.length === 0) {
        historyContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)">No history yet.</div>';
        return;
    }

    sortedFolderNames.forEach(folderName => {
        const items = groups[folderName];

        const groupDiv = document.createElement('div');
        groupDiv.className = 'history-group';

        const header = document.createElement('div');
        header.className = 'group-header';

        header.innerHTML = `
            <span><i class="fa-solid fa-folder"></i> ${folderName} <span class="badge" style="margin-left:8px; font-size:0.7em; opacity:0.8;">${items.length}</span></span>
        `;

        // Print All Button
        const printAllBtn = document.createElement('button');
        printAllBtn.className = 'btn-sm-print';
        printAllBtn.innerHTML = '<i class="fa-solid fa-print"></i> Print Folder';
        printAllBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Print all ${items.length} files in ${folderName}?`)) {
                items.forEach(async (item) => {
                    await printFile(item.filename, true);
                });
            }
        };
        header.appendChild(printAllBtn);

        // NEW: Print & Delete Button
        const printDeleteBtn = document.createElement('button');
        printDeleteBtn.className = 'btn-sm-print';
        printDeleteBtn.style.backgroundColor = '#f59e0b'; // Amber/Orange
        printDeleteBtn.style.marginLeft = '10px';
        printDeleteBtn.innerHTML = '<i class="fa-solid fa-print"></i> + <i class="fa-solid fa-trash"></i>';
        printDeleteBtn.title = "Print All & Delete Folder";
        printDeleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Print all ${items.length} files in ${folderName} AND THEN DELETE the folder?`)) {

                // 1. Print Loop
                let printErrors = 0;
                for (const item of items) {
                    const res = await printFile(item.filename, true);
                    if (res === false) printErrors++;
                }

                if (printErrors > 0) {
                    if (!confirm(`There were ${printErrors} print errors. Delete folder anyway?`)) return;
                }

                // 2. Delete Folder
                await deleteFolder(folderName);
            }
        };
        header.appendChild(printDeleteBtn);

        // Delete Folder Button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-sm-delete';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete Folder';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteFolder(folderName);
        };
        header.appendChild(deleteBtn);

        groupDiv.appendChild(header);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'group-content';
        contentDiv.style.display = 'none'; // Collapsed by default

        items.forEach(item => {
            contentDiv.appendChild(createHistoryItemElement(item));
        });

        // Toggle logic
        header.onclick = () => {
            const isHidden = contentDiv.style.display === 'none';
            contentDiv.style.display = isHidden ? 'block' : 'none';
        }

        groupDiv.appendChild(contentDiv);
        historyContainer.appendChild(groupDiv);
    });

    // Render Singles (Uncategorized)
    if (singles.length > 0) {
        const singlesHeader = document.createElement('div');
        singlesHeader.className = 'history-group-title';
        singlesHeader.innerHTML = '<span><i class="fa-regular fa-file"></i> Uncategorized</span>';
        singlesHeader.style.padding = '10px 0';
        singlesHeader.style.color = 'var(--text-muted)';
        historyContainer.appendChild(singlesHeader);

        singles.forEach(item => {
            historyContainer.appendChild(createHistoryItemElement(item));
        });
    }

    // Reset Select All
    selectAllCheckbox.checked = false;
    updateBulkPrintButton();
}

function createHistoryItemElement(item) {
    const div = document.createElement('div');
    div.className = 'history-item';

    // Format Date
    let dateStr = item.date;
    try {
        const d = new Date(item.date);
        // Check if valid date
        if (!isNaN(d.getTime())) {
            dateStr = d.toLocaleString();
        }
    } catch (e) {
        console.warn('Date parsing error', e);
    }

    // Escape filename for onclick
    // Replace backslashes with double backslashes for JS string escaping
    // And escape single quotes
    const safeFilename = item.filename.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    div.innerHTML = `
        <input type="checkbox" class="file-checkbox" value="${item.filename}">
        <div class="item-icon">
            <i class="fa-solid fa-file-pdf"></i>
        </div>
        <div class="item-details">
            <div class="item-name" title="${item.originalName}">${item.originalName}</div>
            <div class="item-meta">
                <span>${dateStr}</span>
                <span style="margin-left:10px; font-size:0.8em; color:var(--text-muted);">${formatBytes(item.size || 0)}</span>
                <!-- Note: File size not currently stored in history, using placeholder or could be added -->
            </div>
        </div>
        <button class="btn-item-print" onclick="printFile('${safeFilename}')">Print</button>
        <button class="btn-item-delete" onclick="deleteFile('${safeFilename}')"><i class="fa-solid fa-trash"></i></button>
    `;

    // Add checkbox listener
    const checkbox = div.querySelector('.file-checkbox');
    checkbox.addEventListener('change', updateBulkPrintButton);

    return div;
}

// --- Actions ---

// Toggle Select All
selectAllCheckbox.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
    updateBulkPrintButton();
});

function updateBulkPrintButton() {
    const selected = document.querySelectorAll('.file-checkbox:checked');
    if (selected.length > 0) {
        bulkPrintBtn.style.display = 'block';
        bulkPrintBtn.textContent = `Print Selected (${selected.length})`;
    } else {
        bulkPrintBtn.style.display = 'none';
    }
}

// Bulk Print
bulkPrintBtn.addEventListener('click', async () => {
    const selected = document.querySelectorAll('.file-checkbox:checked');
    if (selected.length === 0) return;

    if (confirm(`Print ${selected.length} files?`)) {
        for (const cb of selected) {
            await printFile(cb.value, true); // Silent print
            // Small delay to ensure sequential processing order request
            await new Promise(r => setTimeout(r, 500));
        }
        alert('Batch print sent!');
    }
});

async function printFile(filename, silent = false) {
    try {
        const response = await fetch(`${API_BASE}/print`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ filename })
        });
        const result = await response.json();

        if (!result.success) {
            console.error('Print failed:', result.error);
            if (!silent) alert('Print failed: ' + result.error);
            return false;
        } else {
            if (!silent) alert('Print job sent!');
            return true;
        }
    } catch (e) {
        console.error(e);
        if (!silent) alert('Error sending print job');
        return false;
    }
}

async function deleteFolder(folderOrAll) {
    let confirmMsg = '';
    let payload = {};

    if (folderOrAll === 'ALL_FOLDERS') {
        if (!confirm('Are you strictly sure? This deletes ALL uploaded files.')) return;
        payload = { type: 'all' };
    } else {
        if (!confirm(`Are you sure you want to delete folder "${folderOrAll}" and all its files?`)) return;
        payload = { folder: folderOrAll };
    }

    try {
        const res = await fetch(`${API_BASE}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            alert('Deleted successfully');
            loadHistory();
        } else {
            alert('Delete failed: ' + result.error);
        }
    } catch (e) {
        console.error(e);
        alert('Delete request failed');
    }
}


// --- Upload Logic ---

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFiles(e.target.files);
});

function handleFiles(files) {
    const validFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    if (validFiles.length === 0) {
        alert('Please select PDF files.');
        return;
    }

    selectedFiles = validFiles;

    // Update UI
    const statusText = dropZone.querySelector('.file-status');
    statusText.textContent = `${validFiles.length} file(s) ready`;
    statusText.style.color = 'var(--success)';

    convertBtn.disabled = false;
    convertBtn.classList.add('active');
}

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

convertBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    // Show loading
    convertBtn.disabled = true;
    convertBtn.textContent = 'Processing...';

    const formData = new FormData();
    const folderNameInput = document.getElementById('folder-name');
    const folderName = folderNameInput.value.trim();

    if (folderName) formData.append('folderName', folderName);

    selectedFiles.forEach(file => formData.append('pdfs', file));

    try {
        const response = await fetch(`${API_BASE}/convert`, {
            method: 'POST',
            headers: { 'ngrok-skip-browser-warning': 'true' },
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            // Auto switch to the new folder if created
            if (result.folderName) {
                currentFilter = result.folderName;
            } else {
                currentFilter = 'all';
            }

            await loadHistory(); // Reloads and renders with new currentFilter

            alert('Upload & Conversion Successful!');

            // Reset UI
            selectedFiles = [];
            dropZone.querySelector('.file-status').textContent = 'No file chosen';
            dropZone.querySelector('.file-status').style.color = 'var(--text-muted)';
            folderNameInput.value = '';
            convertBtn.textContent = 'Upload & Convert';
        } else {
            alert('Error: ' + result.error);
            convertBtn.disabled = false;
            convertBtn.textContent = 'Upload & Convert';
        }
    } catch (error) {
        console.error(error);
        alert('Upload failed');
        convertBtn.disabled = false;
        convertBtn.textContent = 'Upload & Convert';
    }

});
