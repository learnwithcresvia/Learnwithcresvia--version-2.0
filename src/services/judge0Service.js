// services/judge0Service.js
// Integration with Judge0 API for secure code execution

const JUDGE0_API_URL = import.meta.env.VITE_JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = import.meta.env.VITE_JUDGE0_API_KEY;
const JUDGE0_HOST = import.meta.env.VITE_JUDGE0_HOST || 'judge0-ce.p.rapidapi.com';

// Language IDs for Judge0
export const LANGUAGE_IDS = {
  python: 71,      // Python 3.8.1
  javascript: 63,  // JavaScript (Node.js 12.14.0)
  cpp: 54,         // C++ (GCC 9.2.0)
  java: 62,        // Java (OpenJDK 13.0.1)
  c: 50,           // C (GCC 9.2.0)
};

// Status IDs from Judge0
const STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 7,
  RUNTIME_ERROR_SIGXFSZ: 8,
  RUNTIME_ERROR_SIGFPE: 9,
  RUNTIME_ERROR_SIGABRT: 10,
  RUNTIME_ERROR_NZEC: 11,
  RUNTIME_ERROR_OTHER: 12,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,
};

class Judge0Service {
  constructor() {
    this.apiUrl = JUDGE0_API_URL;
    this.apiKey = JUDGE0_API_KEY;
    this.host = JUDGE0_HOST;
    
    if (!this.apiKey) {
      console.warn('⚠️ Judge0 API key not configured. Code execution will not work.');
    }
  }

  /**
   * Submit code for execution
   */
  async submitCode(code, language = 'python', stdin = '', expectedOutput = null) {
    try {
      const languageId = LANGUAGE_IDS[language.toLowerCase()];
      
      if (!languageId) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const response = await fetch(`${this.apiUrl}/submissions?base64_encoded=true&wait=false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': this.host,
        },
        body: JSON.stringify({
          language_id: languageId,
          source_code: btoa(unescape(encodeURIComponent(code))), // Proper UTF-8 base64 encoding
          stdin: stdin ? btoa(unescape(encodeURIComponent(stdin))) : null,
          expected_output: expectedOutput ? btoa(unescape(encodeURIComponent(expectedOutput))) : null,
          cpu_time_limit: 2, // 2 seconds
          memory_limit: 128000, // 128 MB
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Judge0 API error: ${response.status}`);
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error submitting code:', error);
      throw error;
    }
  }

  /**
   * Get submission result
   */
  async getSubmission(token) {
    try {
      const response = await fetch(`${this.apiUrl}/submissions/${token}?base64_encoded=true&fields=*`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': this.host,
        },
      });

      if (!response.ok) {
        throw new Error(`Judge0 API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Decode base64 outputs safely
      return {
        ...data,
        stdout: data.stdout ? this.decodeBase64(data.stdout) : null,
        stderr: data.stderr ? this.decodeBase64(data.stderr) : null,
        compile_output: data.compile_output ? this.decodeBase64(data.compile_output) : null,
        message: data.message ? this.decodeBase64(data.message) : null,
      };
    } catch (error) {
      console.error('Error getting submission:', error);
      throw error;
    }
  }

  /**
   * Decode base64 with UTF-8 support
   */
  decodeBase64(str) {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch (e) {
      return atob(str); // Fallback to simple decode
    }
  }

  /**
   * Submit code and wait for result (with polling)
   */
  async executeCode(code, language = 'python', stdin = '', maxAttempts = 10) {
    try {
      console.log('🔵 Submitting code to Judge0...');
      
      const token = await this.submitCode(code, language, stdin);
      console.log('🔵 Submission token:', token);
      
      // Poll for result
      let attempts = 0;
      while (attempts < maxAttempts) {
        await this.sleep(1000); // Wait 1 second
        
        const result = await this.getSubmission(token);
        
        // Check if processing is complete
        if (result.status.id > 2) { // Not in queue or processing
          console.log('🟢 Execution complete:', result.status.description);
          return this.formatResult(result);
        }
        
        attempts++;
        console.log(`⏳ Attempt ${attempts}/${maxAttempts}: ${result.status.description}`);
      }
      
      throw new Error('Execution timeout - took too long');
    } catch (error) {
      console.error('🔴 Execution error:', error);
      throw error;
    }
  }

  /**
   * Run code against multiple test cases
   */
  async runTestCases(code, language, testCases) {
    try {
      console.log(`🔵 Running ${testCases.length} test cases...`);
      
      const results = [];
      
      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`Running test case ${i + 1}/${testCases.length}`);
        
        try {
          const result = await this.executeCode(
            code,
            language,
            testCase.input || ''
          );
          
          // Check if output matches expected
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
            time: result.time,
            memory: result.memory,
          });
          
          console.log(`${passed ? '✅' : '❌'} Test ${i + 1}: ${passed ? 'PASSED' : 'FAILED'}`);
          
        } catch (error) {
          results.push({
            testCase: i + 1,
            input: testCase.input,
            expectedOutput: testCase.output,
            actualOutput: null,
            passed: false,
            error: error.message,
            status: { description: 'Error' },
          });
          
          console.log(`❌ Test ${i + 1}: ERROR - ${error.message}`);
        }
      }
      
      const passedCount = results.filter(r => r.passed).length;
      const totalCount = results.length;
      const allPassed = passedCount === totalCount;
      
      console.log(`🏁 Results: ${passedCount}/${totalCount} passed`);
      
      return {
        results,
        passedCount,
        totalCount,
        allPassed,
        percentage: (passedCount / totalCount) * 100,
      };
      
    } catch (error) {
      console.error('Error running test cases:', error);
      throw error;
    }
  }

  /**
   * Format execution result
   */
  formatResult(result) {
    const statusId = result.status.id;
    
    let status = 'PASSED';
    let message = result.status.description;
    
    if (statusId === STATUS.ACCEPTED) {
      status = 'PASSED';
    } else if (statusId === STATUS.WRONG_ANSWER) {
      status = 'FAILED';
      message = 'Wrong Answer';
    } else if (statusId === STATUS.TIME_LIMIT_EXCEEDED) {
      status = 'TIMEOUT';
      message = 'Time Limit Exceeded';
    } else if (statusId === STATUS.COMPILATION_ERROR) {
      status = 'ERROR';
      message = 'Compilation Error';
    } else if (statusId >= 7 && statusId <= 12) {
      status = 'ERROR';
      message = 'Runtime Error';
    } else {
      status = 'ERROR';
    }
    
    return {
      status,
      message,
      stdout: result.stdout,
      stderr: result.stderr,
      compile_output: result.compile_output,
      time: result.time, // in seconds
      memory: result.memory, // in KB
      statusDetails: result.status,
    };
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const judge0Service = new Judge0Service();

export default judge0Service;
