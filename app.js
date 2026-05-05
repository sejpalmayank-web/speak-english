   const CONFIG = {
    GROQ_API_KEY: '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', // Replace with your key
    GROQ_URL: 'https://api.groq.com/openai/v1/chat/completions',
    MODEL: 'llama3-8b-8192',
    MAX_TURNS: 10
};

let currentScenario = null;
let conversationHistory = [];
let turnCount = 0;
let isListening = false;
let recognition = null;
let currentTopic = null;

const SCENARIOS = {
    standup: {
        title: "Daily Standup",
        icon: "📊",
        prompt: "You're in a daily standup meeting. Briefly share what you did yesterday, what you're doing today, and any blockers. Keep it under 30 seconds.",
        starter: "Good morning! Let's do our standup. What did you work on yesterday?",
        followUps: [
            "Any blockers I can help with?",
            "That sounds good. What's your top priority for today?",
            "Great update! How confident are you about the deadline?"
        ]
    },
    email: {
        title: "Explain via Voice Message",
        icon: "📧",
        prompt: "You need to send a voice message to your team explaining a project delay. Be professional but honest.",
        starter: "Hey, I need you to record a quick voice note to the team about the project delay. What's the situation?",
        followUps: [
            "How will this affect the timeline?",
            "What can we do to speed things up?",
            "Should we inform the client now or wait?"
        ]
    },
    client: {
        title: "Difficult Client Call",
        icon: "🤝",
        prompt: "A client is unhappy about a missed deadline. Apologize professionally and propose a solution.",
        starter: "Hi, this is regarding the delivery delay. I understand your frustration...",
        followUps: [
            "The client says: 'This is unacceptable. We might cancel.' What do you say?",
            "They want a 20% discount. How do you respond?",
            "How will you prevent this in the future?"
        ]
    },
    meeting: {
        title: "Agree & Disagree",
        icon: "🗣️",
        prompt: "Practice polite agreement and disagreement in meetings. Use phrases like 'I see your point, but...' or 'I completely agree because...'",
        starter: "I think we should move the launch to next quarter. What's your opinion?",
        followUps: [
            "But the marketing team is already prepared. How do we handle that?",
            "What's your counter-proposal?",
            "Can we find a middle ground?"
        ]
    },
    smalltalk: {
        title: "Office Small Talk",
        icon: "☕",
        prompt: "Casual conversation with a colleague by the coffee machine. Keep it light and friendly.",
        starter: "Hey! How was your weekend? Did you do anything fun?",
        followUps: [
            "That sounds nice. I've been getting into hiking lately. Do you like outdoor stuff?",
            "Oh, I'm more of a homebody. What do you usually do to relax?",
            "We should grab lunch sometime this week!"
        ]
    },
    interview: {
        title: "Job Interview",
        icon: "💼",
        prompt: "Common interview questions. Practice confident, concise answers.",
        starter: "Tell me about yourself and why you're interested in this role.",
        followUps: [
            "What's your biggest weakness?",
            "Describe a challenging situation at work and how you handled it.",
            "Where do you see yourself in 5 years?"
        ]
    }
};

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Please use Chrome/Android for voice features. iOS Safari has limited support.");
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
        document.getElementById('user-text').textContent = transcript;
        
        if (event.results[0].isFinal) {
            handleUserInput(transcript);
        }
    };
    
    rec.onerror = (e) => {
        console.error('Speech error:', e.error);
        if (e.error === 'no-speech') {
            showFeedback("I didn't catch that. Try speaking louder or closer to the mic.", 'tip');
        }
        stopListening();
    };
    
    rec.onend = () => {
        if (isListening) {
            setTimeout(() => {
                if (isListening) recognition.start();
            }, 300);
        }
    };
    
    return rec;
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function selectScenario(key) {
    currentScenario = SCENARIOS[key];
    currentTopic = key;
    conversationHistory = [];
    turnCount = 0;
    
    document.getElementById('scenario-title').textContent = currentScenario.title;
    document.getElementById('scenario-icon').textContent = currentScenario.icon;
    document.getElementById('ai-message').textContent = "Loading...";
    document.getElementById('chat-history').innerHTML = '';
    document.getElementById('user-text').textContent = 'Tap mic and speak...';
    
    showScreen('practice-screen');
    startConversation();
}

async function startConversation() {
    const msg = currentScenario.starter;
    addToChat('ai', msg);
    await speakText(msg);
    startListening();
}

function startListening() {
    if (!recognition) recognition = initSpeechRecognition();
    if (!recognition) return;
    
    isListening = true;
    document.getElementById('mic-btn').classList.add('listening');
    document.getElementById('mic-btn').innerHTML = '🔴 Listening...';
    
    try {
        recognition.start();
    } catch(e) {
        recognition.stop();
        setTimeout(() => recognition.start(), 100);
    }
}

function stopListening() {
    isListening = false;
    if (recognition) recognition.stop();
    document.getElementById('mic-btn').classList.remove('listening');
    document.getElementById('mic-btn').innerHTML = '🎤 Tap to Speak';
}

function toggleListening() {
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
}

async function handleUserInput(text) {
    stopListening();
    turnCount++;
    
    addToChat('user', text);
    conversationHistory.push({role: 'user', content: text});
    
    document.getElementById('ai-message').textContent = "Thinking...";
    
    const aiResponse = await getAIResponse(text);
    const feedback = await analyzeSpeech(text);
    showFeedback(feedback);
    
    addToChat('ai', aiResponse);
    document.getElementById('ai-message').textContent = aiResponse;
    await speakText(aiResponse);
    
    if (turnCount >= CONFIG.MAX_TURNS) {
        setTimeout(() => endSession(), 2000);
    } else {
        startListening();
    }
}

