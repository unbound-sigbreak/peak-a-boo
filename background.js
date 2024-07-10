const __VERSION = 1;
import { interpolate } from "./interpolate.js";

const defaultOllamaApiUrl = 'http://localhost.:11434/api/generate';
const defaultOpenAiApiUrl = 'https://api.openai.com/v1/chat/completions';
const defaultLlmPrompt = `Please review this user's Reddit comments and provide a summary of their behavior: {$commentJsonData}`;
const defaultOllamaModel = "llama3";
const defaultOpenAiModel = "gpt-3.5-turbo-0125";
const defaultOllamPayloadObject = `{
  "model": "${defaultOllamaModel}",
  "prompt": "{$llmPrompt}",
  "stream": false
}`;

const defaultOpenAiPayloadObject = `{
  "model": "${defaultOpenAiModel}",
  "messages": [{"role": "user", "content": "{$llmPrompt}"}],
  "temperature": 0.7
}`;

const defaultOpanAiHeaders = [
  { key: 'Authorization', value: 'Bearer {$apiKey}' },
  { key: 'Content-Type', value: 'application/json' }
];

const defaultOpenAiResponsePath = 'choices[0].message.content';
const defaultOllamaResponsePath = 'response';

const defaultOllamaHeaders = [
  { key: 'Content-Type', value: 'application/json' }
];

const defaultCommentMapper = `{
  "c": "data.body",
  "subr": "data.subreddit",
  "upvotes": "data.ups",
  "threadtitle": "data.link_title",
  "issubmitter": "data.is_submitter"
}`;


chrome.runtime.onInstalled.addListener(() => {
  console.log('Reddit Peak-A-Boo installed');
  
  chrome.storage.sync.get(['initialised', 'version'], (result) => {
    if ((!result?.initialised ?? false) || Number.parseInt(result?.version ?? 0) < __VERSION) {
      if ((!result?.initialised ?? false)) {
        console.log("First install");
      }

      saveDefaultSettings('openai');
      console.log('Default OpenAI settings saved');
      chrome.storage.sync.set({ initialised: true, version: __VERSION }, () => {
        console.log(`Initialised plugin. Version set to ${__VERSION}`);
      });
      console.log('Settings initialised to OpenAI');
    }
  });
});

const getTabWithUrl = (url) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      let tab = tabs.find(tab => tab.url?.endsWith(url));

      if (!tab) {
        tab = tabs.find(tab => tab.pendingUrl?.endsWith(url));
      }
      if (tab) {
        return resolve(tab);
      } else {
        return reject(new Error(`No tab with URL "${url}" found.`));
      }
    });
  });
};

