require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'Say hello world'
    });
    console.log("Success:", response.text);
  } catch (error) {
    console.error("Gemini API Error details:", error);
  }
}

test();
