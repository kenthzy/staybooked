let conversationState = {
    currentQuestion: 0,
    answers: {},
    questions: [
        {
            text: "💰 What's your budget for this project?",
            key: "budget",
            options: ["Under $1k", "$1k-$5k", "$5k-$10k", "$10k+"]
        },
        {
            text: "🧑‍🤝‍🧑 Who is your target audience?",
            key: "audience",
            options: ["Families", "Couples", "Business Travelers", "Backpackers"]
        },
        {
            text: "🖥️ Which platform are you using?",
            key: "platform",
            options: ["Airbnb Only", "Airbnb + VRBO", "Multiple Platforms", "Custom Website"]
        },
        {
            text: "📍 Where is your target market?",
            key: "location",
            options: ["Urban City", "Suburban", "Rural", "Vacation Destination"]
        },
        {
            text: "🛠️ Desired extra features?",
            key: "features",
            options: ["Smart Home Tech", "Premium Photography", "Concierge", "Experience Packages"]
        }
    ]
};

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const chatBox = document.getElementById('chatBox');
    const message = userInput.value.trim();

    if (message) {
        addMessage('user', message);
    }

    try {
        if (conversationState.currentQuestion < conversationState.questions.length) {
            const currentQ = conversationState.questions[conversationState.currentQuestion];
            addMessage('bot', currentQ.text, currentQ.options);
            conversationState.currentQuestion++;
        } else {
            // Show generating message
            const generatingMsg = addMessage('bot', '✨ Staybooked is now generating your strategy...');
            
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answers: conversationState.answers,
                    lastMessage: message
                })
            });
            
            generatingMsg.remove();
            const aiResponse = await response.json();
            addMessage('bot', aiResponse.formatted || aiResponse.text);
            
            // Add follow-up options
            addMessage('bot', "**What would you like to do next?**", [
                "Ask Another Question",
                "Start Over",
                "Save Strategy"
            ]);
            
            // Reset conversation state
            conversationState = { 
                currentQuestion: 0, 
                answers: {},
                questions: conversationState.questions 
            };
        }
        
        userInput.value = '';
        chatBox.scrollTop = chatBox.scrollHeight;
        
    } catch (error) {
        addMessage('error', `⚠️ **Error:** ${error.message}`);
    }
}

function addMessage(type, content, options = []) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;
    
    let contentHTML = '';
    switch(type) {
        case 'bot':
            contentHTML = `
                <div class="message-header">
                    <img class="bot-icon" src="/assets/icon.svg" width="24" height="24" alt="Bot Icon" />
                    <span class="message-time">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="message-content md-content">${content}</div>
                ${options.length ? `
                    <div class="options-container">
                        ${options.map(opt => `
                            <button class="option-btn btn-sm btn" 
                                    onclick="selectOption('${opt}')"
                                    data-value="${opt}">
                                ${opt}
                            </button>
                        `).join('')}
                    </div>` : ''}
            `;
            break;
            
        case 'user':
            contentHTML = `
                <div class="message-header">
                    <span class="user-icon">👤</span>
                    <span class="message-time">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="message-content">${content}</div>
            `;
            break;
            
        case 'error':
            contentHTML = `
                <div class="error-content">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">${content}</div>
                    <button class="retry-btn" onclick="sendMessage()">Try Again</button>
                </div>
            `;
    }
    
    messageDiv.innerHTML = contentHTML;
    chatBox.appendChild(messageDiv);
    return messageDiv;
}

function handleOption(option) {
    const chatBox = document.getElementById('chatBox');
    
    if(option === "Start Over") {
        conversationState = {
            currentQuestion: 0,
            answers: {},
            questions: conversationState.questions
        };
        chatBox.innerHTML = '';
        sendMessage();
    } else if(option === "Save Strategy") {
        const lastMessage = chatBox.lastElementChild;
        const content = lastMessage.querySelector('.md-content').innerText;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Staybooked-Strategy-${Date.now()}.txt`;
        a.click();
    } else if(option === "Ask Another Question") {
        conversationState.currentQuestion = conversationState.questions.length;
        addMessage('bot', "What additional question would you like to ask?");
    }
}

function selectOption(value) {
    const currentQuestionIndex = conversationState.currentQuestion - 1;
    const currentKey = conversationState.questions[currentQuestionIndex]?.key;
    
    if (currentKey) {
        conversationState.answers[currentKey] = value;
        // Clear options after selection
        document.getElementById('optionsContainer').innerHTML = '';
        // Automatically advance to next question
        sendMessage();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/user')
        .then(res => res.json())
        .then(data => {
            document.getElementById('username').textContent = data.username;
        })
        .catch(err => {
            console.error('Error getting username:', err);
            document.getElementById('username').textContent = 'Guest';
        });
});