const escapeJSONString = (jsonString) => {
  return jsonString.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const extractValue = (obj, path) => {
  const keys = path.split('.');
  let value = obj;
  for (let key of keys) {
    const arrayMatch = key.match(/(\w+)\[(\d+)\]/);
    if (arrayMatch) {
      const arrayKey = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      value = value[arrayKey] ? value[arrayKey][index] : undefined;
    } else {
      value = value[key];
    }
    if (value === undefined) break;
  }
  return value;
};

const parseCommentsForLlm = (rawCommentsData, mapperKeys, maxComments) => {
  if (!rawCommentsData?.data?.children) {
    return { comments: [], totalProcessed: 0 };
  }

  const comments = rawCommentsData.data.children;
  const result = [];
  let totalProcessed = 0;

  for (let i = 0; i < comments.length; i++) {
    if (maxComments && i >= maxComments && maxComments > 0) {
      break;
    }

    const comment = comments[i];
    let mappedObject = {};

    for (const [newKey, path] of Object.entries(mapperKeys)) {
      mappedObject[newKey] = extractValue(comment, path);
    }

    result.push(mappedObject);
    totalProcessed++;
  }

  return { comments: result, totalProcessed };
};

const saveDefaultSettings = (configDefault) => {
  const commomSettings = {
    commentMapper: defaultCommentMapper,
    llmPrompt: defaultLlmPrompt
  };
  
  if (configDefault === 'ollama') {
    const defaultSettings = {
      ...commomSettings,
      apiUrl: defaultOllamaApiUrl,
      llmResponsePath: defaultOllamaResponsePath,
      apiKey: '',
      payloadObject: defaultOllamPayloadObject,
      requestHeaders: defaultOllamaHeaders,
      version: __VERSION,
      initialised: true
    };

    chrome.storage.sync.set(defaultSettings, () => {
      console.log('Default Ollama settings saved');
    });
  } else if (configDefault === 'openai') {
    const defaultSettings = {
      ...commomSettings,
      apiUrl: defaultOpenAiApiUrl,
      llmResponsePath: defaultOpenAiResponsePath,
      apiKey: '',
      payloadObject: defaultOpenAiPayloadObject,
      requestHeaders: defaultOpanAiHeaders
    };

    chrome.storage.sync.set(defaultSettings, () => {
      console.log('Default OpenAI settings saved');
    });
  } else {
    console.log(`Unknown config: ${configDefault}`);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendRawCommentContentToModal") {
    getTabWithUrl(`modal.html?username=${request.content.username}`).then((modalWindow) => {
      chrome.tabs.sendMessage(modalWindow.id, {
        type: 'SET_RAW_COMMENTS',
        content: request.content
      });
    }).catch((err) => {
      console.log('tab not found', err);
    });
  }

  if (request.action === "resetSettings") {
    saveDefaultSettings(request?.configDefault);
  }

  if (request.action === "sendParsedCommentContentToModal") {
    getTabWithUrl(`modal.html?username=${request.content.username}`).then((modalWindow) => {
      chrome.tabs.sendMessage(modalWindow.id, {
        type: 'SET_PARSED_COMMENTS',
        content: request.content
      });
    }).catch((err) => {
      console.log('tab not found', err);
    });
  }

  if (request.action === "parseCommentsForLlm") {
    const { rawComments } = request;
    chrome.storage.sync.get(['commentMapper', 'maxComments'], (result) => {
      const parsedComments = parseCommentsForLlm(rawComments, JSON.parse(result.commentMapper), result?.maxComments ?? -1);
      sendResponse(parsedComments);
    });
    return true;
  }

  if (request.action === "getSettings") {
    chrome.storage.sync.get(['apiUrl', 'llmPrompt', 'payloadObject', 'requestHeaders'], (result) => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === "performLlmApiCall") {
    const { username, parsedComments } = request?.content ?? {};
    chrome.storage.sync.get(['apiUrl', 'llmPrompt', 'payloadObject', 'requestHeaders', 'apiKey'], (result) => {
      const { apiUrl, llmPrompt, payloadObject, requestHeaders } = result;

      if (apiUrl) {
        const llmPromptInterpolated = interpolate(llmPrompt, { commentJsonData: escapeJSONString(JSON.stringify(parsedComments, null, 0)), username });
        const payloadString = interpolate(payloadObject, { llmPrompt: llmPromptInterpolated });
        let payload;
        try {
          payload = JSON.parse(payloadString);
        } catch (e) {
          console.log('Error parsing JSON payload:', e);
          sendResponse({ error: 'Error parsing JSON payload' });
          return;
        }

        const headers = requestHeaders.reduce((acc, header) => {
          acc[header.key] = interpolate(header.value, { apiKey: result.apiKey });
          return acc;
        }, {});

        fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        })
        .then((response) => response.json())
        .then((data) => {
          sendResponse({ success: true, data: data });
        })
        .catch((error) => {
          console.log('Error:', error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        console.log('API URL is missing');
        sendResponse({ success: false, error: 'API URL is missing' });
      }
    });
    return true;
  }

 if (request.action === "fetchRedditUserData") {
    const { username } = request;
    const redditUrl = `https://www.reddit.com/user/${username}.json`;
    chrome.cookies.getAll({ domain: '.reddit.com' }, (cookies) => {
      const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

      fetch(redditUrl, {
        method: 'GET',
        headers: {
          'Cookie': cookieHeader
        }
      })
      .then(response => response.json())
      .then(data => {
        // console.log('[Peak-A-Boo]: Reddit user data fetched', data);
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.log('Error fetching Reddit user data:', error);
        sendResponse({ error: error.message });
      });
    });

    return true;  // Will respond asynchronously.
  }
});
