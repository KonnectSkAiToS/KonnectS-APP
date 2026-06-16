import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  let ai: GoogleGenAI | null = null;
  const getAI = () => {
    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Gemini API key not configured. Please select your API key in the Settings > Secrets panel.");
      }
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return ai;
  };

  // API routes
  app.get("/sw.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.status(200).send(`
      const CACHE_NAME = 'konnects-offline-cache-v1';
      const STATIC_FILES = [
        '/',
        '/index.html',
        '/src/main.tsx',
        '/src/index.css'
      ];

      self.addEventListener('install', (event) => {
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_FILES).catch(e => {
              console.warn('Pre-cache warning: ', e);
            });
          })
        );
        self.skipWaiting();
      });

      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys().then((keys) => {
            return Promise.all(
              keys.map((k) => {
                if (k !== CACHE_NAME) {
                  return caches.delete(k);
                }
              })
            );
          })
        );
        self.clients.claim();
      });

      self.addEventListener('fetch', (event) => {
        if (event.request.method !== 'GET' && event.request.method !== 'POST') return;
        const url = new URL(event.request.url);

        const isOfflineApi = url.pathname.startsWith('/api/offline/');

        // Avoid caching external web sockets, firestore listeners, hot-module-reloader, EXCEPT our offline endpoints
        if (!url.origin.includes(self.location.hostname) || (url.pathname.includes('/api/') && !isOfflineApi)) {
          return;
        }

        // Intercept POST request and cache its JSON payload inside a virtual GET request
        if (event.request.method === 'POST' && isOfflineApi) {
          event.respondWith(
            event.request.clone().json().then((body) => {
              const response = new Response(JSON.stringify(body), {
                headers: { 'Content-Type': 'application/json' }
              });
              return caches.open(CACHE_NAME).then((cache) => {
                const getRequest = new Request(url.pathname, { method: 'GET' });
                cache.put(getRequest, response.clone());
                return response;
              });
            }).catch(() => {
              return fetch(event.request);
            })
          );
          return;
        }

        // Handle GET requests (including reading cache fallbacks for our offline API)
        event.respondWith(
          caches.match(event.request).then((cached) => {
            if (cached) {
              // Return cached response but refresh in the background when online
              fetch(event.request).then((networkRes) => {
                if (networkRes && networkRes.status === 200) {
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkRes);
                  });
                }
              }).catch(() => {});
              return cached;
            }

            return fetch(event.request).then((networkRes) => {
              if (networkRes && networkRes.status === 200) {
                const copy = networkRes.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, copy);
                });
              }
              return networkRes;
            }).catch(() => {
              // Return matching GET cache if offline
              if (isOfflineApi) {
                const getRequest = new Request(url.pathname, { method: 'GET' });
                return caches.match(getRequest);
              }
              return caches.match('/');
            });
          })
        );
      });
    `);
  });

  app.post("/api/gemini/generate-image", async (req, res) => {
    const { prompt, aspectRatio = "1:1" } = req.body;
    
    try {
      if (!process.env.GEMINI_API_KEY) {
        // Fallback premium placeholder image in case key is absent
        const fallbackUrl = `https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=600&q=80&sig=${Math.floor(Math.random() * 1000)}`;
        return res.json({ imageUrl: fallbackUrl });
      }

      const aiClient = getAI();
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      });

      let base64Image = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }

      if (base64Image) {
        res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
      } else {
        res.status(500).json({ error: "No image generated" });
      }
    } catch (error: any) {
      console.error("Gemini Image Gen Error, returning fallback:", error);
      const fallbackUrl = `https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=600&q=80&sig=${Math.floor(Math.random() * 1000)}`;
      res.json({ imageUrl: fallbackUrl });
    }
  });

  app.post("/api/gemini/ask", async (req, res) => {
    const { prompt, context } = req.body;
    try {
      if (!process.env.GEMINI_API_KEY) {
        const lowerPrompt = (prompt || '').toLowerCase();
        
        // Handle search routing requests fallback offline
        if (lowerPrompt.includes("exactly one of these lowercased words")) {
          if (/\b(ride|rides|car|cab|taxi|driver|uber|pickup|transport|van|journey)\b/.test(lowerPrompt)) {
            return res.json({ text: "rides" });
          } else if (/\b(market|marketplace|item|items|goods|product|products|buy|sell|store|shop|clothes|furniture|antique|vintage)\b/.test(lowerPrompt)) {
            return res.json({ text: "marketplace" });
          } else if (/\b(service|services|cleaner|expert|handyman|plumber|task|tutor|gardener|tasker|help)\b/.test(lowerPrompt)) {
            return res.json({ text: "services" });
          } else if (/\b(profile|settings|account|rewards|points|referral|me|username)\b/.test(lowerPrompt)) {
            return res.json({ text: "profile" });
          } else {
            return res.json({ text: "unknown" });
          }
        }

        // Standard user conversational offline help
        return res.json({
          text: `👋 Hello! I am KonnectS Assistant. (Offline Demo mode enabled)
          
