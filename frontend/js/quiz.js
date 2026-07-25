// AcaSum.ai Interactive Quiz Engine

const quizState = {
    materialId: '',
    questions: [],
    currentIndex: 0,
    selectedOption: null,
    isGraded: false,
    score: 0,
    timerInterval: null,
    timeLeft: 0,
    timeLimitPerQuestion: 60, // in seconds
    hasTimerLimit: true
};

// -------------------------------------------------------------
// Initialization & Entrypoints
// -------------------------------------------------------------
function takeQuizDirect(materialId) {
    switchView('quiz');
    const select = document.getElementById('quizMaterialSelect');
    if (select) {
        select.value = materialId;
    }
}

function resetQuizPrepView() {
    document.getElementById('quizPrepScreen').style.display = 'block';
    document.getElementById('quizRunnerScreen').style.display = 'none';
    document.getElementById('quizResultScreen').style.display = 'none';
    clearInterval(quizState.timerInterval);
}

async function initiateQuizSession() {
    const select = document.getElementById('quizMaterialSelect');
    const materialId = select.value;
    
    if (!materialId) {
        showToast('Please select a study material to generate a quiz.', 'warning');
        return;
    }
    
    const countSelect = document.getElementById('quizCountSelect');
    const timeLimitSelect = document.getElementById('quizTimeLimit');
    
    const requestedCount = parseInt(countSelect.value);
    const limit = parseInt(timeLimitSelect.value);
    
    showLoading(true, 'Gemini AI generating interactive quiz...');
    
    // Always fetch real quiz from Spring Boot database first
    let fetchedFromBackend = false;
    if (!isNaN(parseInt(materialId))) {
        try {
            const resp = await fetch(`${API_BASE_URL}/ai/quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ materialId: parseInt(materialId), contentType: 'QUIZ', questionCount: requestedCount })
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data && data.aiOutput) {
                    try {
                        let cleanJson = data.aiOutput.trim();
                        if (cleanJson.startsWith('```')) {
                            cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                        }
                        const parsed = JSON.parse(cleanJson);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            state.quizzes[materialId] = parsed;
                            fetchedFromBackend = true;
                            saveLocalData();
                        }
                    } catch (parseErr) {
                        console.warn('Quiz JSON parse error:', parseErr, data.aiOutput);
                    }
                }
            }
        } catch (e) {
            console.warn('Backend Quiz API call failed:', e);
        }
    }
    
    // Only use mock data as last resort if backend fetch failed completely
    if (!fetchedFromBackend && !state.quizzes[materialId]) {
        const material = state.materials.find(m => m.id === materialId);
        generateMockAIOutputs(materialId, material ? material.name : 'Study Material');
    }

    showLoading(false);
    
    const sourceQuestions = state.quizzes[materialId] || [];
    if (sourceQuestions.length === 0) {
        showToast('No questions could be formulated for this document.', 'danger');
        return;
    }
    
    // Reset quiz runner state
    quizState.materialId = materialId;
    
    // Duplicate/slice to match requested count or pad if necessary
    quizState.questions = [...sourceQuestions];
    while (quizState.questions.length < requestedCount) {
        quizState.questions = quizState.questions.concat(sourceQuestions.map(q => ({
            ...q,
            question: "[Expanded Check] " + q.question
        })));
    }
    quizState.questions = quizState.questions.slice(0, requestedCount);
    
    quizState.currentIndex = 0;
    quizState.score = 0;
    quizState.timeLimitPerQuestion = limit;
    quizState.hasTimerLimit = limit > 0;
    
    // Hide prep, show runner
    document.getElementById('quizPrepScreen').style.display = 'none';
    document.getElementById('quizRunnerScreen').style.display = 'block';
    document.getElementById('quizResultScreen').style.display = 'none';
    
    renderQuestion();
}

// -------------------------------------------------------------
// Quiz Loop Controller
// -------------------------------------------------------------
function renderQuestion() {
    const question = quizState.questions[quizState.currentIndex];
    
    // Reset inputs & status states
    quizState.selectedOption = null;
    quizState.isGraded = false;
    
    // Update question numbers & text
    document.getElementById('quizIndexIndicator').textContent = `Question ${quizState.currentIndex + 1} of ${quizState.questions.length}`;
    document.getElementById('questionStepLabel').textContent = `Question ${quizState.currentIndex + 1}`;
    document.getElementById('questionText').textContent = question.question;
    
    // Render options
    const optionsContainer = document.getElementById('quizOptionsContainer');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((optionText, idx) => {
        const letter = String.fromCharCode(65 + idx); // A, B, C, D
        const optionDiv = document.createElement('div');
        optionDiv.className = 'quiz-option';
        optionDiv.id = `option_${idx}`;
        optionDiv.onclick = () => selectOption(idx);
        
        optionDiv.innerHTML = `
            <span class="quiz-option-letter">${letter}</span>
            <span class="quiz-option-text">${optionText}</span>
        `;
        optionsContainer.appendChild(optionDiv);
    });
    
    // Hide Explanation Box
    const explanationBox = document.getElementById('quizExplanationBox');
    explanationBox.style.display = 'none';
    explanationBox.innerHTML = '';
    
    // Set Navigation Button State
    const nextBtn = document.getElementById('quizNextBtn');
    nextBtn.textContent = 'Submit Answer';
    
    // Progress Bar percentage
    const progressPercent = ((quizState.currentIndex) / quizState.questions.length) * 100;
    document.getElementById('quizProgressBar').style.width = `${progressPercent}%`;
    
    // Timer setup
    startTimer();
}

