const defaultOllamaApiUrl = 'http://localhost.:11434/api/generate';
const defaultOpenAiApiUrl = 'https://api.openai.com/v1/chat/completions';
const defaultLlmPrompt = `Please review this user's Reddit comments and provide a summary of their behavior: {$commentJsonData}`;
const defaultOllamaModel = "tinyllama";
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

document.addEventListener('DOMContentLoaded', () => {
  const mainWindow = document.getElementById('main-window');
  const rescanButton = document.getElementById('rescan');
  const settingsWindow = document.getElementById('settings-window');
  const manualLookupButton = document.getElementById('manual-lookup');
  const settingsButton = document.getElementById('settings-button');
  const redditSettingsButton = document.getElementById('reddit-settings-button');
  const apiSettingsButton = document.getElementById('api-settings-button');
  const otherSettingsButton = document.getElementById('other-settings-button');
  const closeSettingsButton = document.getElementById('close-settings');

  manualLookupButton.addEventListener('click', () => {
    alert('Manual Lookup clicked');
  });

  rescanButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'llmButtonInjectRescan' });
    });
  });
  
  settingsButton.addEventListener('click', () => {
    mainWindow.classList.add('hidden');
    settingsWindow.classList.remove('hidden');
  });

  closeSettingsButton.addEventListener('click', () => {
    settingsWindow.classList.add('hidden');
    mainWindow.classList.remove('hidden');
  });

  redditSettingsButton.addEventListener('click', () => {
    toggleSection('reddit-settings', 'reddit-settings.html');
  });

  apiSettingsButton.addEventListener('click', () => {
    toggleSection('api-settings', 'api-settings.html');
  });

  otherSettingsButton.addEventListener('click', () => {
    toggleSection('other-settings', 'other-settings.html');
  });

  function toggleSection(sectionId, htmlFile) {
    const allSectionIds = ['reddit-settings', 'api-settings', 'other-settings'];
    const section = document.getElementById(sectionId);
    for (const id of allSectionIds) {
      if (id !== sectionId) {
        const otherSection = document.getElementById(id);
        otherSection.classList.add('hidden');
      }
    }

    if (section.classList.contains('hidden')) {
      loadHtml(section, htmlFile);
      section.classList.remove('hidden');
    }
  }

  function loadHtml(element, htmlFile) {
    fetch(htmlFile)
      .then(response => response.text())
      .then(data => {
        element.innerHTML = data;
        if (htmlFile === 'api-settings.html') {
          initializeApiSettings();
        } else if (htmlFile === 'other-settings.html') {
          initializeOtherSettings();
        } else if (htmlFile === 'reddit-settings.html') {
        initializeRedditSettings();
      }
      });
  }

  function initializeRedditSettings() {
    const saveRedditSettingsButton = document.getElementById('save-reddit-setting');
    const commentMapperInput = document.getElementById('commentMapper');

    saveRedditSettingsButton.addEventListener('click', () => {
      saveRedditSettings();
    });

    loadSettings();
  }

  function initializeApiSettings() {
    const saveApiSettingsButton = document.getElementById('save-api-setting');
    const addHeaderButton = document.getElementById('addHeader');
    const requestHeadersContainer = document.getElementById('requestHeadersContainer');

    saveApiSettingsButton.addEventListener('click', () => {
      saveApiSettings();
    });

    addHeaderButton.addEventListener('click', () => {
      addHeaderInput();
    });

    loadSettings();
  }

  function initializeOtherSettings() {
    const resetConfigsOpenAi = document.getElementById('clear-storage-openai');
    const resetConfigsOllama = document.getElementById('clear-storage-ollama');

    resetConfigsOpenAi.addEventListener('click', () => {
      chrome.storage.local.clear(() => {
        saveDefaultSettings('openai');
        loadSettings();
        alert('Configs reset to OpenAI defaults');
      });
    });

    resetConfigsOllama.addEventListener('click', () => {
      chrome.storage.local.clear(() => {
        saveDefaultSettings('ollama');
        loadSettings();
        alert('Configs reset to Ollama defaults');
      });
    });
  }

  function loadSettings() {
    chrome.storage.local.get([
      'redditSetting',
      'apiUrl',
      'apiKey',
      'llmPrompt',
      'payloadObject',
      'requestHeaders',
      'commentMapper'
    ], (result) => {
      const commentMapperInput = document.getElementById('commentMapper');
      const apiUrlInput = document.getElementById('apiUrl');
      const apiKeyInput = document.getElementById('apiKey');
      const llmPromptTextarea = document.getElementById('llmPrompt');
      const payloadObjectTextarea = document.getElementById('payloadObject');
      const requestHeadersContainer = document.getElementById('requestHeadersContainer');

      if (commentMapperInput) {
        commentMapperInput.value = result.commentMapper;
      }

      if (apiUrlInput) {
        apiUrlInput.value = result.apiUrl;
      }

      if (apiKeyInput) {
        apiKeyInput.value = result.apiKey || '';
      }

      if (llmPromptTextarea) {
        llmPromptTextarea.value = result.llmPrompt;
      }

      if (payloadObjectTextarea) {
        payloadObjectTextarea.value = result.payloadObject;
      }

      if (requestHeadersContainer) {
        const headers = result.requestHeaders ?? [];
        requestHeadersContainer.innerHTML = '';
        headers.forEach(header => {
          addHeaderInput(header.key, header.value);
        });
      }
    });
  }

  function saveDefaultSettings(configDefault) {
    const commomSettings = {
      commentMapper: defaultCommentMapper,
      llmPrompt: defaultLlmPrompt
    };

    if (configDefault === 'ollama') {
      const defaultSettings = {
        ...commomSettings,
        apiUrl: defaultOllamaApiUrl,
        apiKey: '',
        payloadObject: defaultOllamPayloadObject,
        requestHeaders: defaultOllamaHeaders,
      };

      chrome.storage.local.set(defaultSettings, () => {
        console.log('Default Ollama settings saved');
      });
    } else if (configDefault === 'openai') {
      const defaultSettings = {
        ...commomSettings,
        apiUrl: defaultOpenAiApiUrl,
        apiKey: '',
        payloadObject: defaultOpenAiPayloadObject,
        requestHeaders: defaultOpanAiHeaders
      };

      chrome.storage.local.set(defaultSettings, () => {
        console.log('Default OpenAI settings saved');
      });
    }
  }

  function saveApiSettings() {
    const apiUrl = document.getElementById('apiUrl').value;
    const apiKey = document.getElementById('apiKey').value;
    const llmPrompt = document.getElementById('llmPrompt').value;
    const payloadObject = document.getElementById('payloadObject').value;
    const requestHeaders = Array.from(document.getElementsByClassName('headerPair')).map(pair => ({
      key: pair.querySelector('.headerKey').value,
      value: pair.querySelector('.headerValue').value
    }));

    chrome.storage.local.set({
      ...({ apiUrl } ? { apiUrl } : {}),
      ...({ apiKey } ? { apiKey } : {}),
      ...({ llmPrompt } ? { llmPrompt } : {}),
      ...({ payloadObject } ? { payloadObject } : {}),
      ...({ requestHeaders } ? { requestHeaders } : {})
    }, () => {
      alert('API Settings saved');
    });
  }

  function saveRedditSettings() {
    const commentMapper = document.getElementById('commentMapper')?.value ?? null;

    try {
      JSON.parse(commentMapper);
    } catch (e) {
      alert('Invalid JSON for comment mapper. No settings saved.');
      return;
    }

    chrome.storage.local.set({
      ...({ commentMapper } ? { commentMapper } : {})
    }, () => {
      alert('Reddit Settings saved');
    });
  }

  function addHeaderInput(key = '', value = '') {
    const headerPair = document.createElement('div');
    headerPair.classList.add('headerPair');
    headerPair.innerHTML = `
      <input type="text" class="headerKey" placeholder="Header Key" value="${key}">
      <input type="text" class="headerValue" placeholder="Header Value" value="${value}">
      <button class="removeHeader">X</button>
    `;
    const requestHeadersContainer = document.getElementById('requestHeadersContainer');
    requestHeadersContainer.appendChild(headerPair);

    headerPair.querySelector('.removeHeader').addEventListener('click', () => {
      requestHeadersContainer.removeChild(headerPair);
    });
  }
});
