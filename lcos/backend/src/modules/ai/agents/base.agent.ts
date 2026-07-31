export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;
  abstract instructions: string;

  protected async callLLM(prompt: string, systemPrompt: string, openai: any): Promise<string> {
    if (!openai) return 'AI agent unavailable - configure OPENAI_API_KEY';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
  }
}
