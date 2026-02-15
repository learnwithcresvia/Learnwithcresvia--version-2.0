// src/services/ragService.js
// RAG = Retrieval Augmented Generation
// Free version: uses question context to generate targeted explanations
// No API key needed — works offline for demo

// ── Concept knowledge base (the "retrieval" part of RAG) ──────────────────────
const CONCEPT_LIBRARY = {
  // Python topics
  variables: {
    theory: "Variables in Python are containers that store data values. Unlike other languages, Python has no command for declaring a variable — it is created when you first assign a value to it. Python is dynamically typed, meaning you don't declare the type — Python figures it out from the value.",
    example: "name = 'Alice'  # string\nage = 20         # integer\ngpa = 3.8        # float\nis_student = True  # boolean",
    hint: "Think of a variable like a labelled box — the label is the name, what's inside is the value.",
  },
  loops: {
    theory: "Loops let you repeat a block of code multiple times. Python has two main loops: 'for' loops (iterate over a sequence a known number of times) and 'while' loops (repeat while a condition is True). The range() function is your best friend for for-loops.",
    example: "# For loop\nfor i in range(5):\n    print(i)  # prints 0,1,2,3,4\n\n# While loop\ncount = 0\nwhile count < 3:\n    print(count)\n    count += 1",
    hint: "Ask yourself: Do I know HOW MANY times to repeat? Use for. Do I repeat UNTIL something happens? Use while.",
  },
  functions: {
    theory: "A function is a reusable block of code that performs a specific task. You define it once with 'def' and call it many times. Functions can take parameters (inputs) and return values (outputs). This is the DRY principle — Don't Repeat Yourself.",
    example: "def greet(name):          # def + name + parameters\n    return f'Hello, {name}!'  # return sends back the result\n\nresult = greet('Alice')   # calling the function\nprint(result)             # Hello, Alice!",
    hint: "Break your solution into small functions. Each function should do ONE thing and do it well.",
  },
  lists: {
    theory: "Lists are ordered, mutable collections that can hold any type of data. They use zero-based indexing (first element is index 0). Key methods: append() adds to end, remove() deletes a value, len() gives the length, and list comprehensions give a powerful one-line way to create lists.",
    example: "fruits = ['apple', 'banana', 'cherry']\nfruits.append('date')    # add to end\nfruits[0]                # 'apple' (index 0)\nlen(fruits)              # 4\nsquares = [x**2 for x in range(5)]  # list comprehension",
    hint: "Remember: indexing starts at 0, not 1. To access the last element, use list[-1].",
  },
  strings: {
    theory: "Strings are sequences of characters. They are immutable — you can't change a character in place, you create a new string. Python has rich string methods: upper(), lower(), split(), join(), strip(), replace(). F-strings (f'Hello {name}') are the modern way to format strings.",
    example: "text = 'Hello, World!'\ntext.upper()           # 'HELLO, WORLD!'\ntext.split(',')        # ['Hello', ' World!']\ntext[0:5]              # 'Hello' (slicing)\nf'I am {20} years old' # f-string formatting",
    hint: "String slicing uses [start:end] where start is inclusive and end is exclusive.",
  },
  dictionaries: {
    theory: "Dictionaries store data as key-value pairs. Keys must be unique and immutable (strings, numbers). Values can be anything. Dictionaries are unordered (Python 3.7+ maintains insertion order). Access values with dict[key] or dict.get(key, default).",
    example: "student = {'name': 'Alice', 'age': 20, 'gpa': 3.8}\nstudent['name']          # 'Alice'\nstudent['age'] = 21      # update value\nstudent.get('grade', 'N/A')  # safe access with default\nfor key, value in student.items():  # iterate",
    hint: "Use .get() instead of [] when a key might not exist — it won't crash and lets you set a default.",
  },
  recursion: {
    theory: "Recursion is when a function calls itself. Every recursive solution has two parts: a BASE CASE (when to stop) and a RECURSIVE CASE (the self-call that moves toward the base case). Without a base case, you get infinite recursion — Python will stop it with a RecursionError.",
    example: "def factorial(n):\n    if n == 0:          # BASE CASE — stop here\n        return 1\n    return n * factorial(n-1)  # RECURSIVE CASE\n\nfactorial(5)  # 5*4*3*2*1 = 120",
    hint: "Always write the base case first. Trace through a small example by hand before coding.",
  },
  oop: {
    theory: "Object-Oriented Programming organises code around objects that combine data (attributes) and behaviour (methods). A class is a blueprint; an object is an instance of that blueprint. The __init__ method is the constructor — it runs when you create a new object. 'self' refers to the current instance.",
    example: "class Student:\n    def __init__(self, name, gpa):  # constructor\n        self.name = name    # attribute\n        self.gpa = gpa\n\n    def is_passing(self):          # method\n        return self.gpa >= 6.0\n\nalice = Student('Alice', 7.5)  # create instance\nalice.is_passing()             # True",
    hint: "Think of a class as a cookie cutter and objects as cookies — same shape (attributes/methods), different values.",
  },
  sorting: {
    theory: "Python has built-in sorting: sorted() returns a new sorted list, list.sort() sorts in-place. For custom sorting, use the key parameter. Common algorithms to know: Bubble Sort (compare adjacent pairs), Selection Sort (find min each pass), and Python's built-in Timsort (O(n log n) — very efficient).",
    example: "nums = [3, 1, 4, 1, 5, 9]\nsorted(nums)               # [1, 1, 3, 4, 5, 9] — new list\nnums.sort()                # sorts in-place\nnums.sort(reverse=True)    # descending\n\n# Sort by custom key\nstudents.sort(key=lambda s: s['gpa'], reverse=True)",
    hint: "For interviews, know the logic of bubble sort. For real code, always use Python's built-in sort.",
  },
  default: {
    theory: "This problem is testing your ability to break down a problem into logical steps. Focus on understanding what the input is, what the output should be, and what transformation happens in between.",
    example: "# General approach:\n# 1. Understand the input format\n# 2. Think about edge cases\n# 3. Write pseudocode first\n# 4. Then translate to Python",
    hint: "Read the problem statement carefully, then look at the examples. The examples often reveal the pattern.",
  }
};

