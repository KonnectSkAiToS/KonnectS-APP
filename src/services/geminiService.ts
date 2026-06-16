/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


export async function askAI(prompt: string, context?: string) {
  try {
    const response = await fetch('/api/gemini/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context })
    });
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to connect to AI');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Gemini AI failed:", error);
    return "I'm sorry, I'm having trouble connecting to my brain right now. How can I help you manually?";
  }
}
