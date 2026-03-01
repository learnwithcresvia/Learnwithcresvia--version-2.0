// src/services/ragService.js
// Powered by Google Gemini API — free tier

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const API_KEY    = import.meta.env.VITE_GEMINI_API_KEY;

async function callGemini(systemPrompt, userMessage, history = []) {
  try {
    const contents = [];
    
    if (systemPrompt && history.length === 0) {
      contents.push({ role: 'user',  parts: [{ text: systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
    }
    
    history.forEach(msg => {
      contents.push({
        role:  msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    });
    
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const response = await fetch(`${GEMINI_API}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `API ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

  } catch (err) {
    console.error('Gemini API error:', err.message);
    throw err; // re-throw so callers can show proper error messages
  }
}

function buildSystemPrompt(question, userLevel) {
  return `You are Cresvia AI, a programming tutor.
Question: ${question?.title || 'Unknown'}
Topic: ${question?.topic || 'Programming'}
Difficulty: ${question?.difficulty || 'EASY'}
Student Level: ${userLevel}
Rules: Never give full solution. Explain concepts. Keep responses 3-5 sentences. Be encouraging.`;
}

class RAGService {
  constructor() {
    this.history = [];
    this.currentQuestion = null;
    this.userLevel = 'Beginner';
  }

  async explainConcept(question, userLevel) {
    this.currentQuestion = question;
    this.userLevel = userLevel || 'Beginner';
    this.history = [];
    const system = buildSystemPrompt(question, userLevel);
    const prompt = `Explain the core concept for "${question?.title}" — theory only.`;
    const reply = await callGemini(system, prompt, []);
    this.history = [
      { role: 'user',      content: prompt },
      { role: 'assistant', content: reply  },
    ];
    return reply;
  }

  async askFollowUp(userMessage) {
    const system = buildSystemPrompt(this.currentQuestion, this.userLevel);
    const reply = await callGemini(system, userMessage, this.history);
    this.history.push({ role: 'user',      content: userMessage });
    this.history.push({ role: 'assistant', content: reply       });
    return reply;
  }

  async getHint(question, userCode, userLevel) {
    this.currentQuestion = question;
    this.userLevel = userLevel || 'Beginner';
    const system = buildSystemPrompt(question, userLevel);
    const prompt = userCode?.trim()?.length > 10
      ? `Here is my current code:\n\`\`\`\n${userCode}\n\`\`\`\nGive me a hint to move forward — no full solution.`
      : `Give me a hint to start thinking about this problem.`;
    const reply = await callGemini(system, prompt, []);
    this.history.push({ role: 'user',      content: prompt });
    this.history.push({ role: 'assistant', content: reply  });
    return reply;
  }

  async analyseWeakness(attemptHistory) {
    const summary = attemptHistory.slice(0, 20).map(a => `${a.topic}: ${a.is_correct ? '✓' : '✗'}`).join(', ');
    const system  = `You are a programming coach.`;
    const prompt  = `Results: ${summary}. Give 2-3 sentence analysis with ONE recommendation.`;
    return await callGemini(system, prompt, []);
  }

  async generateQuestions(topic, difficulty, language, count) {
    const system = `You create coding questions. Respond ONLY with valid JSON array. No markdown, no backticks, no text outside JSON.`;
    const prompt = `Create ${count} ${difficulty} ${language} question(s) about "${topic}".
JSON format:
[{"title":"...","description":"...","topic":"${topic}","difficulty":"${difficulty}","language":"${language}","starter_code":"# code\\n","test_cases":[{"input":"...","expected_output":"..."}],"hints":["..."],"explanation":"..."}]`;

    try {
      const raw   = await callGemini(system, prompt, []);
      let   clean = raw.trim();
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) clean = match[0];
      else clean = clean.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      throw new Error(`Generation failed: ${e.message}`);
    }
  }

  clearHistory() {
    this.history          = [];
    this.currentQuestion  = null;
  }
}

export const ragService = new RAGService();
export default ragService;