// ── Map question topics to library keys ───────────────────────────────────────
function detectTopic(question) {
  if (!question) return 'default';
  const text = (question.title + ' ' + question.description + ' ' + (question.topic || '')).toLowerCase();

  if (text.includes('recursion') || text.includes('recursive'))       return 'recursion';
  if (text.includes('class') || text.includes('object') || text.includes('oop') || text.includes('inherit')) return 'oop';
  if (text.includes('sort') || text.includes('bubble') || text.includes('selection')) return 'sorting';
  if (text.includes('dict') || text.includes('hashmap') || text.includes('key'))      return 'dictionaries';
  if (text.includes('string') || text.includes('str') || text.includes('palindrome') || text.includes('reverse')) return 'strings';
  if (text.includes('list') || text.includes('array'))                return 'lists';
  if (text.includes('function') || text.includes('def ') || text.includes('return')) return 'functions';
  if (text.includes('loop') || text.includes('for ') || text.includes('while') || text.includes('range')) return 'loops';
  if (text.includes('variable') || text.includes('assign') || text.includes('type')) return 'variables';
  return question.topic?.toLowerCase().replace(/\s+/g, '') || 'default';
}

// ── Generate contextual response without API ───────────────────────────────────
function generateExplanation(question, userLevel) {
  const topicKey   = detectTopic(question);
  const concept    = CONCEPT_LIBRARY[topicKey] || CONCEPT_LIBRARY.default;
  const difficulty = question.difficulty || 'EASY';
  const title      = question.title || 'this problem';

  const levelNote = userLevel === 'Advanced'
    ? "Since you're at an advanced level, focus on time complexity after getting a working solution."
    : userLevel === 'Intermediate'
    ? "Once you have a working solution, think about whether you can make it more efficient."
    : "Take it step by step — getting a working solution first is more important than an optimal one.";

  return `**Understanding "${title}"**

**The Core Concept:**
${concept.theory}

**Quick Example:**
\`\`\`python
${concept.example}
\`\`\`

**Tip for this problem:** ${concept.hint}

${levelNote}

Ask me anything — what part is confusing you? 🤔`;
}

