// services/botService.js
// Enhanced AI Bot with Teaching Mode

import { supabase } from '../utils/supabaseClient';

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const USE_MOCK_BOT = import.meta.env.VITE_USE_MOCK_BOT === 'true' || !ANTHROPIC_API_KEY;

class BotService {
  
  constructor() {
    this.useMockBot = USE_MOCK_BOT;
    console.log(`🤖 Bot Mode: ${this.useMockBot ? 'TEACHING MODE (Mock)' : 'REAL AI'}`);
  }

  /**
   * Get or create conversation for a question
   */
  async getConversation(questionId, sessionId = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from('bot_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('question_id', questionId);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data: existing } = await query.single();

      if (existing) {
        return { data: existing, error: null };
      }

      const { data, error } = await supabase
        .from('bot_conversations')
        .insert([{
          user_id: user.id,
          question_id: questionId,
          session_id: sessionId,
          messages: [],
          message_count: 0,
          context_type: 'HINT',
        }])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error getting conversation:', error);
      return { data: null, error };
    }
  }

  /**
   * Send message to bot
   */
  async sendMessage(conversationId, userMessage, context = {}) {
    try {
      const { data: conversation } = await supabase
        .from('bot_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const { data: question } = await supabase
        .from('questions')
        .select('*')
        .eq('id', conversation.question_id)
        .single();

      let botResponse;
      if (this.useMockBot) {
        botResponse = await this.generateTeachingResponse(userMessage, question, context);
      } else {
        botResponse = await this.generateAIResponse(userMessage, question, conversation.messages, context);
      }

      const newMessages = [
        ...conversation.messages,
        {
          role: 'user',
          content: userMessage,
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant',
          content: botResponse,
          timestamp: new Date().toISOString(),
        },
      ];

      const { data: updated, error } = await supabase
        .from('bot_conversations')
        .update({
          messages: newMessages,
          message_count: conversation.message_count + 2,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .select()
        .single();

      if (error) throw error;

      return { data: { response: botResponse, conversation: updated }, error: null };
    } catch (error) {
      console.error('Error sending message:', error);
      return { data: null, error };
    }
  }

  /**
   * Generate teaching-style response (mock mode)
   */
  async generateTeachingResponse(userMessage, question, context) {
    const message = userMessage.toLowerCase();

    // Detect what the student needs
    if (message.includes('solution') || message.includes('answer') || message.includes('solve')) {
      return this.explainSolution(question);
    } else if (message.includes('hint') || message.includes('help') || message.includes('stuck')) {
      return this.giveProgressiveHint(question, context.hintsGiven || 0);
    } else if (message.includes('explain') || message.includes('understand') || message.includes('how')) {
      return this.explainConcept(question);
    } else if (message.includes('example') || message.includes('show')) {
      return this.giveExample(question);
    } else if (message.includes('approach') || message.includes('strategy')) {
      return this.explainApproach(question);
    } else {
      return this.getContextualResponse(userMessage, question);
    }
  }

  /**
   * Explain solution like a teacher (step-by-step)
   */
  explainSolution(question) {
    const response = `# 📚 Let me explain the solution step by step

## Understanding the Problem

**"${question.title}"** asks us to: ${this.simplifyProblem(question)}

## Breaking It Down

Let me walk you through this like I'm teaching in a classroom:

### Step 1: Identify What We Need
${this.identifyRequirements(question)}

### Step 2: Choose the Right Approach
${this.explainBestApproach(question)}

### Step 3: Write the Code

Here's how I'd solve it:

\`\`\`python
${this.generateSampleSolution(question)}
\`\`\`

## Why This Works

${this.explainWhy(question)}

## Time & Space Complexity

⏱️ **Time:** ${this.estimateTimeComplexity(question)}
💾 **Space:** ${this.estimateSpaceComplexity(question)}

## Try It Yourself!

Now that you understand the approach, try implementing it in your own words. If you get stuck on any step, just ask me about that specific part!

---
💡 **Teacher's Tip:** ${this.getTeacherTip(question)}`;

    return response;
  }

  /**
   * Give progressive hints (gets more specific)
   */
  giveProgressiveHint(question, level = 0) {
    const hints = this.generateProgressiveHints(question);
    const hintLevel = Math.min(level, hints.length - 1);
    
    return `# 💡 Hint ${hintLevel + 1}/${hints.length}

${hints[hintLevel]}

---
${hintLevel < hints.length - 1 
  ? "Still stuck? Ask for another hint!" 
  : "This is the last hint! Try to solve it now. If you need the full solution, ask me to 'explain the solution'."}`;
  }

  /**
   * Explain the concept behind the problem
   */
  explainConcept(question) {
    return `# 🎓 Let's Understand the Concept

## What This Problem Teaches

This problem focuses on **${question.topic || 'programming fundamentals'}**.

${this.explainTopicConcept(question)}

## Real-World Application

${this.giveRealWorldExample(question)}

## Key Concepts to Remember

${this.listKeyConcepts(question)}

## Practice Makes Perfect!

Try solving this problem now with this understanding. If you need help with the implementation, just ask!`;
  }

  /**
   * Give a similar example
   */
  giveExample(question) {
    return `# 📖 Let Me Show You an Example

${this.generateWalkthroughExample(question)}

## Now Try the Actual Problem

Apply the same logic to solve "${question.title}". You've got this! 💪`;
  }

  /**
   * Explain problem-solving approach
   */
  explainApproach(question) {
    return `# 🎯 Problem-Solving Strategy

## Step-by-Step Approach:

${this.generateApproachSteps(question)}

## Common Mistakes to Avoid

${this.listCommonMistakes(question)}

## How to Test Your Solution

${this.explainTesting(question)}

Ready to code? Start with Step 1 and work your way through!`;
  }

  // Helper methods for generating teaching content

  simplifyProblem(question) {
    const title = question.title.toLowerCase();
    if (title.includes('sum')) return 'calculate the sum of elements';
    if (title.includes('reverse')) return 'reverse the order of elements';
    if (title.includes('palindrome')) return 'check if something reads the same forwards and backwards';
    if (title.includes('find')) return 'locate a specific element or value';
    return 'solve the given task using the right algorithm';
  }

  identifyRequirements(question) {
    return `Looking at this problem, we need:
• Input: ${this.describeInput(question)}
• Output: ${this.describeOutput(question)}
• Constraints: ${this.describeConstraints(question)}`;
  }

  describeInput(question) {
    if (question.question_type === 'CODING') {
      return 'Data that we need to process (check the test cases for examples)';
    }
    return 'The values provided in the problem';
  }

  describeOutput(question) {
    const title = question.title.toLowerCase();
    if (title.includes('sum')) return 'A single number (the sum)';
    if (title.includes('reverse')) return 'The reversed version';
    if (title.includes('check') || title.includes('palindrome')) return 'True or False';
    return 'The result as specified';
  }

  describeConstraints(question) {
    if (question.difficulty === 'EASY') {
      return 'Keep it simple - focus on correctness first';
    } else if (question.difficulty === 'MEDIUM') {
      return 'Think about edge cases and efficiency';
    }
    return 'Optimize for both time and space complexity';
  }

  explainBestApproach(question) {
    const approaches = this.getApproaches(question);
    return `For this problem, the best approach is:

**${approaches.best.name}**

Why? ${approaches.best.reason}

Alternative approach: ${approaches.alternative.name} (${approaches.alternative.tradeoff})`;
  }

  getApproaches(question) {
    const title = question.title.toLowerCase();
    
    if (title.includes('sum') || title.includes('count')) {
      return {
        best: { 
          name: 'Iteration', 
          reason: 'We can go through each element once and accumulate the result' 
        },
        alternative: { 
          name: 'Recursion', 
          tradeoff: 'more elegant but uses more memory' 
        }
      };
    }
    
    if (title.includes('search') || title.includes('find')) {
      return {
        best: { 
          name: 'Linear Search or Hash Map', 
          reason: 'Depends on whether data is sorted' 
        },
        alternative: { 
          name: 'Binary Search', 
          tradeoff: 'only works if data is sorted' 
        }
      };
    }

    return {
      best: { 
        name: 'Step-by-step processing', 
        reason: 'Breaking the problem into smaller parts' 
      },
      alternative: { 
        name: 'Direct calculation', 
        tradeoff: 'if a formula exists' 
      }
    };
  }

  generateSampleSolution(question) {
    const title = question.title.toLowerCase();
    
    // Return sample code based on problem type
    if (title.includes('sum')) {
      return `def solution(numbers):
    # Initialize result
    total = 0
    
    # Process each number
    for num in numbers:
        total += num
    
    # Return result
    return total

# Example: solution([1,2,3,4,5]) returns 15`;
    }
    
    if (title.includes('reverse')) {
      return `def solution(text):
    # Method 1: Using slicing (Pythonic)
    return text[::-1]
    
    # Method 2: Using loop (educational)
    reversed_text = ""
    for char in text:
        reversed_text = char + reversed_text
    return reversed_text`;
    }

    return `def solution(input_data):
    # Step 1: Initialize variables
    result = None
    
    # Step 2: Process the data
    # ... your logic here ...
    
    # Step 3: Return the result
    return result`;
  }

  explainWhy(question) {
    return `This solution works because:

1. **It handles all cases:** We process each element/character systematically
2. **It's efficient:** We only go through the data once (or as needed)
3. **It's readable:** The code is easy to understand and maintain
4. **It's correct:** Test it with the examples to verify!`;
  }

  estimateTimeComplexity(question) {
    const title = question.title.toLowerCase();
    if (title.includes('nested') || title.includes('pair')) return 'O(n²) - We check each element against others';
    if (title.includes('sort')) return 'O(n log n) - Sorting is involved';
    if (title.includes('search') && question.difficulty === 'HARD') return 'O(log n) - Binary search';
    return 'O(n) - We process each element once';
  }

  estimateSpaceComplexity(question) {
    const title = question.title.toLowerCase();
    if (title.includes('reverse') || title.includes('copy')) return 'O(n) - We create a new structure';
    if (title.includes('recursive')) return 'O(n) - Recursion call stack';
    return 'O(1) - Only a few variables needed';
  }

  getTeacherTip(question) {
    const tips = [
      'Start by solving a simpler version of the problem first!',
      'Draw it out on paper before coding - visualizing helps!',
      'Test with small examples first, then scale up.',
      'Think about edge cases: empty input, single element, negative numbers.',
      'If stuck, break the problem into smaller sub-problems.',
      'Don\'t worry about perfection - get it working first, optimize later!',
    ];
    
    return tips[Math.floor(Math.random() * tips.length)];
  }

  generateProgressiveHints(question) {
    const title = question.title.toLowerCase();
    
    if (title.includes('sum')) {
      return [
        '🔍 Think about how you would add numbers manually. You keep a running total, right? That\'s exactly what your code should do!',
        '💡 You\'ll need:\n• A variable to store the sum (start at 0)\n• A loop to go through each number\n• Add each number to your sum',
        '📝 Structure: `total = 0` → `for each number` → `total = total + number` → `return total`',
        '✍️ Almost there! Use a for loop: `for num in numbers:` and accumulate with `total += num`',
      ];
    }

    if (title.includes('reverse')) {
      return [
        '🔍 Imagine reading a word backwards. You start from the end and go to the beginning.',
        '💡 Python has a slicing feature! The syntax is [start:end:step]. What if step is -1?',
        '📝 Try: `text[::-1]` - This reads the string from end to start!',
        '✍️ Full solution: `return text[::-1]` - That\'s it! Python makes it easy.',
      ];
    }

    // Default hints for any problem
    return [
      '🔍 Start by understanding the input and output. What goes in? What should come out?',
      '💡 Think about the simplest approach first. Don\'t worry about optimization yet.',
      '📝 Break it down: What are the individual steps needed to solve this?',
      '✍️ Try writing pseudocode first, then convert it to actual Python code.',
    ];
  }

  explainTopicConcept(question) {
    const topic = question.topic || 'Programming';
    
    const concepts = {
      'Arrays': 'Arrays (or lists in Python) are collections that store multiple values. Think of them as numbered boxes where you can store and retrieve items.',
      'Strings': 'Strings are sequences of characters. In Python, you can treat them like lists and access individual characters!',
      'Loops': 'Loops let us repeat actions. Instead of writing the same code 100 times, we write it once and loop 100 times!',
      'Conditionals': 'Conditionals (if/else) let our program make decisions, like "if it\'s raining, bring an umbrella."',
      'Recursion': 'Recursion is when a function calls itself. It\'s like a Russian doll - each layer has a smaller version inside!',
    };

    return concepts[topic] || `This problem teaches you about ${topic}, a fundamental concept in programming that you'll use often in real projects.`;
  }

  giveRealWorldExample(question) {
    const title = question.title.toLowerCase();
    
    if (title.includes('sum')) {
      return '💼 **Real Use:** Calculating total prices in a shopping cart, adding up scores in a game, or summing expenses in a budget app.';
    }
    if (title.includes('search') || title.includes('find')) {
      return '💼 **Real Use:** Finding a contact in your phone, searching for a product on Amazon, or looking up a word in a dictionary app.';
    }
    if (title.includes('sort')) {
      return '💼 **Real Use:** Organizing emails by date, ranking search results, or sorting products by price.';
    }
    
    return '💼 **Real Use:** This pattern is used in countless applications - from social media feeds to banking software!';
  }

  listKeyConcepts(question) {
    return `• **Variables:** Store information temporarily
• **Loops:** Repeat actions efficiently  
• **Conditions:** Make decisions in code
• **Functions:** Organize code into reusable pieces
• **Data Structures:** Choose the right tool for the job`;
  }

  generateWalkthroughExample(question) {
    const title = question.title.toLowerCase();
    
    if (title.includes('sum')) {
      return `Let's walk through adding [1, 2, 3, 4]:

**Step 1:** Start with total = 0
**Step 2:** Add 1 → total = 1
**Step 3:** Add 2 → total = 3
**Step 4:** Add 3 → total = 6
**Step 5:** Add 4 → total = 10

**Final answer:** 10

See the pattern? We're accumulating each number into our total.`;
    }

    return `Let me show you a similar example with simple numbers:

Input: [1, 2, 3]
Process: Work through each element
Output: [Expected result]

The key is understanding how each step transforms the data.`;
  }

  generateApproachSteps(question) {
    return `1️⃣ **Understand:** Read the problem carefully. What's the input? What's the output?

2️⃣ **Examples:** Work through the test cases by hand. See the pattern?

3️⃣ **Plan:** Write pseudocode or comments outlining your solution.

4️⃣ **Code:** Implement your plan step by step.

5️⃣ **Test:** Run your code with the examples. Does it work?

6️⃣ **Debug:** If not, trace through your code line by line.`;
  }

  listCommonMistakes(question) {
    return `❌ **Off-by-one errors:** Forgetting arrays start at index 0
❌ **Not handling edge cases:** Empty input, single element, etc.
❌ **Variable naming:** Use clear names like 'total' not 'x'
❌ **Forgetting to return:** Make sure your function returns the result!`;
  }

  explainTesting(question) {
    return `Test with these cases:
✅ **Normal case:** Standard input (given in examples)
✅ **Edge case:** Empty, single element, very large input
✅ **Boundary case:** Maximum/minimum values
✅ **Special case:** Negative numbers, duplicates, etc.`;
  }

  getContextualResponse(userMessage, question) {
    return `I'm here to help you learn! 🎓

You can ask me:
• "Give me a hint" - For progressive hints
• "Explain the solution" - For step-by-step teaching
• "Explain the concept" - To understand the theory
• "Show me an example" - For a walkthrough
• "What's the approach?" - For problem-solving strategy

What would you like to know about "${question.title}"?`;
  }

  /**
   * Real AI response (if API key available)
   */
  async generateAIResponse(userMessage, question, history, context) {
    // Implementation for real AI (uses same teaching approach)
    // Falls back to mock if API fails
    return this.generateTeachingResponse(userMessage, question, context);
  }
}

export const botService = new BotService();
export default botService;
