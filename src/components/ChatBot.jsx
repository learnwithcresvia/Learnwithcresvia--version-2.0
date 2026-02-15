import { useState, useEffect, useRef } from 'react';
import botService from '../services/botService';
import '../styles/chatbot.css';

export default function ChatBot({ questionId, sessionId, onClose }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversation();
  }, [questionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = async () => {
    const { data } = await botService.getConversation(questionId, sessionId);
    if (data) {
      setConversation(data);
      setMessages(data.messages || []);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }]);

    try {
      const { data } = await botService.sendMessage(conversation.id, userMessage);
      
      if (data) {
        // Add bot response
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (error) {
      console.error('Bot error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action) => {
    const actions = {
      hint: 'Give me a hint',
      explain: 'Explain the solution approach',
      complexity: 'What is the time complexity?',
      similar: 'Show me similar problems',
    };

    setInput(actions[action]);
    setTimeout(() => handleSend(), 100);
  };

  return (
    <div className="chatbot-overlay">
      <div className="chatbot-container">
        <div className="chatbot-header">
          <div className="chatbot-title">
            <span className="bot-icon">🤖</span>
            <h3>AI Assistant</h3>
          </div>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="chatbot-messages">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <p>👋 Hi! I'm your coding assistant.</p>
              <p>Ask me for hints, explanations, or help!</p>
              
              <div className="quick-actions">
                <button onClick={() => handleQuickAction('hint')}>💡 Give me a hint</button>
                <button onClick={() => handleQuickAction('explain')}>📖 Explain approach</button>
                <button onClick={() => handleQuickAction('complexity')}>⏱️ Time complexity</button>
                <button onClick={() => handleQuickAction('similar')}>🔄 Similar problems</button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-content">
                    {msg.content}
                  </div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="message assistant">
                  <div className="message-content typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chatbot-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            disabled={loading}
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            className="btn-send"
          >
            {loading ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
