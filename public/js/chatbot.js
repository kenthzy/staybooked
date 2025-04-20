let conversationState = {
    currentQuestion: 0,
    answers: {},
    questions: [
        {
            text: "💰 What's your budget for this project?",
            key: "budget",
            options: ["Under PHP 50k", "PHP 50k - PHP 250k", "PHP 250k - PHP 500k", "PHP 500k+"]
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
            
            addMessage('bot', "**What would you like to do next?**", [
                { text: "Ask Another Question", action: "handleOption" },
                { text: "Start Over", action: "handleOption" },
                { text: "Save Strategy", action: "handleOption" }
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
                                    onclick="${typeof opt === 'object' ? opt.action : 'selectOption'}('${typeof opt === 'object' ? opt.text : opt}')"
                                    data-value="${typeof opt === 'object' ? opt.text : opt}">
                                ${typeof opt === 'object' ? opt.text : opt}
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
        // Get the strategy content
        const messages = chatBox.children;
        const strategyMessage = messages[messages.length - 2];
        const content = strategyMessage.querySelector('.md-content').innerText;

        // Create PDF
        const doc = new jspdf.jsPDF();
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        
        // Add title
        doc.setFontSize(16);
        doc.text("Staybooked Strategy", 10, 20);
        doc.setLineWidth(0.5);
        doc.line(10, 25, 200, 25);
        
        // Add content
        doc.setFontSize(12);
        const splitText = doc.splitTextToSize(content, 180);
        doc.text(splitText, 10, 35);
        
        // Save PDF
        doc.save(`Staybooked-Strategy-${new Date().toLocaleDateString()}.pdf`);
    } else if(option === "Ask Another Question") {
        // Add visual feedback and clear input
        addMessage('bot', "Sure! What additional question would you like to ask?");
        document.getElementById('userInput').focus();
    }
}

function selectOption(value) {
    const postActions = ["Ask Another Question", "Start Over", "Save Strategy"];
    
    // Handle post-survey actions
    if (postActions.includes(value)) {
        handleOption(value);
        return;
    }

    // Original survey answer handling
    const currentQuestionIndex = conversationState.currentQuestion - 1;
    const currentKey = conversationState.questions[currentQuestionIndex]?.key;
    
    if (currentKey) {
        addMessage('user', value);
        conversationState.answers[currentKey] = value;
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