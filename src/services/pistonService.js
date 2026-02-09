// services/pistonService.js
// Alternative to Judge0 - Uses Piston API (FREE)
// API: https://github.com/engineer-man/piston

const PISTON_API_URL = 'https://emkc.org/api/v2/piston';

// Language versions supported by Piston
export const PISTON_LANGUAGES = {
  python: { language: 'python', version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  cpp: { language: 'c++', version: '10.2.0' },
  java: { language: 'java', version: '15.0.2' },
  c: { language: 'c', version: '10.2.0' },
};

class PistonService {
  constructor() {
    this.apiUrl = PISTON_API_URL;
  }

  /**
   * Execute code using Piston
   */
  async executeCode(code, language = 'python', stdin = '') {
    try {
      const langConfig = PISTON_LANGUAGES[language.toLowerCase()];
      
      if (!langConfig) {
        throw new Error(`Unsupported language: ${language}`);
      }

      console.log('🔵 Executing code with Piston...');

      const response = await fetch(`${this.apiUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: langConfig.language,
          version: langConfig.version,
          files: [
            {
              name: `main.${this.getFileExtension(language)}`,
              content: code,
            },
          ],
          stdin: stdin,
          compile_timeout: 10000, // 10 seconds
          run_timeout: 3000, // 3 seconds
          compile_memory_limit: -1,
          run_memory_limit: -1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Piston API error: ${response.status}`);
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
   * Run code against multiple test cases
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
            stderr: result.stderr,
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
            status: 'ERROR',
          });
          
          console.log(`❌ Test ${i + 1}: ERROR`);
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
   * Format Piston result to match Judge0 format
   */
  formatResult(data) {
    let status = 'PASSED';
    let message = 'Success';
    
    if (data.compile && data.compile.code !== 0) {
      status = 'ERROR';
      message = 'Compilation Error';
    } else if (data.run.code !== 0) {
      if (data.run.signal === 'SIGTERM') {
        status = 'TIMEOUT';
        message = 'Time Limit Exceeded';
      } else {
        status = 'ERROR';
        message = 'Runtime Error';
      }
    }
    
    return {
      status,
      message,
      stdout: data.run.stdout || '',
      stderr: data.run.stderr || data.compile?.stderr || '',
      compile_output: data.compile?.output || null,
      exitCode: data.run.code,
    };
  }

  /**
   * Get file extension for language
   */
  getFileExtension(language) {
    const extensions = {
      python: 'py',
      javascript: 'js',
      cpp: 'cpp',
      java: 'java',
      c: 'c',
    };
    return extensions[language.toLowerCase()] || 'txt';
  }

  /**
   * Get supported languages
   */
  async getRuntimes() {
    try {
      const response = await fetch(`${this.apiUrl}/runtimes`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching runtimes:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pistonService = new PistonService();

export default pistonService;
