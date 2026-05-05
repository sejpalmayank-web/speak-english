// ==========================================
// FLUENCYCOACH v2 - ACTUALLY TEACHES ENGLISH
// ==========================================

const CONFIG = {
    GROQ_API_KEY: 'YOUR_GROQ_KEY_HERE', // We'll fix this first
    GROQ_URL: 'https://api.groq.com/openai/v1/chat/completions',
    MODEL: 'llama3-8b-8192'
};

// STATE
let currentLesson = null;
let currentStep = 0;
let userAttempts = [];
let isListening = false;
let recognition = null;
let bestVoice = null;

// ==========================================
// LESSONS - Structured like Stimuler
// Each lesson: Listen → Repeat → Get Feedback → Retry
// ==========================================

const LESSONS = [
    {
        id: 'introduce',
        title: 'Introducing Yourself',
        icon: '👋',
        difficulty: 'Easy',
        // The AI speaks this first - user listens
        demo: "Hi, I'm Alex. I work as a software developer at a tech company in Bangalore. In my free time, I enjoy playing cricket and watching movies. Nice to meet you!",
        // Then user practices these specific phrases
        practicePhrases: [
            "Hi, I'm [your name]. I work as a [job] at [company] in [city].",
            "In my free time, I enjoy [hobby] and [another hobby].",
            "Nice to meet you!"
        ],
        // Tips for this lesson
        tips: [
            "Say 'I work as a' not 'I am working as a'",
            "'Nice to meet you' - smile when you say this!",
            "Don't speak too fast. Pause between sentences."
        ]
    },
    {
        id: 'standup',
        title: 'Daily Standup',
        icon: '📊',
        difficulty: 'Easy',
        demo: "Good morning everyone. Yesterday I completed the login page design and fixed two bugs in the payment module. Today I'm working on the user dashboard. I don't have any blockers right now. Thanks!",
        practicePhrases: [
            "Yesterday I completed [task] and fixed [problem].",
            "Today I'm working on [current task].",
            "I don't have any blockers right now."
        ],
        tips: [
            "Use past tense for yesterday: 'I completed' not 'I complete'",
            "Say 'I'm working on' not 'I am work on'",
            "Keep it under 30 seconds"
        ]
    },
    {
        id: 'delay',
        title: 'Explaining a Delay',
        icon: '⏰',
        difficulty: 'Medium',
        demo: "I wanted to give you a quick update on the project timeline. We've encountered an unexpected issue with the database migration that will set us back by about two days. I'm actively working on a solution and will have a fix by Thursday. I apologize for the inconvenience.",
        practicePhrases: [
            "I wanted to give you a quick update on [topic].",
            "We've encountered an unexpected issue with [problem].",
            "I'm actively working on a solution and will have a fix by [date].",
            "I apologize for the inconvenience."
        ],
        tips: [
            "'I wanted to' is softer than 'I want to' - better for bad news",
            "Say 'set us back' not 'make us late'",
            "Always end with a solution, not just the problem"
        ]
    },
    {
        id: 'disagree',
        title: 'Polite Disagreement',
        icon: '🤝',
        difficulty: 'Medium',
        demo: "I see your point, and I understand where you're coming from. However, I think we should consider the budget constraints before moving forward. Perhaps we could start with a smaller pilot program first? What do you think?",
        practicePhrases: [
            "I see your point, and I understand where you're coming from.",
            "However, I think we should consider [concern] before [action].",
            "Perhaps we could [alternative] first? What do you think?"
        ],
        tips: [
            "Always acknowledge first: 'I see your point'",
            "Use 'However' not 'But' - sounds more professional",
            "End with a question to keep conversation open"
        ]
    },
    {
        id: 'smalltalk',
        title: 'Coffee Chat',
        icon: '☕',
        difficulty: 'Easy',
        demo: "Hey! How's it going? Did you do anything fun over the weekend? I went hiking with some friends. The weather was perfect. We should plan a team outing sometime!",
        practicePhrases: [
            "Hey! How's it going?",
            "Did you do anything fun over the weekend?",
            "I went [activity] with [people].",
            "We should [suggestion] sometime!"
        ],
        tips: [
            "'How's it going?' is casual and friendly",
            "Ask about THEIR weekend before talking about yours",
            "'We should... sometime!' is great for making plans"
        ]
    },
    {
        id: 'interview',
        title: 'Job Interview',
        icon: '💼',
        difficulty: 'Hard',
        demo: "I'm a results-driven marketing professional with five years of experience in digital campaigns. In my current role, I increased our social media engagement by forty percent within six months. I'm particularly drawn to this position because of your company's focus on innovation.",
        practicePhrases: [
            "I'm a [adjective] [job title] with [X] years of experience in [field].",
            "In my current role, I [specific achievement with numbers].",
            "I'm particularly drawn to this position because [reason]."
        ],
        tips: [
            "Use numbers: 'forty percent' not 'a lot'",
            "Say 'results-driven' not 'hard-working'",
            "Connect your experience to THEIR company"
        ]
    }
];

