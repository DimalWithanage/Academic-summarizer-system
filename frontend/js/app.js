// Global Application State & Configuration
const API_BASE_URL = 'http://localhost:8080/api';

const state = {
    user: null,
    materials: [],
    summaries: {},
    quizzes: {},
    stats: {
        materials: 0,
        summaries: 0,
        quizzes: 0
    },
    currentView: 'dashboard'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    setupDragAndDrop();
    updateUIState();
    
    // Auto-update dashboard metrics
    recalculateStats();

    // Enforce authentication (Remove guest user mode)
    if (!state.user) {
        openAuthModal();
    }
});

// View Navigation Router (SPA Style)
function switchView(viewName) {
    // Hide active views, deactivate sidebar links
    document.querySelectorAll('.view-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    // Activate requested view
    const targetSection = document.getElementById(`${viewName}-view`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    const targetLink = document.getElementById(`nav-${viewName}`);
    if (targetLink) {
        targetLink.classList.add('active');
    }
    
    state.currentView = viewName;
    
    // View specific hooks
    if (viewName === 'summaries') {
        populateMaterialDropdowns('summaryMaterialSelect');
    } else if (viewName === 'quiz') {
        populateMaterialDropdowns('quizMaterialSelect');
        resetQuizPrepView();
    } else if (viewName === 'dashboard') {
        renderMaterialsList();
        recalculateStats();
    }
}

// -------------------------------------------------------------
// Authentication Controller
// -------------------------------------------------------------
function resetAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    if (loginForm) loginForm.reset();
    if (signupForm) signupForm.reset();
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('signupName').value = '';
    document.getElementById('signupEmail').value = '';
    document.getElementById('signupPassword').value = '';
}

function openAuthModal() {
    resetAuthForms();
    const modal = document.getElementById('authModal');
    modal.classList.add('active');
    toggleAuthModalTab('login');
}

function closeAuthModal() {
    if (!state.user) {
        showToast('Please sign in or create an account to access AcaSum.ai', 'warning');
        return;
    }
    const modal = document.getElementById('authModal');
    modal.classList.remove('active');
    resetAuthForms();
}

function toggleAuthModalTab(tab) {
    const loginContainer = document.getElementById('loginFormContainer');
    const signupContainer = document.getElementById('signupFormContainer');
    const modalTitle = document.getElementById('authModalTitle');
    resetAuthForms();
    
    if (tab === 'login') {
        loginContainer.style.display = 'block';
        signupContainer.style.display = 'none';
        modalTitle.textContent = 'Sign In';
    } else {
        loginContainer.style.display = 'none';
        signupContainer.style.display = 'block';
        modalTitle.textContent = 'Create Account';
    }
}

async function handleAuthSubmit(event, mode) {
    event.preventDefault();
    showLoading(true, mode === 'login' ? 'Authenticating...' : 'Registering Account...');
    
    const emailInput = mode === 'login' ? document.getElementById('loginEmail').value : document.getElementById('signupEmail').value;
    const passwordInput = mode === 'login' ? document.getElementById('loginPassword').value : document.getElementById('signupPassword').value;
    const nameInput = mode === 'login' ? emailInput.split('@')[0] : document.getElementById('signupName').value;

    try {
        const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput, password: passwordInput, name: nameInput })
        });

        const data = await response.json();
        showLoading(false);

        if (response.ok && data.email) {
            state.user = {
                userId: data.userId,
                name: nameInput.charAt(0).toUpperCase() + nameInput.slice(1),
                email: data.email,
                token: data.token,
                avatar: nameInput.charAt(0).toUpperCase()
            };
            loadUserSpecificData(state.user.email);
            fetchUserMaterialsFromBackend(state.user.userId);
            saveLocalData();
            updateUIState();
            closeAuthModal();
            showToast(data.message || `Successfully logged in as ${state.user.name}`, 'success');
            return;
        } else {
            // Strict rejection on 400 Bad Request or invalid credentials
            showToast(data.message || 'Invalid email or password.', 'danger');
            return;
        }
    } catch (e) {
        console.warn('Backend Auth API unavailable, using offline fallback mode:', e);
    }

    // Only executed if backend is completely offline/unreachable
    setTimeout(() => {
        showLoading(false);
        state.user = {
            name: nameInput.charAt(0).toUpperCase() + nameInput.slice(1),
            email: emailInput,
            avatar: nameInput.charAt(0).toUpperCase()
        };
        loadUserSpecificData(state.user.email);
        saveLocalData();
        updateUIState();
        closeAuthModal();
        showToast(`Offline Mode: Logged in as ${state.user.name}`, 'warning');
    }, 1000);
}