function generateHintResponse(question, userCode) {
  const topicKey = detectTopic(question);
  const concept  = CONCEPT_LIBRARY[topicKey] || CONCEPT_LIBRARY.default;

  if (userCode && userCode.trim().length > 20) {
    return `I can see you've made a start! Without giving away the answer, here are some things to check:

• **Logic flow**: Does your code handle the base/edge case first?
• **Data type**: Are you working with the right type? (int vs string vs list)
• **${concept.hint}**

Try adding a print() statement inside your loop or function to see what values you're getting at each step — that often reveals the bug immediately.`;
  }

  return `Here's a nudge to get started:

1. **Identify the input**: What exactly is the function receiving?
2. **Identify the output**: What exactly should it return?
3. **Think about the steps**: ${concept.hint}

Try writing your solution in plain English first (as comments), then translate each comment to Python.`;
}

function generateFollowUp(message, question) {
  const msg      = message.toLowerCase();
  const topicKey = detectTopic(question);
  const concept  = CONCEPT_LIBRARY[topicKey] || CONCEPT_LIBRARY.default;

  if (msg.includes('example') || msg.includes('show me')) {
    return `Sure! Here's a concrete example related to this concept:\n\n\`\`\`python\n${concept.example}\n\`\`\`\n\nDoes that help clarify things?`;
  }
  if (msg.includes('hint') || msg.includes('stuck') || msg.includes('help')) {
    return `Here's a hint without spoiling it: ${concept.hint}\n\nTry breaking the problem into smaller steps — what's the very first thing your code needs to do?`;
  }
  if (msg.includes('why') || msg.includes('explain')) {
    return `Great question! ${concept.theory}\n\nThe key insight for this problem is to focus on what changes with each step and what stays the same.`;
  }
  if (msg.includes('error') || msg.includes('bug') || msg.includes('wrong')) {
    return `Common bugs for this type of problem:\n• Off-by-one errors (especially with range() and indexing)\n• Forgetting to return a value from a function\n• Modifying a list while iterating over it\n\nAdd print() statements to trace your variables — which one has an unexpected value?`;
  }
  if (msg.includes('time') || msg.includes('complex') || msg.includes('efficient')) {
    return `Good thinking about efficiency! For this type of problem, think about:\n• How many times does your code visit each element?\n• Can you solve it in one pass (O(n)) or do you need nested loops (O(n²))?\n\nA working solution first, then optimise!`;
  }

  // Default contextual response
  return `That's a good question! For "${question?.title || 'this problem'}", remember: ${concept.hint}\n\nWhat specific part are you finding difficult? The input handling, the logic, or something else?`;
}

// ── RAG Service Class ─────────────────────────────────────────────────────────
class RAGService {
  constructor() {
    this.conversationHistory = [];
    this.currentQuestion     = null;
    this.userLevel           = 'Beginner';
  }

  startConversation(question, userLevel) {
    this.currentQuestion     = question;
    this.userLevel           = userLevel || 'Beginner';
    this.conversationHistory = [];
  }

  // Explain the concept — no API key needed
  async explainConcept(question, userLevel) {
    this.startConversation(question, userLevel);

    // Simulate slight delay so it feels like it's "thinking"
    await new Promise(r => setTimeout(r, 800));

    const reply = generateExplanation(question, userLevel);
    this.conversationHistory.push(
      { role: 'user',      content: 'Explain the concept' },
      { role: 'assistant', content: reply }
    );
    return reply;
  }

  // Follow-up messages
  async askFollowUp(userMessage) {
    await new Promise(r => setTimeout(r, 500));
    const reply = generateFollowUp(userMessage, this.currentQuestion);
    this.conversationHistory.push(
      { role: 'user',      content: userMessage },
      { role: 'assistant', content: reply }
    );
    return reply;
  }

  // Get a hint
  async getHint(question, userCode, userLevel) {
    await new Promise(r => setTimeout(r, 500));
    return generateHintResponse(question, userCode);
  }

  clearHistory() {
    this.conversationHistory = [];
    this.currentQuestion     = null;
  }
}

export const ragService = new RAGService();
export default ragService;