// ==========================================
// VOICE SETUP - Fix the robot voice
// ==========================================

function setupVoice() {
    const voices = speechSynthesis.getVoices();
    
    // Priority order for natural voices
    const preferredVoices = [
        'Google US English',
        'Microsoft David',
        'Samantha',
        'Alex',
        'Fred',
        'Victoria',
        'Google UK English Female'
    ];
    
    for (const name of preferredVoices) {
        const found = voices.find(v => v.name.includes(name));
        if (found) {
            bestVoice = found;
            console.log('Using voice:', found.name);
            return;
        }
    }
    
    // Fallback to any English female voice
    bestVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Female')) 
        || voices.find(v => v.lang === 'en-US')
        || voices[0];
}

// ==========================================
// SCREEN NAVIGATION
// ==========================================

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ==========================================
// HOME SCREEN - Show all lessons
// ==========================================

function renderLessons() {
    const grid = document.getElementById('lessons-grid');
    grid.innerHTML = '';
    
    LESSONS.forEach(lesson => {
        const card = document.createElement('div');
        card.className = 'lesson-card';
        card.onclick = () => startLesson(lesson);
        
        const progress = getLessonProgress(lesson.id);
        
        card.innerHTML = `
            <div class="lesson-icon">${lesson.icon}</div>
            <div class="lesson-info">
                <h3>${lesson.title}</h3>
                <span class="difficulty ${lesson.difficulty.toLowerCase()}">${lesson.difficulty}</span>
                ${progress > 0 ? `<span class="progress-badge">⭐ ${progress}%</span>` : ''}
            </div>
            <div class="lesson-arrow">→</div>
        `;
        grid.appendChild(card);
    });
}

// ==========================================
// START LESSON - The Stimuler-style flow
// ==========================================

function startLesson(lesson) {
    currentLesson = lesson;
    currentStep = 0;
    userAttempts = [];
    
    document.getElementById('lesson-title').textContent = lesson.title;
    document.getElementById('lesson-icon').textContent = lesson.icon;
    document.getElementById('progress-fill').style.width = '0%';
    
    showScreen('lesson-screen');
    showStep('listen');
}

// ==========================================
// STEP 1: LISTEN - AI speaks the demo perfectly
// ==========================================

function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    
    if (step === 'listen') {
        document.getElementById('demo-text').textContent = currentLesson.demo;
        document.getElementById('tip-text').textContent = currentLesson.tips[0];
    }
    else if (step === 'practice') {
        const phrase = currentLesson.practicePhrases[currentStep];
        document.getElementById('target-phrase').textContent = phrase;
        document.getElementById('attempt-count').textContent = `Attempt ${userAttempts.length + 1}`;
    }
    else if (step === 'feedback') {
        showFeedback();
    }
}

function playDemo() {
    const btn = document.getElementById('play-demo-btn');
    btn.disabled = true;
    btn.textContent = '🔊 Playing...';
    
    const utterance = new SpeechSynthesisUtterance(currentLesson.demo);
    utterance.voice = bestVoice;
    utterance.rate = 0.85; // Slightly slower for learning
    utterance.pitch = 1.05; // Slightly higher = more energetic
    
    utterance.onend = () => {
        btn.disabled = false;
        btn.textContent = '🔊 Listen Again';
    };
    
    speechSynthesis.speak(utterance);
}

