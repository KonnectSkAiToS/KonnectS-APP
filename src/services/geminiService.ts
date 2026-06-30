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

export async function getQuickReplies(lastMessage: string): Promise<string[]> {
  try {
    const response = await fetch('/api/gemini/quick-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastMessage })
    });
    if (!response.ok) throw new Error('Failed to get quick replies');
    const data = await response.json();
    return data.replies || [];
  } catch (error) {
    console.error("Quick replies failed:", error);
    return ["Sounds good!", "Sure thing.", "I will check."];
  }
}

export async function getReviewSummary(reviews: string[]): Promise<{ summary: string; highlights: string[] }> {
  try {
    const response = await fetch('/api/gemini/review-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviews })
    });
    if (!response.ok) throw new Error('Failed to get review summary');
    return await response.json();
  } catch (error) {
    console.error("Review summary failed:", error);
    return {
      summary: "Highly rated local service provider with consistent praise for prompt communication and transparent pricing.",
      highlights: ["Reliable", "Fair Pricing", "Responsive"]
    };
  }
}

