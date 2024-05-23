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

import {
  // CacheTextMap,
  // PageMap,
  PageMap_V2,
  TranslateCommandData,
} from '~/_contracts';
import {
  // crawl,
  crawl_V2,
  // writePages,
  // bindPages,
  // pageIsValid,
  // breakDocuments,
  // makeCacheTextMap,
  swapText,
  getCache_V2,
  addOrRemoveNewObjectsFromTheCache,
  sendDocumentsToTranslate_V2,
  // splitPage,
  // sanitizePage,
  // createPageMap
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
    const { pageMap, nodeMap } = crawl_V2(startingEl);
    console.log('crawl pageMap is: ', pageMap);
    // Check if a cached translation exists for the current page
    if (pageMap.length > 0) {
      addOrRemoveNewObjectsFromTheCache(
        window.location.href,
        data.langs.source,
        data.langs.target,
        pageMap
      );

      const cache = getCache_V2(window.location.href, data.langs.source, data.langs.target);
      console.log('Content in the cache is:', cache);

      const itemsToBeTranslated = cache.filter(item => !item.translatedText);

      console.log('number of items to be translated:', itemsToBeTranslated.length);
      if (itemsToBeTranslated.length > 0) {
        await translateFromApi_V2(data, itemsToBeTranslated);
      }
      const cacheObjectsAfterTranslation = getCache_V2(
        window.location.href,
        data.langs.source,
        data.langs.target
      );
      console.log('cache objects after translation: ', cacheObjectsAfterTranslation);

      cacheObjectsAfterTranslation.forEach(item =>
        item.translatedText ? swapText(nodeMap, item.id, item.translatedText) : undefined
      );
    }
    // SHOUDL LOAD DATA FROM CACHE
  } else {
    throw new Error('Amazon Translate Error: The top level tag does not exist on the document.');
  }
}

/**
 * Logic flow to translate the crawled webpage into the target language from the local cache.
 */
// function translateFromCache(pageMap: PageMap, nodeMap: NodeMap, cache: CacheTextMap): void {
//   Object.entries(pageMap).forEach(([id, srcText]) => swapText(nodeMap, id, cache[srcText]));
// }

async function translateFromApi_V2(
  { creds, langs, bedrockEnabled }: TranslateCommandData,
  pageMap: PageMap_V2[]
) {
  // await translateMany(creds, bedrockEnabled, langs.source, langs.target, pageMap);
  // TODO CREATE THE CLIENT ONLY ONCE
  console.debug('Using Bedrock:', bedrockEnabled);
  const client = bedrockEnabled ? new BedrockRuntimeClient(creds) : new TranslateClient(creds);

  await sendDocumentsToTranslate_V2(client, bedrockEnabled, langs.source, langs.target, pageMap);

  // Apply the translated documents to the DOM
  // tDocs.forEach(doc =>
  //   doc.translatedText ? swapText(nodeMap, doc.id, doc.translatedText) : undefined
  // );
  // console.log("nodemap after is: ", nodeMap);
}

/**
 * Logic flow to translate the crawled webpage into the target language from the Translate API.
 * If caching is enabled, the result will be cached to localStorage.
 */
// async function translateFromApi(
//   { creds, langs, bedrockEnabled }: TranslateCommandData,
//   nodeMap: NodeMap,
//   pageMap: PageMap
// ) {
//   // If the page has not been previously translated and cached, get new translation and apply it

//   // Create translatable pages from the page map.
//   const writtenPages = writePages(pageMap);
//   console.log("writtenPages", writtenPages);

//   // Bind the pages into documents (chunks) that can be sent to Amazon Translate
//   const docs = bindPages(writtenPages);
//   console.log("docs before translation", docs);

//   // Translate the documents
//   const tDocs = await translateMany(creds, bedrockEnabled, langs.source, langs.target, docs);

//   console.log("docs after translation", tDocs);

//   // Break the translated documents back into pages
//   const tPagesRaw = breakDocuments(tDocs.translatedText);
//   console.log("tPagesRaw after translation", tPagesRaw);
//   // Sanitize the pages returned from Amazon Translate
//   const tPagesSanitized = tPagesRaw.map(page => sanitizePage(page));
//   console.log("tPagesSanitized after translation", tPagesSanitized);

//   // Break the pages into tuples of the node ID and the translated text
//   const translatedPageMap = createPageMap(tPagesSanitized);
//   console.log("translatedPageMap after translation", translatedPageMap);

//   // Make a cache text map for the selected language pair
//   const textMap = makeCacheTextMap(pageMap, translatedPageMap);
//   console.log("textMap after translation", textMap);

//   // Cache the translated text map
//   cacheTranslation(window.location.href, tDocs.sourceLanguage, langs.target, textMap);

//   const cache = getCache(window.location.href, langs.source, langs.target);
//   console.log("Content in the cache after translation is:", cache);

//   console.log("nodemap before is: ", nodeMap);
//   // Apply the translated documents to the DOM
//   tPagesSanitized.forEach(page =>
//     pageIsValid(page) ? swapText(nodeMap, ...splitPage(page)) : undefined
//   );
//   console.log("nodemap after is: ", nodeMap);
//   console.log("tPagesSanitized after swap", tPagesSanitized);

//   /**
//    * Caching the text map on the reverse order to avoid an extra api call.
//    * If the initial request is from English -> German it will cached along with German -> English
//    */
//   const textMapReverse = makeCacheTextMap(translatedPageMap, pageMap);
//   cacheTranslation(window.location.href, langs.target, tDocs.sourceLanguage, textMapReverse);
// }