function goToPractice() {
    showStep('practice');
}

// ==========================================
// STEP 2: PRACTICE - User speaks, we listen
// ==========================================

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Please use Chrome or Edge browser for voice features.");
        return null;
    }
    
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;
    
    rec.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(r => r[0].transcript)
            .join('');
        document.getElementById('user-transcript').textContent = transcript;
        
        if (event.results[0].isFinal) {
            handleUserSpeech(transcript);
        }
    };
    
    rec.onerror = (e) => {
        console.error('Speech error:', e.error);
        document.getElementById('mic-btn').textContent = '🎤 Tap to Speak';
        document.getElementById('mic-btn').classList.remove('listening');
        
        if (e.error === 'no-speech') {
            document.getElementById('user-transcript').textContent = 'No speech detected. Try speaking louder.';
        }
    };
    
    return rec;
}

function toggleMic() {
    if (!recognition) recognition = initSpeechRecognition();
    if (!recognition) return;
    
    const btn = document.getElementById('mic-btn');
    
    if (isListening) {
        recognition.stop();
        isListening = false;
        btn.textContent = '🎤 Tap to Speak';
        btn.classList.remove('listening');
    } else {
        document.getElementById('user-transcript').textContent = 'Listening...';
        btn.textContent = '🔴 Stop';
        btn.classList.add('listening');
        isListening = true;
        
        try {
            recognition.start();
        } catch(e) {
            recognition.stop();
            setTimeout(() => recognition.start(), 200);
        }
    }
}

async function handleUserSpeech(text) {
    isListening = false;
    document.getElementById('mic-btn').textContent = '🎤 Tap to Speak';
    document.getElementById('mic-btn').classList.remove('listening');
    
    // Save attempt
    userAttempts.push({
        text: text,
        timestamp: Date.now()
    });
    
    // Show analyzing
    document.getElementById('user-transcript').textContent = `"${text}"\n\nAnalyzing...`;
    
    // Get feedback from Groq
    const feedback = await analyzeWithGroq(text, currentLesson.practicePhrases[currentStep]);
    
    // Store feedback
    userAttempts[userAttempts.length - 1].feedback = feedback;
    
    // Show feedback screen
    showFeedback(feedback, text);
}

// ==========================================
// GROQ API - Get real teaching feedback
// ==========================================

async function analyzeWithGroq(userText, targetPhrase) {
    // Check if API key is set
    if (CONFIG.GROQ_API_KEY === 'YOUR_GROQ_KEY_HERE' || !CONFIG.GROQ_API_KEY) {
        return {
            error: true,
            message: "API key not set! Please add your Groq API key in the code.",
            score: 0,
            corrections: [],
            encouragement: "Set up your API key first!"
        };
    }
    
    const prompt = `You are an expert English speaking coach. A learner is practicing workplace English.

TARGET PHRASE TO PRACTICE: "${targetPhrase}"

WHAT THE LEARNER SAID: "${userText}"

Analyze their speech and return ONLY this JSON format:
{
    "score": number from 0-100,
    "pronunciation_issues": ["word they mispronounced or skipped"],
    "grammar_mistakes": [{"wrong": "what they said", "right": "correct version", "why": "brief explanation"}],
    "encouragement": "one encouraging sentence",
    "specific_tip": "one specific tip to improve this phrase",
    "try_again": true or false (true if score < 80)
}

Be strict but encouraging. Focus on workplace-appropriate language.`;

    try {
        const res = await fetch(CONFIG.GROQ_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                messages: [{role: 'user', content: prompt}],
                temperature: 0.3,
                max_tokens: 400
            })
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error?.message || 'API error');
        }
        
        const data = await res.json();
        const content = data.choices[0].message.content;
        
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        throw new Error('Invalid response format');
        
    } catch (err) {
        console.error('Groq error:', err);
        return {
            error: true,
            message: err.message,
            score: 50,
            pronunciation_issues: [],
            grammar_mistakes: [],
            encouragement: "Connection issue. Check your API key!",
            specific_tip: "Make sure your Groq API key is correct.",
            try_again: true
        };
    }
}