function handleLogout() {
    state.user = null;
    localStorage.removeItem('acasum_active_user');
    loadUserSpecificData(null);
    saveLocalData();
    updateUIState();
    resetAuthForms();
    switchView('dashboard');
    showToast('Logged out successfully', 'info');
    openAuthModal();
}

function updateUIState() {
    const profilePanel = document.getElementById('userProfilePanel');
    const welcomeGreeting = document.getElementById('welcomeGreeting');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const authActionBtn = document.getElementById('authActionBtn');
    const modalCloseBtn = document.querySelector('.modal-close');
    
    if (state.user) {
        profileAvatar.textContent = state.user.avatar;
        profileName.textContent = state.user.name;
        profileEmail.textContent = state.user.email;
        welcomeGreeting.textContent = `Welcome back, ${state.user.name}!`;
        if (modalCloseBtn) modalCloseBtn.style.display = 'block';
        
        // Setup logout icon
        authActionBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
        `;
        authActionBtn.title = "Logout";
        authActionBtn.onclick = handleLogout;
    } else {
        profileAvatar.textContent = "?";
        profileName.textContent = "Not Signed In";
        profileEmail.textContent = "Authentication required";
        welcomeGreeting.textContent = "Welcome to AcaSum.ai";
        if (modalCloseBtn) modalCloseBtn.style.display = 'none';
        
        // Setup login icon
        authActionBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
            </svg>
        `;
        authActionBtn.title = "Login";
        authActionBtn.onclick = openAuthModal;
    }
}

// -------------------------------------------------------------
// File Upload Controller
// -------------------------------------------------------------
function triggerFileInput() {
    document.getElementById('fileInput').click();
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        }, false);
    });
    
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }, false);
}

function handleFileSelect(event) {
    const files = event.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (!state.user) {
        openAuthModal();
        showToast('Please sign in to upload study materials.', 'warning');
        return;
    }
    if (files.length === 0) return;
    
    const file = files[0];
    if (file.type !== 'application/pdf') {
        showToast('Only PDF documents are supported for upload.', 'danger');
        return;
    }
    
    // Prepare mock/real upload state card
    const uploadId = 'upload_' + Date.now();
    const statusGrid = document.getElementById('uploadStatusGrid');
    
    const uploadCard = document.createElement('div');
    uploadCard.className = 'material-card';
    uploadCard.id = uploadId;
    uploadCard.innerHTML = `
        <div class="material-header">
            <div class="file-icon-box">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
            </div>
            <div class="file-meta">
                <div class="file-title">${file.name}</div>
                <div class="file-date" id="${uploadId}_status">Processing file...</div>
            </div>
        </div>
        <div style="background: rgba(255, 255, 255, 0.05); height: 4px; border-radius: 2px; overflow: hidden; margin-top: 8px;">
            <div id="${uploadId}_bar" style="background: var(--primary); height: 100%; width: 5%; transition: width 0.3s ease;"></div>
        </div>
    `;
    
    // Remove blank screen placeholders if there are any
    if (statusGrid.querySelector('p')) {
        statusGrid.innerHTML = '';
    }
    statusGrid.prepend(uploadCard);
    
    // Simulate Upload -> Drive storage -> AI generation
    simulatePipeline(uploadId, file);
}

