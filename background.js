import { interpolate } from "./interpolate.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log('Reddit Peak-A-Boo installed');
});

function getTabWithUrl(url) {
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

const parseCommentsForLlm = (rawCommentsData, mapperKeys, maxComments) => {
  if (!rawCommentsData?.data?.children) {
    return { comments: [], totalProcessed: 0 };
  }

  const comments = rawCommentsData.data.children;
  const result = [];
  let totalProcessed = 0;

  for (let i = 0; i < comments.length; i++) {
    if (maxComments && i >= maxComments) {
      break;
    }

    const comment = comments[i];
    let mappedObject = {};

    for (const [newKey, path] of Object.entries(mapperKeys)) {
      const keys = path.split('.');
      let value = comment;

      for (let key of keys) {
        if (value[key] !== undefined) {
          value = value[key];
        } else {
          value = undefined;
          break;
        }
      }

      mappedObject[newKey] = value;
    }

    result.push(mappedObject);
    totalProcessed++;
  }

  return { comments: result, totalProcessed };
};

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

    const { rawComments, maxComments } = request;
    chrome.storage.local.get(['commentMapper'], (result) => {
      const parsedComments = parseCommentsForLlm(rawComments, JSON.parse(result.commentMapper), maxComments);
      sendResponse(parsedComments);
    });
    return true;
  }

  if (request.action === "getSettings") {
    chrome.storage.local.get(['apiUrl', 'llmPrompt', 'payloadObject', 'requestHeaders'], (result) => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === "performLlmApiCall") {
    const { username, parsedComments } = request?.content ?? {};
    chrome.storage.local.get(['apiUrl', 'llmPrompt', 'payloadObject', 'requestHeaders', 'apiKey'], (result) => {
      const { apiUrl, llmPrompt, payloadObject, requestHeaders } = result;

      if (apiUrl) {
        const llmPromptInterpolated = interpolate(llmPrompt, { commentJsonData: escapeJSONString(JSON.stringify(parsedComments, null, 0)), username });
        const payloadString = interpolate(payloadObject, { llmPrompt: llmPromptInterpolated });
        let payload;
        try {
          payload = JSON.parse(payloadString);
        } catch (e) {
          console.error('Error parsing JSON payload:', e);
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
          console.log('[Peak-A-Boo]: API call success', data);
          sendResponse({ success: true, data: data });
        })
        .catch((error) => {
          console.error('Error:', error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        console.error('API URL is missing');
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
        console.log('[Peak-A-Boo]: Reddit user data fetched', data);
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('Error fetching Reddit user data:', error);
        sendResponse({ error: error.message });
      });
    });

    return true;  // Will respond asynchronously.
  }
});