// ==========================================
// SHOW FEEDBACK - Like Stimuler does
// ==========================================

function showFeedback(feedback, userText) {
    // Hide practice, show feedback
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-feedback').classList.add('active');
    
    const container = document.getElementById('feedback-content');
    
    if (feedback.error) {
        container.innerHTML = `
            <div class="error-box">
                <h3>⚠️ Connection Problem</h3>
                <p>${feedback.message}</p>
                <p><strong>To fix:</strong> Go to console.groq.com → Get free API key → Paste it in the code</p>
            </div>
        `;
        document.getElementById('next-btn').textContent = 'Try Again';
        document.getElementById('next-btn').onclick = () => showStep('practice');
        return;
    }
    
    // Score circle
    const scoreColor = feedback.score >= 80 ? 'green' : feedback.score >= 60 ? 'yellow' : 'red';
    
    let html = `
        <div class="score-circle ${scoreColor}">
            <span class="score-number">${feedback.score}</span>
            <span class="score-label">/ 100</span>
        </div>
        
        <div class="encouragement">${feedback.encouragement}</div>
    `;
    
    // Pronunciation issues
    if (feedback.pronunciation_issues && feedback.pronunciation_issues.length > 0) {
        html += `<div class="feedback-section">
            <h4>🗣️ Pronunciation</h4>
            <p>Practice these words: <strong>${feedback.pronunciation_issues.join(', ')}</strong></p>
        </div>`;
    }
    
    // Grammar mistakes
    if (feedback.grammar_mistakes && feedback.grammar_mistakes.length > 0) {
        html += `<div class="feedback-section">
            <h4>📝 Grammar Fixes</h4>`;
        feedback.grammar_mistakes.forEach(mistake => {
            html += `<div class="mistake-card">
                <div class="mistake-wrong">❌ ${mistake.wrong}</div>
                <div class="mistake-right">✅ ${mistake.right}</div>
                <div class="mistake-why">💡 ${mistake.why}</div>
            </div>`;
        });
        html += `</div>`;
    }
    
    // Specific tip
    html += `<div class="feedback-section tip-box">
        <h4>💡 Pro Tip</h4>
        <p>${feedback.specific_tip}</p>
    </div>`;
    
    container.innerHTML = html;
    
    // Update progress bar
    const progress = ((currentStep + 1) / currentLesson.practicePhrases.length) * 100;
    document.getElementById('progress-fill').style.width = progress + '%';
    
    // Set next button
    const nextBtn = document.getElementById('next-btn');
    if (feedback.try_again && userAttempts.length < 3) {
        nextBtn.textContent = '🔄 Try Again';
        nextBtn.onclick = () => showStep('practice');
    } else if (currentStep < currentLesson.practicePhrases.length - 1) {
        nextBtn.textContent = 'Next Phrase →';
        nextBtn.onclick = () => {
            currentStep++;
            userAttempts = [];
            showStep('practice');
        };
    } else {
        nextBtn.textContent = '✅ Lesson Complete!';
        nextBtn.onclick = () => {
            saveLessonProgress(currentLesson.id, feedback.score);
            showScreen('home-screen');
            renderLessons();
        };
    }
}

// ==========================================
// PROGRESS TRACKING
// ==========================================

function getLessonProgress(lessonId) {
    const progress = JSON.parse(localStorage.getItem('fluency_progress') || '{}');
    return progress[lessonId] || 0;
}

function saveLessonProgress(lessonId, score) {
    const progress = JSON.parse(localStorage.getItem('fluency_progress') || '{}');
    const current = progress[lessonId] || 0;
    progress[lessonId] = Math.max(current, score);
    localStorage.setItem('fluency_progress', JSON.stringify(progress));
}

// ==========================================
// INIT
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Setup voice
    speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = setupVoice;
    }
    setupVoice();
    
    // Render lessons
    renderLessons();
    
    // Check API key
    if (CONFIG.GROQ_API_KEY === 'YOUR_GROQ_KEY_HERE') {
        console.warn('⚠️ Please set your Groq API key!');
    }
});
