// CHATBOT CONFIGURATION

const conversationState = {
    currentQuestion: 0,
    answers: {},
    strategyGenerated: false,
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
  
  // CORE FUNCTIONS
  
  /**
   * Handles sending messages and managing conversation flow
   */
  async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const chatBox = document.getElementById('chatBox');
    const message = userInput.value.trim();
  
    // Add user message if exists
    if (message) {
      addMessage('user', message);
    }
  
    try {
      if (isInQuestionPhase()) {
        askNextQuestion();
      } else if (!conversationState.strategyGenerated) {
        await generateInitialStrategy(message);
      } else {
        await handleFollowUpQuestion(message);
      }
  
      // Reset input and scroll to bottom
      userInput.value = '';
      chatBox.scrollTop = chatBox.scrollHeight;
    } catch (error) {
      handleChatError(error);
    }
  }
  
  /**
   * Adds a message to the chat interface
   */
  function addMessage(type, content, options = []) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;
    
    messageDiv.innerHTML = generateMessageHTML(type, content, options);
    chatBox.appendChild(messageDiv);
    
    return messageDiv;
  }
  
  // CONVERSATION FLOW HELPERS
  
  function isInQuestionPhase() {
    return conversationState.currentQuestion < conversationState.questions.length;
  }
  
  function askNextQuestion() {
    const currentQuestion = conversationState.questions[conversationState.currentQuestion];
    addMessage('bot', currentQuestion.text, currentQuestion.options);
    conversationState.currentQuestion++;
  }
  
  async function generateInitialStrategy(message) {
    const loadingMsg = addMessage('bot', '✨ Staybooked is now generating your strategy...');
    
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: conversationState.answers,
        lastMessage: message
      })
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    loadingMsg.remove();
    const aiResponse = await response.json();
    addMessage('bot', aiResponse.formatted || aiResponse.text);
    showFollowUpOptions();
    
    conversationState.strategyGenerated = true;
  }
  
  async function handleFollowUpQuestion(message) {
    const loadingMsg = addMessage('bot', '✨ Researching your question...');
    
    try {
      const response = await fetch('/chat/followup', {  // Changed endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: message,
          context: conversationState.answers
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();  // Parse JSON error
        throw new Error(errorData.text || 'Failed to get response');
      }
      
      loadingMsg.remove();
      const aiResponse = await response.json();
      addMessage('bot', aiResponse.formatted || aiResponse.text);
      showFollowUpOptions();
      
    } catch (error) {
      loadingMsg.remove();
      handleChatError(error);
    }
  }
  
  function showFollowUpOptions() {
    addMessage('bot', "What would you like to do next?", [
      { text: "Ask Another Question", action: "handleOption" },
      { text: "Start Over", action: "handleOption" },
      { text: "Save Strategy", action: "handleOption" }
    ]);
  }
  
  // OPTION HANDLING
  
  function selectOption(value) {
    const POST_ACTIONS = ["Ask Another Question", "Start Over", "Save Strategy"];
    
    if (POST_ACTIONS.includes(value)) {
      handleOption(value);
      return;
    }
  
    const currentQuestionIndex = conversationState.currentQuestion - 1;
    const currentKey = conversationState.questions[currentQuestionIndex]?.key;
    
    if (currentKey) {
      addMessage('user', value);
      conversationState.answers[currentKey] = value;
      sendMessage();
    }
  }
  
  function handleOption(option) {
    const chatBox = document.getElementById('chatBox');
    
    switch (option) {
      case "Start Over":
        resetConversation();
        chatBox.innerHTML = '';
        sendMessage();
        break;
        
      case "Save Strategy":
        saveStrategyAsPDF();
        break;
        
      case "Ask Another Question":
        conversationState.currentQuestion = Infinity;
        addMessage('bot', "Sure! What additional question would you like to ask?");
        document.getElementById('userInput').focus();
        break;
    }
  }
  
  function resetConversation() {
    conversationState.currentQuestion = 0;
    conversationState.answers = {};
    conversationState.strategyGenerated = false;
  }
  
  function saveStrategyAsPDF() {
    try {
      const chatBox = document.getElementById('chatBox');
      const messages = chatBox.children;
      const strategyMessage = messages[messages.length - 2];
      const content = strategyMessage.querySelector('.md-content').innerText;
  
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
    } catch (error) {
      addMessage('error', `Failed to generate PDF: ${error.message}`);
      console.error('PDF generation error:', error);
    }
  }
  
  // UTILITY FUNCTIONS
  
  function generateMessageHTML(type, content, options) {
    const timeString = new Date().toLocaleTimeString();
    
    switch(type) {
      case 'bot':
        return `
          <div class="message-header">
            <img class="bot-icon" src="/assets/icon.svg" width="24" height="24" alt="Bot Icon" />
            <span class="message-time">${timeString}</span>
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
        
      case 'user':
        return `
          <div class="message-header">
            <span class="user-icon">👤</span>
            <span class="message-time">${timeString}</span>
          </div>
          <div class="message-content">${content}</div>
        `;
        
      case 'error':
        return `
          <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-text">${content}</div>
            <button class="retry-btn" onclick="sendMessage()">Try Again</button>
          </div>
        `;
    }
  }
  
  function handleChatError(error) {
    const sanitizedMessage = error.message.replace(/<[^>]*>?/gm, '');
    addMessage('error', `⚠️ Error: ${sanitizedMessage}`);
    console.error('API Error:', error);
  }
  
  // INITIALIZATION
  
  document.addEventListener('DOMContentLoaded', () => {
    // Load user data
    fetch('/api/user')
      .then(res => res.json())
      .then(data => {
        document.getElementById('username').textContent = data.username || 'Guest';
      })
      .catch(err => {
        console.error('Error getting username:', err);
        document.getElementById('username').textContent = 'Guest';
      });
      
    // Start conversation
    if (conversationState.currentQuestion < conversationState.questions.length) {
      askNextQuestion();
    }
  });