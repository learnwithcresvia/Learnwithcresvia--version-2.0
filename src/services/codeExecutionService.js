// services/codeExecutionService.js
// Unified service that can use Judge0, Piston, or JDoodle

import judge0Service from './judge0Service';
import pistonService from './pistonService';
import jdoodleService from './jdoodleService';

// Choose your execution engine
const EXECUTION_ENGINE = import.meta.env.VITE_CODE_EXECUTION_ENGINE || 'piston';
// Options: 'judge0', 'piston', 'jdoodle'

class CodeExecutionService {
  constructor() {
    this.engine = EXECUTION_ENGINE;
    this.service = this.getService();
    
    console.log(`🔧 Code Execution Engine: ${this.engine.toUpperCase()}`);
  }

  /**
   * Get the appropriate service based on configuration
   */
  getService() {
    switch (this.engine.toLowerCase()) {
      case 'judge0':
        return judge0Service;
      case 'jdoodle':
        return jdoodleService;
      case 'piston':
      default:
        return pistonService;
    }
  }

  /**
   * Execute code
   */
  async executeCode(code, language = 'python', stdin = '') {
    return await this.service.executeCode(code, language, stdin);
  }

  /**
   * Run test cases
   */
  async runTestCases(code, language, testCases) {
    return await this.service.runTestCases(code, language, testCases);
  }

  /**
   * Test single test case
   */
  async testCode(code, language, testCase) {
    const result = await this.service.runTestCases(code, language, [testCase]);
    return result.results[0];
  }

  /**
   * Get engine info
   */
  getEngineInfo() {
    return {
      engine: this.engine,
      provider: this.engine === 'judge0' ? 'Judge0' : 
                this.engine === 'piston' ? 'Piston (FREE)' : 
                'JDoodle',
      cost: this.engine === 'piston' ? 'Free & Unlimited' :
            this.engine === 'jdoodle' ? 'Free (200/day)' :
            'Varies',
    };
  }
}

// Export singleton
export const codeExecutionService = new CodeExecutionService();

export default codeExecutionService;

/*
========================================
SETUP INSTRUCTIONS:
========================================

Add to your .env file:

# Choose execution engine: 'piston', 'judge0', or 'jdoodle'
VITE_CODE_EXECUTION_ENGINE=piston

========================================
OPTION 1: PISTON (Recommended - FREE)
========================================
No setup needed! Just works out of the box.

Pros:
✅ Completely FREE
✅ No API key needed
✅ No rate limits
✅ Public API available

Cons:
❌ Slower than self-hosted
❌ Depends on external service

========================================
OPTION 2: JUDGE0 SELF-HOSTED (Best)
========================================
See JUDGE0-SELFHOSTED.md for setup

Pros:
✅ Completely FREE
✅ No limits
✅ Fastest
✅ Full control

Cons:
❌ Requires Docker
❌ Need to host it

========================================
OPTION 3: JDOODLE (Alternative)
========================================
Sign up: https://www.jdoodle.com/compiler-api

Add to .env:
VITE_CODE_EXECUTION_ENGINE=jdoodle
VITE_JDOODLE_CLIENT_ID=your_client_id
VITE_JDOODLE_CLIENT_SECRET=your_client_secret

Pros:
✅ Easy setup
✅ Free tier available (200/day)

Cons:
❌ Rate limited
❌ Requires registration
*/
