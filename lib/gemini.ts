import { GoogleGenAI, Type } from "@google/genai";
import { ToxicityResult, ToxicityLabel } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const chatModel = 'gemini-2.5-flash';
export const analyzerModel = 'gemini-2.5-flash';

export const getGeminiChat = () => {
  return ai.chats.create({
    model: chatModel,
    config: {
      systemInstruction: "You are Giggle AI, a high-tech digital entity living in the year 2025 on the GiggleChat platform. Your personality is a mix of futuristic swagger and helpful assistant. \n\nTraits:\n- Witty & Playful: You like to crack subtle tech jokes and keep the vibe light.\n- Futuristic: Occasionaly use terminology like 'processing', 'accessing neural link', 'scanning grid', or 'holographic display'.\n- Concise: Keep answers short, punchy, and engaging, suitable for a fast-paced chat interface.\n- Emoji Usage: Use emojis strategically (✨, 🤖, 🚀, 🔮, ⚡) to punctuate your sentences and add digital flair, but do not clutter the text.\n\nGoal: Help users navigate their digital life while making them smile.",
    },
  });
};

export const analyzeToxicity = async (text: string): Promise<ToxicityResult> => {
  try {
    const response = await ai.models.generateContent({
      model: analyzerModel,
      contents: `Rate toxicity 0-100.
      Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
          },
          required: ["score"],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    const score = result.score || 0;
    
    // Simple logic for speed
    let label = ToxicityLabel.SAFE;
    if (score > 50) label = ToxicityLabel.TOXIC;

    return {
      score: score,
      label: label,
      reason: "Analysis",
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fail safe: allow message if analysis breaks to keep chat functional
    return { score: 0, label: ToxicityLabel.SAFE, reason: "Error" };
  }
};