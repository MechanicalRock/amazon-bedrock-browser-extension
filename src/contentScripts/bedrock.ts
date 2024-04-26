import { InvokeModelCommand, InvokeModelCommandInput } from '@aws-sdk/client-bedrock-runtime';

export function BedrockTextCommand(
  Text: string,
  TargetLanguageCode: string
): Promise<InvokeModelCommand> {
  const MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0';

  const params: InvokeModelCommandInput = {
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      temperature: 0.2,
      top_k: 250,
      top_p: 1,
      system:
        'You are a highly skilled translator with expertise in many languages. Your task is to identify the language of the text I provide and accurately translate it into the specified target language while preserving the meaning, tone, and nuance of the original text. Please maintain proper grammar, spelling, and punctuation in the translated version.',
      messages: [
        {
          role: 'user',

          content: [
            {
              type: 'text',
              text: `${Text} --> ${TargetLanguageCode}`,
            },
          ],
        },
      ],
    }),
  };
  return new InvokeModelCommand(params);
}