async function simulatePipeline(uploadId, file) {
    const statusLabel = document.getElementById(`${uploadId}_status`);
    const progressBar = document.getElementById(`${uploadId}_bar`);
    
    progressBar.style.width = '25%';
    statusLabel.textContent = 'Uploading to Spring Boot & Google Drive...';

    try {
        const formData = new FormData();
        formData.append('file', file);
        if (state.user && state.user.userId) {
            formData.append('userId', state.user.userId);
        }

        const response = await fetch(`${API_BASE_URL}/materials/upload`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            progressBar.style.width = '70%';
            statusLabel.textContent = 'Saved to MySQL! Requesting AI Summary...';

            const materialItem = {
                id: String(data.materialId),
                name: data.fileName ? data.fileName.replace('.pdf', '') : file.name.replace('.pdf', ''),
                fileName: data.fileName || file.name,
                driveUrl: data.gcpStorageUrl || 'https://drive.google.com',
                uploadedAt: data.uploadedAt ? new Date(data.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString()
            };

            // Request AI summary from backend
            try {
                const summaryResp = await fetch(`${API_BASE_URL}/ai/summary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ materialId: data.materialId, contentType: 'SUMMARY' })
                });
                if (summaryResp.ok) {
                    const summaryData = await summaryResp.json();
                    state.summaries[materialItem.id] = summaryData.aiOutput;
                } else {
                    generateMockAIOutputs(materialItem.id, materialItem.name);
                }
            } catch (e) {
                generateMockAIOutputs(materialItem.id, materialItem.name);
            }

            progressBar.style.width = '100%';
            statusLabel.textContent = 'Ready';

            state.materials.unshift(materialItem);
            saveLocalData();
            recalculateStats();
            showToast(`"${materialItem.name}" saved to MySQL and summarized!`, 'success');

            setTimeout(() => {
                const card = document.getElementById(uploadId);
                if (card) card.remove();
                switchView('dashboard');
            }, 1000);
            return;
        }
    } catch (err) {
        console.warn('Backend API connection failed, using client demo mode:', err);
    }

    // Fallback if backend server is not running
    progressBar.style.width = '35%';
    statusLabel.textContent = 'Syncing to Google Drive (Demo)...';
    
    setTimeout(() => {
        progressBar.style.width = '70%';
        statusLabel.textContent = 'Gemini AI generating study material...';
        
        setTimeout(() => {
            progressBar.style.width = '100%';
            statusLabel.textContent = 'Ready';
            
            const driveUrl = `https://drive.google.com/file/d/mock_${Date.now()}/view`;
            const materialItem = {
                id: uploadId,
                name: file.name.replace('.pdf', ''),
                fileName: file.name,
                driveUrl: driveUrl,
                uploadedAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            };
            
            state.materials.unshift(materialItem);
            generateMockAIOutputs(uploadId, materialItem.name);
            saveLocalData();
            recalculateStats();
            showToast(`"${materialItem.name}" summarized successfully!`, 'success');
            
            setTimeout(() => {
                const card = document.getElementById(uploadId);
                if (card) card.remove();
                switchView('dashboard');
            }, 1000);
        }, 1500);
    }, 1000);
}

// -------------------------------------------------------------
// Core UI Lists & Select Renderers
// -------------------------------------------------------------
function renderMaterialsList() {
    const container = document.getElementById('materialsContainer');
    if (state.materials.length === 0) {
        container.innerHTML = `
            <div class="material-card" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                <p>No materials uploaded yet. Go to the Upload Center to add your study guides.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    state.materials.forEach(material => {
        const card = document.createElement('div');
        card.className = 'material-card';
        card.innerHTML = `
            <div class="material-header">
                <div class="file-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div class="file-meta">
                    <div class="file-title" title="${material.fileName}">${material.name}</div>
                    <div class="file-date">Uploaded: ${material.uploadedAt}</div>
                </div>
                <a href="${material.driveUrl}" target="_blank" class="drive-badge" title="Open PDF in Google Drive">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                        <path d="M7.784 14l-4.72-8.174h9.44L17.225 14H7.784zM11.666 4.908L16.388 13.1h9.438L21.103 4.908H11.666zM7.225 14.933L2.502 23.1h18.875L26.1 14.933H7.225z"/>
                    </svg>
                    Drive PDF
                </a>
            </div>
            <div class="card-actions">
                <button class="btn btn-secondary btn-outline" style="font-size: 0.8rem; padding: 6px 12px;" onclick="viewSummary('${material.id}')">Notes</button>
                <button class="btn btn-primary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="takeQuizDirect('${material.id}')">Take Quiz</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function populateMaterialDropdowns(elementId) {
    const dropdown = document.getElementById(elementId);
    if (!dropdown) return;
    
    // Clear option list except the header
    dropdown.innerHTML = '<option value="">-- Choose academic material --</option>';
    
    state.materials.forEach(material => {
        const option = document.createElement('option');
        option.value = material.id;
        option.textContent = material.name;
        dropdown.appendChild(option);
    });
}

// -------------------------------------------------------------
// Summary Panel Handlers
// -------------------------------------------------------------
async function viewSummary(materialId) {
    switchView('summaries');
    const select = document.getElementById('summaryMaterialSelect');
    if (select) {
        select.value = materialId;
    }
    await loadSelectedSummary();
}

async function loadSelectedSummary() {
    const select = document.getElementById('summaryMaterialSelect');
    const renderArea = document.getElementById('summaryRenderArea');
    const docTitle = document.getElementById('summaryDocTitle');
    const exportBtn = document.getElementById('btnExportMarkdown');
    const quizBtn = document.getElementById('btnStartQuizFromSummary');
    
    const val = select.value;
    if (!val) {
        docTitle.textContent = 'Select a document from above';
        renderArea.innerHTML = '<p style="color: var(--text-secondary);">Select an uploaded lecture or chapter from the drop-down menu to display its AI generated summary notes.</p>';
        exportBtn.disabled = true;
        quizBtn.disabled = true;
        return;
    }
    
    const currentDoc = state.materials.find(m => m.id === val);
    if (currentDoc) {
        docTitle.textContent = currentDoc.name;
    }

    let summaryMarkdown = null;
    
    // Always fetch real content from database first for backend materials
    if (!isNaN(parseInt(val))) {
        renderArea.innerHTML = '<p style="color: var(--primary);">Loading study notes from database...</p>';
        try {
            const summaryResp = await fetch(`${API_BASE_URL}/ai/summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ materialId: parseInt(val), contentType: 'SUMMARY' })
            });
            if (summaryResp.ok) {
                const summaryData = await summaryResp.json();
                if (summaryData && summaryData.aiOutput) {
                    summaryMarkdown = summaryData.aiOutput;
                    state.summaries[val] = summaryMarkdown;
                    saveLocalData();
                }
            }
        } catch (err) {
            console.warn('Error loading summary from database:', err);
        }
    }
    
    // Fall back to cached localStorage data only if DB fetch failed
    if (!summaryMarkdown) {
        summaryMarkdown = state.summaries[val];
    }
    
    if (summaryMarkdown) {
        renderArea.innerHTML = parseMarkdown(summaryMarkdown);
        exportBtn.disabled = false;
        quizBtn.disabled = false;
    } else {
        renderArea.innerHTML = '<p style="color: var(--danger);">No summary found. Please re-upload the PDF to generate study notes.</p>';
    }
}


function triggerQuizFromSummary() {
    const select = document.getElementById('summaryMaterialSelect');
    const materialId = select.value;
    if (!materialId) return;
    
    takeQuizDirect(materialId);
}

function exportSummary(format) {
    const select = document.getElementById('summaryMaterialSelect');
    const materialId = select.value;
    if (!materialId) return;
    
    const material = state.materials.find(m => m.id === materialId);
    const text = state.summaries[materialId];
    if (!material || !text) return;
    
    if (format === 'markdown') {
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${material.name}_Summary.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Markdown study notes downloaded!', 'success');
    }
}

// Markdown Parser Helper — supports headings, bold, italic, inline code,
// fenced code blocks, tables, numbered lists, bullet lists, horizontal rules
function parseMarkdown(mdText) {
    let html = '';
    const lines = mdText.split('\n');
    let i = 0;
    let inCodeBlock = false;
    let codeBlockContent = '';
    let codeBlockLang = '';

    while (i < lines.length) {
        const line = lines[i];

        // --- Fenced code blocks (``` ... ```) ---
        if (line.trim().startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLang = line.trim().replace('```', '').trim();
                codeBlockContent = '';
                i++;
                continue;
            } else {
                inCodeBlock = false;
                html += `<pre style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1rem; overflow-x: auto; margin: 1rem 0; font-size: 0.9rem;"><code style="color: #c9d1d9; font-family: 'Cascadia Code', 'Fira Code', 'Courier New', monospace;">${escapeHtml(codeBlockContent.trimEnd())}</code></pre>`;
                i++;
                continue;
            }
        }
        if (inCodeBlock) {
            codeBlockContent += line + '\n';
            i++;
            continue;
        }

        // --- Horizontal rule (--- or ***) ---
        if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
            html += '<hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1.5rem 0;">';
            i++;
            continue;
        }

        // --- Table detection (lines with |) ---
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            let tableHtml = '<div style="overflow-x: auto; margin: 1rem 0;"><table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">';
            // Collect all table rows
            let tableRows = [];
            while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
                tableRows.push(lines[i]);
                i++;
            }
            tableRows.forEach((row, rowIdx) => {
                // Skip separator row (| :--- | :--- |)
                if (/^[\s|:-]+$/.test(row.replace(/\|/g, '').trim())) return;
                const cells = row.split('|').filter(c => c.trim() !== '');
                const isHeader = rowIdx === 0;
                const tag = isHeader ? 'th' : 'td';
                const bgStyle = isHeader ? 'background: rgba(255,255,255,0.06);' : '';
                tableHtml += '<tr>';
                cells.forEach(cell => {
                    tableHtml += `<${tag} style="padding: 8px 12px; border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary); ${bgStyle} text-align: left;">${formatInline(cell.trim())}</${tag}>`;
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</table></div>';
            html += tableHtml;
            continue;
        }

        // --- Headings ---
        if (line.startsWith('#### ')) {
            html += `<h4 style="color: #fff; font-size: 1.05rem; margin-top: 1.1rem; margin-bottom: 0.4rem; font-family:'Outfit';">${formatInline(line.substring(5))}</h4>`;
            i++; continue;
        }
        if (line.startsWith('### ')) {
            html += `<h3 style="color: #fff; font-size: 1.15rem; margin-top: 1.25rem; margin-bottom: 0.5rem; font-family:'Outfit';">${formatInline(line.substring(4))}</h3>`;
            i++; continue;
        }
        if (line.startsWith('## ')) {
            html += `<h2 style="color: #fff; font-size: 1.4rem; margin-top: 1.5rem; margin-bottom: 0.75rem; font-family:'Outfit'; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">${formatInline(line.substring(3))}</h2>`;
            i++; continue;
        }
        if (line.startsWith('# ')) {
            html += `<h1 style="color: #fff; font-size: 1.6rem; margin-top: 1.75rem; margin-bottom: 0.75rem; font-family:'Outfit';">${formatInline(line.substring(2))}</h1>`;
            i++; continue;
        }

        // --- Unordered list items (- or * or  *) ---
        if (/^\s*[\-\*]\s+/.test(line)) {
            let listHtml = '<ul style="margin-bottom: 1rem; padding-left: 1.25rem;">';
            while (i < lines.length && /^\s*[\-\*]\s+/.test(lines[i])) {
                const content = lines[i].replace(/^\s*[\-\*]\s+/, '');
                listHtml += `<li style="margin-bottom: 0.4rem; list-style-type: disc; color: var(--text-secondary);"><span style="color: var(--text-primary);">${formatInline(content)}</span></li>`;
                i++;
            }
            listHtml += '</ul>';
            html += listHtml;
            continue;
        }

        // --- Ordered list items (1. 2. 3.) ---
        if (/^\s*\d+\.\s+/.test(line)) {
            let olHtml = '<ol style="margin-bottom: 1rem; padding-left: 1.25rem; color: var(--text-secondary);">';
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                const content = lines[i].replace(/^\s*\d+\.\s+/, '');
                olHtml += `<li style="margin-bottom: 0.4rem; color: var(--text-secondary);"><span style="color: var(--text-primary);">${formatInline(content)}</span></li>`;
                i++;
            }
            olHtml += '</ol>';
            html += olHtml;
            continue;
        }

        // --- Empty line = spacing ---
        if (line.trim() === '') {
            i++;
            continue;
        }

        // --- Regular paragraph ---
        html += `<p style="margin-bottom: 0.75rem; color: var(--text-secondary); line-height: 1.7;">${formatInline(line)}</p>`;
        i++;
    }

    return html;
}

// Inline formatting: bold, italic, inline code, backtick code
function formatInline(text) {
    return text
        .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-size: 0.88em; color: #e6db74; font-family: monospace;">$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #fff; font-weight: 600;">$1</strong>')
        .replace(/(?<![*])\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
}

// HTML escape helper for code blocks
function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// -------------------------------------------------------------
// AI Mock Data Generator (Simulates Gemini API integration)
// -------------------------------------------------------------
function generateMockAIOutputs(id, name) {
    // 1. Generate Markdown Notes
    state.summaries[id] = `## Summary Outline: ${name}

### Key Academic Concepts
- **Core Principles**: Understanding structural dependencies, modular interactions, and interface definitions.
- **Strategic Implementation**: Allocating execution workloads cleanly across distributed nodes to guarantee consistent responsiveness.
- **Resource Constraints**: Highlighting operational bounds such as network latencies, memory buffer footprints, and concurrency thresholds.

### Primary Summary Analysis
This lecture slide segment breaks down the fundamental mechanics behind designing scalable software applications. By reviewing system models, developers can isolate structural anomalies early in the development lifecycle.

### Critical Takeaways
- Always decouple heavy background workloads from primary request execution loops.
- Use atomic transitions when maintaining state changes in persistent data stores.
- Design error boundaries around untrusted external service dependencies.`;

    // 2. Generate Interactive Quizzes
    state.quizzes[id] = [
        {
            question: "According to the study material, why is decoupling background workloads from primary request execution loops critical?",
            options: [
                "To reduce the physical storage size of application files.",
                "To optimize CPU utilization for single-core servers only.",
                "To maintain constant system responsiveness and prevent request timeouts.",
                "To enforce strict compiler-level validation check loops."
            ],
            answer: 2,
            explanation: "Decoupling heavy tasks into background processes ensures that the primary UI or client-facing request loop remains responsive and does not freeze while processing."
        },
        {
            question: "Which of the following is recommended when maintaining state updates in database stores?",
            options: [
                "Unbounded buffer read queues.",
                "Atomic transitions and operations.",
                "Continuous synchronous write locks.",
                "Client-side local variable caching only."
            ],
            answer: 1,
            explanation: "Atomic transitions verify that database operations either fully complete or revert, preserving structural consistency."
        },
        {
            question: "What bounds should developers immediately guard against by using structured error boundaries?",
            options: [
                "Standard local constant value declarations.",
                "Static code formatting recommendations.",
                "Untrusted external service dependencies.",
                "Internal CPU cache memory architectures."
            ],
            answer: 2,
            explanation: "Untrusted external dependencies are prone to network dropouts and timeouts, making strong error boundaries essential for system survival."
        }
    ];
}

// -------------------------------------------------------------
// Toast & Utility Helpers
// -------------------------------------------------------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Choose icon base
    let icon = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
    `;
    if (type === 'success') {
        icon = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
    } else if (type === 'danger') {
        icon = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
        `;
    }
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    
    // Auto-remove toast
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showLoading(active, text = 'Processing data...') {
    const overlay = document.getElementById('loadingOverlay');
    const overlayText = document.getElementById('loadingOverlayText');
    overlayText.textContent = text;
    
    if (active) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

function recalculateStats() {
    state.stats.materials = state.materials.length;
    let summaryCount = 0;
    state.materials.forEach(m => {
        if (state.summaries[m.id]) {
            summaryCount++;
        }
    });
    state.stats.summaries = summaryCount;
    
    document.getElementById('statMaterials').textContent = state.stats.materials;
    document.getElementById('statSummaries').textContent = state.stats.summaries;
    document.getElementById('statQuizzes').textContent = state.stats.quizzes || 0;
}

function loadUserSpecificData(email) {
    if (!email) {
        state.materials = [];
        state.summaries = {};
        state.quizzes = {};
        state.stats = { materials: 0, summaries: 0, quizzes: 0 };
        recalculateStats();
        renderMaterialsList();
        return;
    }
    const userKey = `acasum_state_${email.toLowerCase()}`;
    const saved = localStorage.getItem(userKey);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.materials = parsed.materials || [];
            state.summaries = parsed.summaries || {};
            state.quizzes = parsed.quizzes || {};
            state.stats = parsed.stats || { materials: 0, summaries: 0, quizzes: 0 };
            recalculateStats();
            renderMaterialsList();
            return;
        } catch (e) {
            console.error('Error loading user state:', e);
        }
    }
    
    // Default state for new authenticated user
    state.materials = [];
    state.summaries = {};
    state.quizzes = {};
    state.stats = { materials: 0, summaries: 0, quizzes: 0 };
    recalculateStats();
    renderMaterialsList();
}

async function fetchUserMaterialsFromBackend(userId) {
    if (!userId) return;
    try {
        const resp = await fetch(`${API_BASE_URL}/materials?userId=${userId}`);
        if (resp.ok) {
            const materialsList = await resp.json();
            if (Array.isArray(materialsList)) {
                state.materials = materialsList.map(m => ({
                    id: String(m.materialId),
                    name: m.fileName ? m.fileName.replace('.pdf', '') : 'Document',
                    fileName: m.fileName,
                    driveUrl: m.gcpStorageUrl || 'https://drive.google.com',
                    uploadedAt: m.uploadedAt ? new Date(m.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString()
                }));

                // Always sync real summaries from database (overrides stale mock data)
                for (const m of materialsList) {
                    const matIdStr = String(m.materialId);
                    try {
                        const summaryResp = await fetch(`${API_BASE_URL}/ai/summary`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ materialId: m.materialId, contentType: 'SUMMARY' })
                        });
                        if (summaryResp.ok) {
                            const summaryData = await summaryResp.json();
                            if (summaryData && summaryData.aiOutput) {
                                state.summaries[matIdStr] = summaryData.aiOutput;
                            }
                        }
                    } catch (err) {
                        console.warn('Could not fetch summary for material ' + m.materialId, err);
                    }
                }

                recalculateStats();
                renderMaterialsList();
                saveLocalData();
            }
        }
    } catch (e) {
        console.warn('Backend fetch materials failed:', e);
    }
}

function loadLocalData() {
    const savedUser = localStorage.getItem('acasum_active_user');
    if (savedUser) {
        try {
            state.user = JSON.parse(savedUser);
        } catch (e) {
            state.user = null;
        }
    }
    loadUserSpecificData(state.user ? state.user.email : null);
    if (state.user && state.user.userId) {
        fetchUserMaterialsFromBackend(state.user.userId);
    }
}

function saveLocalData() {
    if (state.user && state.user.email) {
        localStorage.setItem('acasum_active_user', JSON.stringify(state.user));
        const userKey = `acasum_state_${state.user.email.toLowerCase()}`;
        localStorage.setItem(userKey, JSON.stringify({
            materials: state.materials,
            summaries: state.summaries,
            quizzes: state.quizzes,
            stats: state.stats
        }));
    } else {
        localStorage.removeItem('acasum_active_user');
    }
}