I can help guide you around the app!
- To **hire service experts** (e.g., plumbers, decorators), navigate to the **Services** tab.
- To **find or list items** for sale/free, explore the **Marketplace** tab.
- To **arrange local ride sharing**, open the **Rides** tab.
- To manage listings and rewards, visit the **Profile** tab.

*Note: Please configure a GEMINI_API_KEY in the Settings > Secrets panel on the top-right of your workspace to enable full generative intelligence.*`
        });
      }

      const aiClient = getAI();
      const response = await aiClient.models.generateContent({
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
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Chat Error, returning fallback:", error);
      const lowerPrompt = (prompt || '').toLowerCase();
      if (lowerPrompt.includes("exactly one of these lowercased words")) {
        if (/\b(ride|rides|car|cab|taxi|driver|uber|pickup|transport|van|journey)\b/.test(lowerPrompt)) {
          return res.json({ text: "rides" });
        } else if (/\b(market|marketplace|item|items|goods|product|products|buy|sell|store|shop|clothes|furniture|antique|vintage)\b/.test(lowerPrompt)) {
          return res.json({ text: "marketplace" });
        } else if (/\b(service|services|cleaner|expert|handyman|plumber|task|tutor|gardener|tasker|help)\b/.test(lowerPrompt)) {
          return res.json({ text: "services" });
        } else if (/\b(profile|settings|account|rewards|points|referral|me|username)\b/.test(lowerPrompt)) {
          return res.json({ text: "profile" });
        } else {
          return res.json({ text: "unknown" });
        }
      }
      res.json({
        text: `I'm currently running in fallback guide mode. Let me know if I can guide you to Marketplace, Rides, Services, or Profile!`
      });
    }
  });

  app.post("/api/gemini/generate-tags-summary", async (req, res) => {
    const { title, description } = req.body;
    try {
      if (!process.env.GEMINI_API_KEY) {
        const words = `${title} ${description}`.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        const stopwords = new Set(["the", "and", "for", "with", "this", "that", "vintage", "retro", "local", "style", "item"]);
        const uniqueWords = Array.from(new Set(words.filter(w => !stopwords.has(w)))).slice(0, 5);
        return res.json({
          tags: uniqueWords.length > 0 ? uniqueWords : ["furniture", "vintage", "lifestyle"],
          summary: `${title || 'Special selection'} in excellent local condition.`
        });
      }

      const aiClient = getAI();
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Generate 4-5 descriptive tagging keywords and an engaging, professional 1-sentence summary for this marketplace product.
Title: ${title}
Description: ${description}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 4 to 5 descriptive single-word or dual-word tags."
              },
              summary: {
                type: Type.STRING,
                description: "Concise 1-sentence highlights summary."
              }
            },
            required: ["tags", "summary"]
          }
        }
      });
      const rawText = response.text || "{}";
      res.json(JSON.parse(rawText.trim()));
    } catch (error: any) {
      console.error("Gemini Tags/Summary Error, returning fallback:", error);
      const words = `${title} ${description}`.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      const stopwords = new Set(["the", "and", "for", "with", "this", "that", "vintage", "retro", "local", "style", "item"]);
      const uniqueWords = Array.from(new Set(words.filter(w => !stopwords.has(w)))).slice(0, 5);
      res.json({
        tags: uniqueWords.length > 0 ? uniqueWords : ["furniture", "vintage", "decor"],
        summary: `${title || 'Premium item'} in fantastic pre-loved shape.`
      });
    }
  });

  app.post("/api/gemini/recommend-services", async (req, res) => {
    const { history = [], location } = req.body;
    const lat = location?.lat || 51.5260;
    const lng = location?.lng || -0.0780;
    const locationName = location?.name || "Shoreditch, London";

    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          recommendations: [
            {
              serviceName: "Skilled Electrical Safety Check",
              reason: "Based on your vicinity to East London's historical properties in Hoxton, an electrical safety inspection is recommended.",
              category: "trades",
              proName: "Marcus Vance",
              estimatedPrice: 45,
              urgency: "medium"
            },
            {
              serviceName: "AI Software Consulting",
              reason: "Since you are in key London tech zones, optimize your projects with professional AI expertise.",
              category: "technology",
              proName: "Liam Sterling",
              estimatedPrice: 120,
              urgency: "low"
            },
            {
              serviceName: "General Wellness Consultation",
              reason: "Stay healthy and fit. Schedule a regular checkup with our local health specialist.",
              category: "healthcare",
              proName: "Dr. Evelyn Carter",
              estimatedPrice: 85,
              urgency: "medium"
            }
          ]
        });
      }

      const aiClient = getAI();
      const prompt = `Based on the user's past booking history and their current location, recommend 3 highly contextual services. Encourage them to try some of our pre-seeded professionals.
User Current Location: Name: ${locationName}, Latitude: ${lat}, Longitude: ${lng}.
User Past Booking History: ${JSON.stringify(history)}.

Pre-seeded professionals available:
1. Dr. Evelyn Carter (Physician, Healthcare, Rate: £85/hr, near Shoreditch)
2. Liam Sterling (AI Engineer, Technology, Rate: £120/hr, near Hoxton)
3. Marcus Vance (Electrician, Skilled Trades, Rate: £45/hr, near Bethnal Green)
4. Chef Gordon K. (Chef, Agriculture & Food, Rate: £75/hr, Spitalfields)
5. Samantha Cole (Cybersecurity Analyst, Technology, Rate: £110/hr, Clerkenwell)
6. Mark Gable (Plumber, Skilled Trades, Rate: £50/hr, Hackney)

Return an array of 3 specific recommendations. Define the schema correctly.`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    serviceName: { type: Type.STRING },
                    reason: { type: Type.STRING, description: "A detailed explanation of why this service is being suggested." },
                    category: { type: Type.STRING, description: "One of the category keys, e.g., 'healthcare', 'technology', 'trades', 'business', 'agriculture'." },
                    proName: { type: Type.STRING, description: "Name of the recommended professional (if matched, or a general description)." },
                    estimatedPrice: { type: Type.NUMBER },
                    urgency: { type: Type.STRING }
                  },
                  required: ["serviceName", "reason", "category", "proName", "estimatedPrice", "urgency"]
                }
              }
            },
            required: ["recommendations"]
          }
        }
      });

      const text = response.text || "{}";
      res.json(JSON.parse(text.trim()));
    } catch (err) {
      console.error("Gemini Recommendations Error, returning fallback:", err);
      res.json({
        recommendations: [
          {
            serviceName: "Skilled Electrical Safety Check",
            reason: "An electrical check is perfect for safety when living near Hackney or Bethnal Green.",
            category: "trades",
            proName: "Marcus Vance",
            estimatedPrice: 45,
            urgency: "medium"
          },
          {
            serviceName: "Digital Infrastructure Inspection",
            reason: "Keep your system secured and well-tuned in the Tech City area with professional diagnostics.",
            category: "technology",
            proName: "Liam Sterling",
            estimatedPrice: 120,
            urgency: "low"
          }
        ]
      });
    }
  });

  app.post("/api/gemini/summarize", async (req, res) => {
    const { conversation } = req.body;
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.json({ summary: "• Summary unavailable offline. Please configure your GEMINI_API_KEY to enable AI-powered summaries." });
      }

      const aiClient = getAI();
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Please summarize the following long service-related or ride negotiation conversation into a short, concise, bullet-pointed list. Highlight any specific agreed-upon terms, prices, timings, locations, and next actionable steps:

        Conversation:
        ${JSON.stringify(conversation, null, 2)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: "A bulleted clean summary of the conversation."
              }
            },
            required: ["summary"]
          }
        }
      });

      let rawText = response.text || "{}";
      rawText = rawText.trim();
      try {
        const parsed = JSON.parse(rawText);
        res.json(parsed);
      } catch (err) {
        res.json({ summary: rawText });
      }
    } catch (error: any) {
      console.error("Gemini Summarization Error:", error);
      res.status(500).json({ error: "Failed to generate conversation summary." });
    }
  });

  app.post("/api/gemini/dispute", async (req, res) => {
    const { transaction, issue, claimantMessage, chatHistory = [] } = req.body;
    try {
      if (!process.env.GEMINI_API_KEY) {
        // Safe, smart fallback dispute recommendation
        let recommendedRefundPercentage = 50;
        let rationale = "Both parties reached an impasse over the completeness of the project. A standard 50/50 split is recommended to cover basic materials expense while honoring partial hours logged.";
        
        const lowerIssue = (issue || '').toLowerCase();
        if (lowerIssue.includes('damage') || lowerIssue.includes('break') || lowerIssue.includes('shatter')) {
          recommendedRefundPercentage = 85;
          rationale = "Claimant reports physical item or property damage. A high refund allocation (85%) is suggested to support immediate remediation before standard liability review.";
        } else if (lowerIssue.includes('late') || lowerIssue.includes('delay')) {
          recommendedRefundPercentage = 25;
          rationale = "Minor delay reported. A 25% courtesy refund split is recommended as a fair compromise for the inconvenience caused.";
        } else if (lowerIssue.includes('no show') || lowerIssue.includes('absent') || lowerIssue.includes('never came')) {
          recommendedRefundPercentage = 100;
          rationale = "Service provider failed to arrive at the designated time window. A full 100% refund is recommended under the KonnectS Superapp Buyer Protection Guarantees.";
        }

        const totalAmt = parseFloat(transaction?.amount || '100');
        return res.json({
          ticketId: `DISP-${Math.floor(100000 + Math.random() * 900000)}`,
          issueSummary: issue || "Provider/Client Contractual Dispute",
          confidenceScore: 0.88,
          recommendedSplit: {
            userRefundPercent: recommendedRefundPercentage,
            providerSharePercent: 100 - recommendedRefundPercentage,
            userRefundAmount: parseFloat((totalAmt * (recommendedRefundPercentage / 100)).toFixed(2)),
            providerShareAmount: parseFloat((totalAmt * ((100 - recommendedRefundPercentage) / 100)).toFixed(2))
          },
          aiAnalysisRationale: `${rationale} (Analyzed via KonnectS Off-Grid Triage Engine).`,
          suggestedProtocol: "AI-Mediated Fast Settlement Offer"
        });
      }

      const aiClient = getAI();
      const prompt = `You are a professional neutral AI Arbitrator/Moderator for the KonnectS Super App in the United Kingdom.
Your task is to analyze a dispute submitted by a user regarding a transaction/booking and recommend a fair, balanced, and automated refund split (in percentages totaling 100%) and a comprehensive, conflict-resolving rationale. This helps prevent human escalation.

Dispute / Transaction Parameters:
- Total Cost (amount): £${transaction?.amount || '100'}
- Category: ${transaction?.serviceType || 'Service / Product Purchase'}
- Service Date: ${transaction?.date || 'Recent'}
- Core Issue Listed: ${issue}
- Claimant Personal Statement: "${claimantMessage || 'Requesting mediation due to project quality dispute'}"
- Relevant Negotiation Chat Log History: ${JSON.stringify(chatHistory)}

Guidelines:
- Act objectively. Balance interests: service providers deserve pay for valid hours worked or templates created, while consumers deserve full protection if severe defects or absenteeism are evident.
- Provide a clear, polite, and persuasive UK legally-grounded or superapp buyer guarantee based rationale.
- Define a refund split percentage for the User (0% to 100%). The provider automatically receives the remaining.
- Render your response strictly following the JSON Schema requested.`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ticketId: { type: Type.STRING },
              issueSummary: { type: Type.STRING },
              confidenceScore: { type: Type.NUMBER },
              recommendedSplit: {
                type: Type.OBJECT,
                properties: {
                  userRefundPercent: { type: Type.NUMBER, description: "Percentage of the original amount to refund to the buyer." },
                  providerSharePercent: { type: Type.NUMBER, description: "Remaining percentage to disburse to the service provider." },
                  userRefundAmount: { type: Type.NUMBER },
                  providerShareAmount: { type: Type.NUMBER }
                },
                required: ["userRefundPercent", "providerSharePercent", "userRefundAmount", "providerShareAmount"]
              },
              aiAnalysisRationale: { type: Type.STRING, description: "Detailed summary explaining the recommendation fairly." },
              suggestedProtocol: { type: Type.STRING, description: "Actionable resolution protocol path, e.g. 'Fast Settlement Offer' or 'Escalation to High-Claim Ombudsman'." }
            },
            required: ["ticketId", "issueSummary", "confidenceScore", "recommendedSplit", "aiAnalysisRationale", "suggestedProtocol"]
          }
        }
      });

      const parsedRes = JSON.parse((response.text || "{}").trim());
      res.json(parsedRes);
    } catch (error: any) {
      console.error("Gemini Dispute Arbitration Error:", error);
      res.status(500).json({ error: "Dispute arbitration engine failed." });
    }
  });

  app.post("/api/gemini/smart-reschedule", async (req, res) => {
    const { bookings, location } = req.body;
    try {
      if (!process.env.GEMINI_API_KEY) {
        // Fallback mockup suggestions for offline/unconfigured key stability
        const fallback = bookings.map((b: any) => ({
          bookingId: b.id || 'b-mock',
          serviceType: b.serviceType || 'Service',
          options: [
            {
              proposedDate: new Date(Date.now() + 86400000 * 1).toISOString(),
              displayTime: "Tomorrow afternoon @ 2:00 PM",
              trafficStatus: "Light Traffic (Flowing)",
              availability: "Practitioner Available",
              reason: `Optimized to avoid midday logistics congestion in ${location || 'London'}. Saving up to 15 mins of transit carbon.`
            },
            {
              proposedDate: new Date(Date.now() + 86400000 * 2).toISOString(),
              displayTime: "In 2 Days morning @ 10:00 AM",
              trafficStatus: "Moderate Congestion",
              availability: "Highly Active Practitioner",
              reason: "Fits inside the open schedule buffer. 5-star pro is in close geographic proximity."
            }
          ]
        }));
        return res.json({ suggestions: fallback, offline: true });
      }

      const aiClient = getAI();
      const prompt = `You are an AI-powered Smart Rescheduler for London's all-in-one super service app KonnectS.
Your goal is to suggest more optimal rescheduled times for the user's pending service bookings.
Consider current local traffic (e.g. typical London congestion, roadworks, or peak commuter hours) and worker availability in the borough of "${location || 'London'}".

Pending bookings data to reschedule:
${JSON.stringify(bookings, null, 2)}

Provide exactly two or three smart suggested times for each booking with clear justifications. Make sure dates are formatted as ISO string dates.

Return the response in the specified JSON schema format.`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    bookingId: { type: Type.STRING },
                    serviceType: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          proposedDate: { type: Type.STRING },
                          displayTime: { type: Type.STRING },
                          trafficStatus: { type: Type.STRING },
                          availability: { type: Type.STRING },
                          reason: { type: Type.STRING }
                        },
                        required: ["proposedDate", "displayTime", "trafficStatus", "availability", "reason"]
                      }
                    }
                  },
                  required: ["bookingId", "serviceType", "options"]
                }
              }
            },
            required: ["suggestions"]
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (e: any) {
      console.error("Smart Reschedule error:", e);
      res.status(500).json({ error: "Failed to generate rescheduling recommendations." });
    }
  });

  // Offline caching API endpoints
  let offlineProfile: any = null;
  let offlineRides: any = [];

  app.post("/api/offline/profile", (req, res) => {
    offlineProfile = req.body;
    res.json({ success: true, message: "Profile data synchronized offline" });
  });

  app.get("/api/offline/profile", (req, res) => {
    if (offlineProfile) {
      res.json(offlineProfile);
    } else {
      res.status(404).json({ error: "No cached profile available offline yet" });
    }
  });

  app.post("/api/offline/rides", (req, res) => {
    offlineRides = req.body;
    res.json({ success: true, message: "Ride history synchronized offline" });
  });

  app.get("/api/offline/rides", (req, res) => {
    res.json(offlineRides);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
