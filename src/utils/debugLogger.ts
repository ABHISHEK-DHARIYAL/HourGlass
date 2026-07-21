/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function logDebug(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  const timestamp = new Date().toISOString();
  const consoleMsg = `[CLIENT_DEBUG] ${message}`;
  
  // Log to client console
  if (level === 'ERROR') {
    console.error(consoleMsg);
  } else if (level === 'WARN') {
    console.warn(consoleMsg);
  } else {
    console.log(consoleMsg);
  }

  // Send to backend endpoint asynchronously
  fetch('/api/debug-log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      level,
      timestamp
    })
  }).catch((err) => {
    // Fail silently on network errors so we don't disrupt app execution
  });
}
