import { Configuration, OpenAIApi } from 'openai';
import { useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { useSettings } from '../store/settings';

const useOpenAPI = () => {
  const { settings } = useSettings();
  const openAIRef = useRef<OpenAIApi>();

  useEffect(() => {
    const config = new Configuration({
      apiKey: settings?.apiKey,
    });

    openAIRef.current = new OpenAIApi(config);
  }, [settings?.apiKey]);

  return openAIRef;
};

const axiosOptionForOpenAI = (
  onData: (text: string, err?: any, end?: boolean) => void
) => ({
  responseType: 'stream' as ResponseType,
  onDownloadProgress: (e) => {
    try {
      const lines = e.currentTarget.response
        .toString()
        .split('\n')
        .filter((line) => line.trim() !== '');

      let result = '';

      for (const line of lines) {
        const message = line.replace(/^data: /, '');

        if (message === '[DONE]') {
          onData('', undefined, true);
          return; // Stream finished
        }

        const parsed = JSON.parse(message);

        const text =
          parsed.choices[0].text ||
          parsed.choices[0]?.delta?.content ||
          parsed.choices[0]?.message?.content;

        if (!text || !text.trim()) {
          continue;
        }

        result += text;
      }

      onData?.(result);
    } catch (e) {
      onData?.('', e);
    }
  },
});

export const useQueryOpenAIPrompt = () => {
  const openAI = useOpenAPI();
  const { settings } = useSettings();

  return async (
    prompt: string,
    onData?: (text: string, error?: Error, end?: boolean) => void
  ) => {
    const isChat = settings.model.includes('turbo');

    const commonOption = {
      max_tokens: 4000 - prompt.replace(/[\u4e00-\u9fa5]/g, 'aa').length,
      stream: true,
      model: settings.model,
    };

    if (isChat) {
      openAI?.current?.createChatCompletion(
        {
          ...commonOption,
          messages: [{ role: 'user', content: prompt }],
        },
        axiosOptionForOpenAI(onData) as any
      );
    } else {
      openAI?.current?.createCompletion(
        {
          ...commonOption,
          prompt: prompt,
        },
        axiosOptionForOpenAI(onData) as any
      );
    }
  };
};

export const useOpenAIEditPrompt = () => {
  const openAI = useOpenAPI();
  const { settings } = useSettings();

  return async (
    input: string,
    instruction: string,
    onData?: (text: string, error?: Error, end?: boolean) => void
  ) => {
    openAI.current.createEdit(
      {
        input,
        instruction,
        // max_tokens: 4000 - prompt.replace(/[\u4e00-\u9fa5]/g, 'aa').length,
        // stream: true,
        model: settings.model,
      },
      axiosOptionForOpenAI(onData) as any
    );
  };
};

export const useModels = () => {
  // const api = useOpenAPI();
  // return useSWR('models', async () => {
  //   return (await (await api?.current?.listModels()).data?.data) || [];
  // });

  return useMemo(() => {
    return [
      {
        id: 'gpt-3.5-turbo',
        description:
          'Most capable GPT-3.5 model and optimized for chat at 1/10th the cost of text-davinci-003. Will be updated with our latest model iteration.',
        price: '$0.002 / 1K tokens',
      },
      {
        id: 'text-davinci-003',
        description:
          'Can do any language task with better quality, longer output, and consistent instruction-following than the curie, babbage, or ada models. Also supports inserting completions within text.',
        price: '$0.02 / 1K tokens',
      },
    ];
  }, []);
};