async function getAIResponse(userText) {
    const messages = [
        {
            role: 'system',
            content: `You are Alex, a friendly workplace English tutor. 
            Current scenario: ${currentScenario.title}.
            Context: ${currentScenario.prompt}
            
            RULES:
            - Keep responses to 1-2 short sentences (under 20 words)
            - If user makes a grammar mistake, correct it gently: "Quick tip: say 'I worked' not 'I work' (past tense)"
            - Then ask a follow-up question to continue
            - Be encouraging but natural
            - Use casual workplace English, not formal textbook English`
        },
        ...conversationHistory.slice(-4),
        {role: 'user', content: userText}
    ];
    
    try {
        const res = await fetch(CONFIG.GROQ_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                messages: messages,
                temperature: 0.7,
                max_tokens: 100
            })
        });
        
        const data = await res.json();
        const reply = data.choices[0].message.content;
        conversationHistory.push({role: 'assistant', content: reply});
        return reply;
        
    } catch (err) {
        console.error(err);
        return "Sorry, I'm having trouble connecting. Let's try again!";
    }
}

async function analyzeSpeech(text) {
    const prompt = `Analyze this spoken English for a learner. Return ONLY a JSON object:
    {
        "grammar_errors": [{"error": "wrong phrase", "correction": "right phrase", "explanation": "why"}],
        "filler_words": {"count": number, "examples": ["um", "uh"]},
        "vocabulary_score": 1-10,
        "fluency_tip": "one specific tip for improvement",
        "encouragement": "one encouraging comment"
    }
    
    Text: "${text}"`;
    
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
                max_tokens: 300
            })
        });
        
        const data = await res.json();
        const jsonStr = data.choices[0].message.content;
        return JSON.parse(jsonStr.replace(/```json/g, '').replace(/```/g, ''));
        
    } catch (err) {
        return {
            grammar_errors: [],
            filler_words: {count: 0},
            vocabulary_score: 5,
            fluency_tip: "Keep practicing!",
            encouragement: "Good effort!"
        };
    }
}

function speakText(text) {
    return new Promise((resolve) => {
        const cleanText = text.replace(/Quick tip:.*?\./g, '');
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.lang = 'en-US';
        
        const voices = speechSynthesis.getVoices();
        const goodVoice = voices.find(v => v.name.includes('Google US English')) 
            || voices.find(v => v.lang === 'en-US' && v.name.includes('Female'))
            || voices[0];
        if (goodVoice) utterance.voice = goodVoice;
        
        utterance.onend = resolve;
        speechSynthesis.speak(utterance);
    });
}

function addToChat(sender, text) {
    const div = document.createElement('div');
    div.className = `chat-bubble ${sender}`;
    div.textContent = text;
    document.getElementById('chat-history').appendChild(div);
    document.getElementById('chat-history').scrollTop = 999999;
}

function showFeedback(analysis) {
    const panel = document.getElementById('feedback-panel');
    let html = `<div class="feedback-card">`;
    
    html += `<div class="encouragement">✨ ${analysis.encouragement}</div>`;
    
    if (analysis.grammar_errors && analysis.grammar_errors.length > 0) {
        html += `<div class="corrections">
            <h4>📝 Quick Fixes</h4>`;
        analysis.grammar_errors.forEach(err => {
            html += `<div class="correction-item">
                <span class="wrong">${err.error}</span> → 
                <span class="right">${err.correction}</span>
                <small>${err.explanation}</small>
            </div>`;
        });
        html += `</div>`;
    }
    
    if (analysis.filler_words.count > 0) {
        html += `<div class="fillers">
            <h4>🗣️ Filler Words: ${analysis.filler_words.count}</h4>
            <small>Try pausing silently instead of "um"</small>
        </div>`;
    }
    
    html += `<div class="score">Vocab Score: ${analysis.vocabulary_score}/10</div>`;
    html += `<div class="tip">💡 ${analysis.fluency_tip}</div>`;
    html += `</div>`;
    panel.innerHTML = html;
    
    saveStats(analysis);
}

function saveStats(analysis) {
    const stats = JSON.parse(localStorage.getItem('fluency_stats') || '[]');
    stats.push({
        date: new Date().toISOString(),
        scenario: currentTopic,
        vocab_score: analysis.vocabulary_score,
        errors: analysis.grammar_errors.length,
        fillers: analysis.filler_words.count
    });
    localStorage.setItem('fluency_stats', JSON.stringify(stats.slice(-50)));
}

function endSession() {
    stopListening();
    const stats = JSON.parse(localStorage.getItem('fluency_stats') || '[]');
    const recent = stats.slice(-5);
    const avgScore = recent.reduce((a,s) => a + s.vocab_score, 0) / recent.length;
    
    document.getElementById('session-summary').innerHTML = `
        <h3>🎉 Session Complete!</h3>
        <p>You practiced: <strong>${currentScenario.title}</strong></p>
        <p>Average Vocab Score: <strong>${avgScore.toFixed(1)}/10</strong></p>
        <p>Total turns: ${turnCount}</p>
        <button onclick="showScreen('home-screen')" class="btn-primary">Practice Another Topic</button>
    `;
    showScreen('summary-screen');
}

document.addEventListener('DOMContentLoaded', () => {
    recognition = initSpeechRecognition();
    
    const grid = document.getElementById('scenario-grid');
    Object.entries(SCENARIOS).forEach(([key, scenario]) => {
        const card = document.createElement('div');
        card.className = 'scenario-card';
        card.onclick = () => selectScenario(key);
        card.innerHTML = `
            <div class="scenario-icon">${scenario.icon}</div>
            <h3>${scenario.title}</h3>
            <p>${scenario.prompt.substring(0, 60)}...</p>
        `;
        grid.appendChild(card);
    });
    
    speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
});
