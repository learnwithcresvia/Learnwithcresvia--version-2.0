// services/jdoodleService.js
// Alternative to Judge0 - Uses JDoodle API
// Free tier: 200 requests/day
// Sign up: https://www.jdoodle.com/compiler-api

const JDOODLE_CLIENT_ID = import.meta.env.VITE_JDOODLE_CLIENT_ID;
const JDOODLE_CLIENT_SECRET = import.meta.env.VITE_JDOODLE_CLIENT_SECRET;
const JDOODLE_API_URL = 'https://api.jdoodle.com/v1/execute';

// Language versions for JDoodle
export const JDOODLE_LANGUAGES = {
  python: { language: 'python3', versionIndex: '4' },
  javascript: { language: 'nodejs', versionIndex: '4' },
  cpp: { language: 'cpp17', versionIndex: '0' },
  java: { language: 'java', versionIndex: '4' },
  c: { language: 'c', versionIndex: '5' },
};

class JDoodleService {
  constructor() {
    this.apiUrl = JDOODLE_API_URL;
    this.clientId = JDOODLE_CLIENT_ID;
    this.clientSecret = JDOODLE_CLIENT_SECRET;
    
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ JDoodle credentials not configured');
    }
  }

  /**
   * Execute code using JDoodle
   */
  async executeCode(code, language = 'python', stdin = '') {
    try {
      const langConfig = JDOODLE_LANGUAGES[language.toLowerCase()];
      
      if (!langConfig) {
        throw new Error(`Unsupported language: ${language}`);
      }

      console.log('🔵 Executing code with JDoodle...');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: this.clientId,
          clientSecret: this.clientSecret,
          script: code,
          language: langConfig.language,
          versionIndex: langConfig.versionIndex,
          stdin: stdin,
        }),
      });

      if (!response.ok) {
        throw new Error(`JDoodle API error: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('🟢 Execution complete');
      
      return this.formatResult(data);
    } catch (error) {
      console.error('Error executing code:', error);
      throw error;
    }
  }

  /**
   * Run code against test cases
   */
  async runTestCases(code, language, testCases) {
    try {
      console.log(`🔵 Running ${testCases.length} test cases...`);
      
      const results = [];
      
      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`Testing case ${i + 1}/${testCases.length}`);
        
        try {
          const result = await this.executeCode(
            code,
            language,
            testCase.input || ''
          );
          
          const actualOutput = (result.stdout || '').trim();
          const expectedOutput = (testCase.output || '').trim();
          const passed = actualOutput === expectedOutput;
          
          results.push({
            testCase: i + 1,
            input: testCase.input,
            expectedOutput: expectedOutput,
            actualOutput: actualOutput,
            passed: passed,
            status: result.status,
            memory: result.memory,
            cpuTime: result.cpuTime,
          });
          
          console.log(`${passed ? '✅' : '❌'} Test ${i + 1}`);
          
        } catch (error) {
          results.push({
            testCase: i + 1,
            input: testCase.input,
            expectedOutput: testCase.output,
            actualOutput: null,
            passed: false,
            error: error.message,
            status: 'ERROR',
          });
        }
      }
      
      const passedCount = results.filter(r => r.passed).length;
      const totalCount = results.length;
      
      return {
        results,
        passedCount,
        totalCount,
        allPassed: passedCount === totalCount,
        percentage: (passedCount / totalCount) * 100,
      };
      
    } catch (error) {
      console.error('Error running test cases:', error);
      throw error;
    }
  }

  /**
   * Format JDoodle result
   */
  formatResult(data) {
    let status = 'PASSED';
    let message = 'Success';
    
    if (data.statusCode === 200) {
      status = 'PASSED';
    } else if (data.statusCode === 400) {
      status = 'ERROR';
      message = 'Compilation Error';
    } else {
      status = 'ERROR';
      message = data.error || 'Execution Error';
    }
    
    return {
      status,
      message,
      stdout: data.output || '',
      stderr: data.error || '',
      memory: data.memory,
      cpuTime: data.cpuTime,
    };
  }

  /**
   * Check credit usage
   */
  async getCredits() {
    try {
      const response = await fetch('https://api.jdoodle.com/v1/credit-spent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: this.clientId,
          clientSecret: this.clientSecret,
        }),
      });

      const data = await response.json();
      return data.used; // Returns number of credits used today
    } catch (error) {
      console.error('Error checking credits:', error);
      return null;
    }
  }
}

// Export singleton
export const jdoodleService = new JDoodleService();

export default jdoodleService;

// Add to .env:
// VITE_JDOODLE_CLIENT_ID=your_client_id
// VITE_JDOODLE_CLIENT_SECRET=your_client_secret
// Get free account: https://www.jdoodle.com/compiler-api
