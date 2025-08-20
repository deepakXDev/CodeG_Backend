// utils/codeRunner.js
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

function executeCode(language, sourceFile, inputFile, outputFile, timeLimit, memoryLimit) {
  return new Promise((resolve) => {
    const ext = path.extname(sourceFile);

    const outputExt = process.platform === 'win32' ? '.exe' : '.out';
    const exeFile = sourceFile.replace(ext, outputExt);

    let compileCmd = null;
    if (language === 'cpp') {
      // Compilation step
      compileCmd = spawn('g++', [sourceFile, '-o', exeFile], {
        shell: true
      });

      compileCmd.on('close', (code) => {
        if (code !== 0) {
          return resolve({
            stdout: '',
            stderr: `Compilation failed with code ${code}`,
            code: 1,
          });
        }

        // Execution step
        const runCmd = process.platform === 'win32' ? exeFile : `./${path.basename(exeFile)}`;
        runExecutable(runCmd, inputFile, outputFile, timeLimit, resolve);
      });
    } else if (language === 'python') {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      runExecutable(pythonCmd, inputFile, outputFile, timeLimit, resolve, [sourceFile]); //python3->linux
    } else if (language === 'javascript') {
      runExecutable('node', inputFile, outputFile, timeLimit, resolve, [sourceFile]);
    } 
    //also java->javac Main.java && then java Main..to compile & run..
    else {
      return resolve({ stdout: '', stderr: 'Unsupported language', code: 1 });
    }
  });
}

function runExecutable(cmd, inputFile, outputFile, timeLimit, resolve, args = []) {
  const process = spawn(cmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    process.kill();
  }, timeLimit);

  const input = fs.readFileSync(inputFile);
  process.stdin.write(input);
  process.stdin.end();

  let stdout = '';
  let stderr = '';

  process.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  process.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  process.on('close', (code) => {
    clearTimeout(timeout);
    if (timedOut) {
      return resolve({ stdout: '', stderr: 'Time Limit Exceeded', code: -1 });
    }
    fs.writeFileSync(outputFile, stdout);
    resolve({ stdout, stderr, code });
  });
}

module.exports = executeCode;