function selectOption(index) {
    if (quizState.isGraded) return; // Disallow changes after grading
    
    // Unselect other elements
    document.querySelectorAll('.quiz-option').forEach(opt => opt.classList.remove('selected'));
    
    // Select new element
    const target = document.getElementById(`option_${index}`);
    if (target) {
        target.classList.add('selected');
        quizState.selectedOption = index;
    }
}

// -------------------------------------------------------------
// Timer Mechanics
// -------------------------------------------------------------
function startTimer() {
    clearInterval(quizState.timerInterval);
    const timerBox = document.getElementById('quizTimerBox');
    const timerText = document.getElementById('quizTimerText');
    
    if (!quizState.hasTimerLimit) {
        timerBox.style.display = 'none';
        return;
    }
    
    timerBox.style.display = 'flex';
    timerBox.classList.remove('warning');
    quizState.timeLeft = quizState.timeLimitPerQuestion;
    
    updateTimerText();
    
    quizState.timerInterval = setInterval(() => {
        quizState.timeLeft--;
        updateTimerText();
        
        if (quizState.timeLeft <= 10) {
            timerBox.classList.add('warning');
        }
        
        if (quizState.timeLeft <= 0) {
            clearInterval(quizState.timerInterval);
            autoSubmitOnTimeout();
        }
    }, 1000);
}

function updateTimerText() {
    const mins = Math.floor(quizState.timeLeft / 60);
    const secs = quizState.timeLeft % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('quizTimerText').textContent = formatted;
}

function autoSubmitOnTimeout() {
    showToast('Time limit exceeded! Auto-submitting.', 'warning');
    if (quizState.selectedOption === null) {
        // Force highlight a mock index so grading works
        quizState.selectedOption = -1; 
    }
    evaluateAnswer();
}

// -------------------------------------------------------------
// Evaluation & Navigation Handlers
// -------------------------------------------------------------
function handleQuizNext() {
    const nextBtn = document.getElementById('quizNextBtn');
    
    if (!quizState.isGraded) {
        // Flow: Submit answer for grading
        if (quizState.selectedOption === null) {
            showToast('Please select an option to submit your answer.', 'warning');
            return;
        }
        clearInterval(quizState.timerInterval);
        evaluateAnswer();
    } else {
        // Flow: Progress to next question or show results
        quizState.currentIndex++;
        if (quizState.currentIndex < quizState.questions.length) {
            renderQuestion();
        } else {
            showQuizResults();
        }
    }
}

function evaluateAnswer() {
    quizState.isGraded = true;
    const question = quizState.questions[quizState.currentIndex];
    const correctIdx = question.answer;
    
    // Add grading styles
    question.options.forEach((_, idx) => {
        const optionDiv = document.getElementById(`option_${idx}`);
        if (!optionDiv) return;
        
        if (idx === correctIdx) {
            optionDiv.classList.add('correct');
        } else if (idx === quizState.selectedOption) {
            optionDiv.classList.add('wrong');
        }
    });
    
    // Check outcome
    const isCorrect = quizState.selectedOption === correctIdx;
    if (isCorrect) {
        quizState.score++;
        showToast('Correct answer!', 'success');
    } else {
        showToast('Incorrect answer.', 'danger');
    }
    
    // Render explanations
    const explanationBox = document.getElementById('quizExplanationBox');
    explanationBox.style.display = 'block';
    explanationBox.innerHTML = `
        <h4 style="font-weight:700; margin-bottom: 6px; color: ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
            ${isCorrect ? 'Correct!' : 'Incorrect'}
        </h4>
        <p style="color: var(--text-secondary); line-height: 1.5;">${question.explanation}</p>
    `;
    
    // Adjust next button text
    const nextBtn = document.getElementById('quizNextBtn');
    if (quizState.currentIndex === quizState.questions.length - 1) {
        nextBtn.textContent = 'Finish Quiz';
    } else {
        nextBtn.textContent = 'Next Question';
    }
}

function showQuizResults() {
    document.getElementById('quizRunnerScreen').style.display = 'none';
    document.getElementById('quizResultScreen').style.display = 'block';
    
    const total = quizState.questions.length;
    const percent = Math.round((quizState.score / total) * 100);
    
    // Update dynamic statistics
    state.stats.quizzes++;
    saveLocalData();
    recalculateStats();
    
    // Render radial progress conic gradient
    const progressRadial = document.getElementById('scoreConicGradient');
    progressRadial.style.background = `conic-gradient(var(--primary) ${percent}%, rgba(255, 255, 255, 0.05) ${percent}%)`;
    
    document.getElementById('resultScoreText').textContent = `${percent}%`;
    
    // Result details text
    const title = document.getElementById('resultTitle');
    const desc = document.getElementById('resultDescription');
    
    desc.textContent = `You answered ${quizState.score} out of ${total} questions correctly.`;
    
    if (percent === 100) {
        title.textContent = 'Flawless Score!';
        desc.textContent += ' Outstanding retention of the study materials!';
    } else if (percent >= 70) {
        title.textContent = 'Great Job!';
    } else {
        title.textContent = 'Keep Practicing!';
        desc.textContent += ' Review the study summaries to reinforce your learning.';
    }
}

function restartQuizPrep() {
    resetQuizPrepView();
    // Auto-pre-select the material we just used
    const select = document.getElementById('quizMaterialSelect');
    if (select) {
        select.value = quizState.materialId;
    }
}

function exitQuizSession() {
    if (confirm('Are you sure you want to exit the quiz? Your current progress will be lost.')) {
        resetQuizPrepView();
    }
}
