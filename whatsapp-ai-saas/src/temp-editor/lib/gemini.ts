import { GoogleGenAI } from '@google/genai';

export async function describeImageWithGemini(base64Data: string, mimeType: string): Promise<{ title: string, description: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    const base64String = base64Data.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64String,
              mimeType: mimeType,
            },
          },
          {
            text: 'Provide a short title and a detailed description for this image. Return a JSON object with "title" and "description" string properties.',
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    
    throw new Error('No text returned from the AI.');
  } catch (error) {
    console.error('Error calling Gemini API for description:', error);
    throw error;
  }
}
export async function editImageWithGemini(base64Data: string, mimeType: string, prompt: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    
    // Extract just the base64 string without the data URL prefix
    const base64String = base64Data.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64String,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    // Find the image part in the response
    if (response.candidates?.[0]?.content?.parts) {
      let textResponse = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
        if (part.text) {
          textResponse += part.text;
        }
      }
      if (textResponse) {
        throw new Error(`AI responded with text instead of an image: ${textResponse}`);
      }
    }
    
    throw new Error('No image or text returned from the AI.');
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}
