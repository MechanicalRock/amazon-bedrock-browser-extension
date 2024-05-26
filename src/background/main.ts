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
import { sendMessage, onMessage } from 'webext-bridge/background';
import browser from 'webextension-polyfill';
import { getCurrentTabId } from '../util';
import { AwsOptions, ExtensionOptions, LOCKR_PREFIX } from '~/constants';

// @ts-ignore only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client');
  // load latest content script
  import('./contentScriptHMR');
}

const local = {
  get: async (key: string, defaultValue: string): Promise<string> => {
    const prefixedKey = `${LOCKR_PREFIX}${key}`;
    const storage = await browser.storage.local.get(prefixedKey);
    if (prefixedKey in storage) {
      return (storage[key] ?? defaultValue) as string;
    }

    return defaultValue;
  },
};

// TODO not currently working because of credentials being stored in the popup
browser.runtime.onInstalled.addListener((): void => {
  console.info('Extension installed');
  /**
   * Translate selection in a popup using right-click menu
   */
  // browser.contextMenus.create({
  //   title: 'Translate selection',
  //   contexts: ['selection'],
  //   id: 'translate-selection',
  // });
});

let previousTabId = 0;

/**
 * Listens for keyboard keypress events and looks for the combination of cmd+alt+t for Mac systems
 * and ctrl+alt+t for Windows systems.
 */
browser.commands.onCommand.addListener(command => {
  void (async () => {
    if (command === 'translate') {
      console.info('Hotkey has triggered a translation.');
      const tabId = await getCurrentTabId();

      const message = {
        creds: {
          region: await local.get(AwsOptions.AWS_REGION, ''),
          credentials: {
            accessKeyId: await local.get(AwsOptions.AWS_ACCESS_KEY_ID, ''),
            secretAccessKey: await local.get(AwsOptions.AWS_SECRET_ACCESS_KEY, ''),
          },
        },
        langs: {
          source: await local.get(ExtensionOptions.DEFAULT_SOURCE_LANG, 'auto'),
          target: await local.get(ExtensionOptions.DEFAULT_TARGET_LANG, 'en'),
        },
        tabId,
        cachingEnabled: (await local.get(ExtensionOptions.CACHING_ENABLED, 'false')) === 'true',
        bedrockEnabled: (await local.get(ExtensionOptions.BEDROCK_ENABLED, 'false')) === 'true',
      };

      void sendMessage('translate', message, 'content-script@' + tabId);
    }
  })();
});
// document.addEventListener('keydown', (event) => {
//   // If cmd+alt+t is being held (Mac)
//   if (event.metaKey && event.altKey && event.key === 't') {
//     console.log('Holding CMD+ALT+T !!!!');
//   }
//   // If cmd+alt+t is being held (Non-Mac)
//   if (event.ctrlKey && event.altKey && event.key === 't') {
//     console.log('Holding CTRL+ALT+T !!!!');
//   }
// });

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
browser.tabs.onActivated.addListener(({ tabId }) => {
  console.debug('tab activated', tabId, previousTabId);
  if (!previousTabId) {
    previousTabId = tabId;
    return;
  }

  getTabId(previousTabId)
    .then(tab => {
      previousTabId = tabId;
      console.info('previous tab', tab);
      void sendMessage('tab-prev', { title: tab.title }, 'content-script@' + tabId);
    })
    .catch(() => {
      return;
    });
});

const getTabId = async (previousTabId: number): Promise<browser.Tabs.Tab> => {
  return browser.tabs.get(previousTabId);
};

onMessage('get-current-tab', async () => {
  try {
    const tab = await getTabId(previousTabId);
    return {
      title: `${tab?.id ?? ''}`,
    };
  } catch {
    return {
      title: '',
    };
  }
});
