/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function askAI(prompt: string, context?: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: `You are KonnectS AI, the helpful assistant for the UK's super app "KonnectS". 
            KonnectS is an all-in-one app for buying/selling, booking services (plumbers, doctors), ride-sharing, and community help.
            Current UK Context: You are talking to someone in the United Kingdom.
            App Features:
            - Marketplace: Buy/sell/free items.
            - Services: Immediate help (plumber, electrician, etc.).
            - Rides: Offer/book rides.
            - Fetch: Someone can fetch forgotten items.
            - Charity: Donations.
            
            Context about the current screen or user: ${context || 'Main dashboard'}
            
            Question: ${prompt}` }
          ]
        }
      ]
    });
    return response.text;
  } catch (error) {
    console.error("Gemini AI failed:", error);
    return "I'm sorry, I'm having trouble connecting to my brain right now. How can I help you manually?";
  }
}
