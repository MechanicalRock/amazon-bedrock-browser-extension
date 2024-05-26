/* eslint-disable no-console */

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

import { onMessage, sendMessage } from 'webext-bridge/content-script';
import { lockr } from '../modules';
import { createOverlay, destroyOverlay } from './functions';
import { startTranslation } from './translate';
import { TranslateClientConfig } from '@aws-sdk/client-translate';

import { AwsOptions, ExtensionOptions } from '~/constants';
import { TranslateCommandData } from '~/_contracts';

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
(() => {
  console.log('Content script loaded.');
  // Setup message handlers. These handlers receive messages from the popup window.
  translateHandler();
  showOverlayHandler();
  clearCacheHandler();
  tabPrevHandler();

  const startingElement = document.body;

  // Options for the observer (which mutations to observe)
  const config = { childList: true, subtree: true };

  // Callback function to execute when mutations are observed
  const callback = (mutationList: MutationRecord[]) => {
    for (const mutation of mutationList) {
      if (mutation.type === 'childList') {
        const currentTabId = lockr.get('tabId');

        let shouldCrawl = false;
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.textContent) {
            shouldCrawl = true;
          }
        }
        for (const removedNode of mutation.removedNodes) {
          if (removedNode.textContent) {
            shouldCrawl = true;
          }
        }

        // check if value for this tabId has been cached - aka if we should be translating that page
        // Only when the translate button is triggered once, we store the tab id in the cache and then we start translating

        if (currentTabId && shouldCrawl) {
          const credentials = {
            accessKeyId: lockr.get(AwsOptions.AWS_ACCESS_KEY_ID) ?? undefined,
            secretAccessKey: lockr.get(AwsOptions.AWS_SECRET_ACCESS_KEY) ?? undefined,
          };
          const config: TranslateClientConfig = {
            region: lockr.get(AwsOptions.AWS_REGION) ?? '',
            credentials,
          };

          const conf = {
            creds: config,
            langs: {
              source: lockr.get(ExtensionOptions.DEFAULT_SOURCE_LANG) ?? 'en',
              target: lockr.get(ExtensionOptions.DEFAULT_TARGET_LANG) ?? 'pl',
            },
            tabId: currentTabId,
            cachingEnabled: lockr.get(ExtensionOptions.CACHING_ENABLED) ?? false,
            bedrockEnabled: lockr.get(ExtensionOptions.BEDROCK_ENABLED) ?? false,
          };

          startTranslation(conf, startingElement)
            .then(() => {
              // Send a message to the popup indicating the translation has completed
              void sendMessage(
                'status',
                { status: 'complete', message: 'Translation complete.' },
                'popup'
              );
            })
            .catch(e => {
              console.error(e, startingElement);

              // Send a message to the popup indicating that an error occurred during translation
              void sendMessage(
                'status',
                {
                  status: 'error',
                  message: 'An error occurred. The document failed to translate.',
                },
                'content-script@' + currentTabId
              );
            });
        }
      }
    }
  };

  // Create an observer instance linked to the callback function
  const observer = new MutationObserver(callback);

  // Start observing the target node for configured mutations
  observer.observe(startingElement, config);
})();

/**
 * Show the "translating..." overlay
 */
function showOverlayHandler() {
  onMessage<any, 'show-overlay'>('show-overlay', () => {
    createOverlay();
  });
}

/**
 * Listen for messages from the popup window that contain the AWS creds and selected
 * languages for translation.
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function translateHandler() {
  onMessage<TranslateCommandData, 'translate'>(
    'translate',
    ({ sender: { context, tabId }, data }) => {
      createOverlay();

      const currentTabId = tabId || data.tabId;

      if (lockr.get('awsRegion') === undefined) {
        lockr.set(AwsOptions.AWS_REGION, data.creds.region);
        lockr.set(AwsOptions.AWS_ACCESS_KEY_ID, data.creds.credentials.accessKeyId);
        lockr.set(AwsOptions.AWS_SECRET_ACCESS_KEY, data.creds.credentials.secretAccessKey);
        lockr.set(ExtensionOptions.DEFAULT_SOURCE_LANG, data.langs.source);
        lockr.set(ExtensionOptions.DEFAULT_TARGET_LANG, data.langs.target);
        lockr.set(ExtensionOptions.CACHING_ENABLED, data.cachingEnabled);
        lockr.set(ExtensionOptions.BEDROCK_ENABLED, data.bedrockEnabled);
        lockr.set('tabId', currentTabId);
      }

      // Send a message informing the popup that the translation has started
      void sendMessage('status', { status: 'translating', message: '' }, 'popup');

      // Start the webpage translation process
      const startingEl = document.querySelector('body');

      // Using the Promise chaining API to appease the TS compiler because onMessage does not allow
      // async callbacks.
      startTranslation(data, startingEl)
        .then(() => {
          // Send a message to the popup indicating the translation has completed
          void sendMessage(
            'status',
            { status: 'complete', message: 'Translation complete.' },
            'popup'
          );
        })
        .catch(e => {
          console.error(e, startingEl);

          // Send a message to the popup indicating that an error occurred during translation
          void sendMessage(
            'status',
            { status: 'error', message: 'An error occurred. The document failed to translate.' },
            context + '@' + currentTabId
          );
        })
        .finally(() => {
          destroyOverlay();
        });
    }
  );
}

/**
 * Listen for messages from the popup window that instruct the contentScript to clear the
 * localStorage translation cache for the current page.
 */
function clearCacheHandler() {
  // Listen to requests to clear the current page's translation cache
  onMessage('clearCache', message => {
    const {
      sender,
      data: { tabId },
    } = message;
    console.info(`A message to clear cache for tab ${tabId} received`);
    lockr.rm(window.location.href);
    lockr.rm('tabId');
    void sendMessage(
      'status',
      { status: 'complete', message: 'Cleared cache for this page.' },
      sender.context + '@' + tabId
    );
  });
}

/**
 * This is a required message handler that must be registered for the extension to function.
 */
function tabPrevHandler() {
  onMessage('tab-prev', () => {
    console.log('Registering tab-prev');
  });
}
