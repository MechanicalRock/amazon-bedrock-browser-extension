/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License").
You may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { PageMap, TranslateCommandData } from '~/_contracts';
import {
  crawl,
  swapText,
  sendDocumentsToTranslate_V2,
  updatePageMapWithItemsFromCache,
} from './functions';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { TranslateClient } from '@aws-sdk/client-translate';

/**
 * Kicks off logic for translating the webpage from the provided starting element by
 * crawling all children recursively, passing the text to the Amazon Translate API, and
 * then swapping the original text with the translated text.
 */
export async function startTranslation(
  data: TranslateCommandData,
  startingEl: HTMLElement | null
): Promise<void> {
  if (startingEl) {
    // Crawl the DOM from the starting element and get the text pages and node map
    const { pageMap, nodeMap } = crawl(startingEl);
    console.log('crawl pageMap is: ', pageMap);

    // Check if a cached translation exists for the current page
    if (pageMap.length > 0) {
      const updatedPageMap = updatePageMapWithItemsFromCache(
        window.location.href,
        data.langs.source,
        data.langs.target,
        pageMap
      );

      const itemsToBeTranslated = updatedPageMap.filter(item => !item.translatedText);

      console.log('number of items to be translated:', itemsToBeTranslated.length);
      if (itemsToBeTranslated.length > 0) {
        await translateFromApi(data, itemsToBeTranslated);
      }

      const updatedPageMapAfterTranslation = updatePageMapWithItemsFromCache(
        window.location.href,
        data.langs.source,
        data.langs.target,
        pageMap
      );

      updatedPageMapAfterTranslation.forEach(item =>
        item.translatedText ? swapText(nodeMap, item.id, item.translatedText) : undefined
      );
    }
  } else {
    throw new Error('Amazon Translate Error: The top level tag does not exist on the document.');
  }
}

/**
 * Logic flow to translate the crawled webpage into the target language from the Translate API.
 * If caching is enabled, the result will be cached to localStorage.
 */
async function translateFromApi(
  { creds, langs, bedrockEnabled }: TranslateCommandData,
  pageMap: PageMap[]
) {
  // TODO CREATE THE CLIENT ONLY ONCE to help with performance

  console.debug('Using Bedrock:', bedrockEnabled);
  const client = bedrockEnabled ? new BedrockRuntimeClient(creds) : new TranslateClient(creds);

  await sendDocumentsToTranslate_V2(client, bedrockEnabled, langs.source, langs.target, pageMap);

  // TODO: store the cache in reverse order too

  //   /**
  //    * Caching the text map on the reverse order to avoid an extra api call.
  //    * If the initial request is from English -> German it will cached along with German -> English
  //    */
  //   const textMapReverse = makeCacheTextMap(translatedPageMap, pageMap);
  //   cacheTranslation(window.location.href, langs.target, tDocs.sourceLanguage, textMapReverse);
}
