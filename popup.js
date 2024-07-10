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

  manualLookupButton?.addEventListener('click', () => {
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

  const toggleSection = (sectionId, htmlFile) => {
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

  const loadHtml = (element, htmlFile) => {
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

  const initializeRedditSettings = () => {
    const saveRedditSettingsButton = document.getElementById('save-reddit-setting');

    saveRedditSettingsButton.addEventListener('click', () => {
      saveRedditSettings();
    });

    loadSettings();
  }

  const initializeApiSettings = () => {
    const saveApiSettingsButton = document.getElementById('save-api-setting');
    const addHeaderButton = document.getElementById('addHeader');
    const requestHeadersContainer = document.getElementById('requestHeadersContainer');

    saveApiSettingsButton.addEventListener('click', () => {
      saveApiSettings();
    });

    addHeaderButton.addEventListener('click', () => {
      addHeaderInput();
    });

    const apiKeyField = document.getElementById('apiKey');
    apiKeyField.addEventListener('focus', function () {
      apiKeyField.type = 'text';
    });

    apiKeyField.addEventListener('blur', function () {
      apiKeyField.type = 'password';
    });

    loadSettings();
  };

  const initializeOtherSettings = () => {
    const resetConfigsOpenAi = document.getElementById('clear-storage-openai');
    const resetConfigsOllama = document.getElementById('clear-storage-ollama');

    resetConfigsOpenAi.addEventListener('click', () => {
      chrome.storage.sync.clear(() => {
        chrome.runtime.sendMessage({
          action: "resetSettings",
            configDefault: 'ollama'
        },
        () => {
          loadSettings();
          alert('Configs reset to OpenAI defaults');
        });
      });
    });

    resetConfigsOllama.addEventListener('click', () => {
      chrome.storage.sync.clear(() => {
        chrome.runtime.sendMessage({
          action: "resetSettings",
          configDefault: 'ollama'
        },
        () => {
          loadSettings();
          alert('Configs reset to Ollama defaults');
        });
      });
    });
  }

  const loadSettings = () => {
    chrome.storage.sync.get([
      'apiUrl',
      'apiKey',
      'llmResponsePath',
      'llmPrompt',
      'payloadObject',
      'requestHeaders',
      'commentMapper',
      'maxComments',
      'initialised',
      'version'
    ], (result) => {
      const commentMapperInput = document.getElementById('commentMapper');
      const maxCommentsInput = document.getElementById('maxComments');
      const apiUrlInput = document.getElementById('apiUrl');
      const apiKeyInput = document.getElementById('apiKey');
      const llmResponseJsonPath = document.getElementById('llmResponseJsonPath');
      const llmPromptTextarea = document.getElementById('llmPrompt');
      const payloadObjectTextarea = document.getElementById('payloadObject');
      const requestHeadersContainer = document.getElementById('requestHeadersContainer');

      if (commentMapperInput) {
        commentMapperInput.value = result.commentMapper;
      }

      if (maxCommentsInput) {
        maxCommentsInput.value = result.maxComments || '';
      }

      if (apiUrlInput) {
        apiUrlInput.value = result.apiUrl;
      }

      if (apiKeyInput) {
        apiKeyInput.value = result.apiKey || '';
      }

      if (llmResponseJsonPath) {
        llmResponseJsonPath.value = result.llmResponsePath || '';
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

  const saveApiSettings = () => {
    const apiUrl = document.getElementById('apiUrl').value;
    const apiKey = document.getElementById('apiKey').value;
    const llmResponsePath = document.getElementById('llmResponseJsonPath').value;
    const llmPrompt = document.getElementById('llmPrompt').value;
    const payloadObject = document.getElementById('payloadObject').value;
    const requestHeaders = Array.from(document.getElementsByClassName('headerPair')).map(pair => ({
      key: pair.querySelector('.headerKey').value,
      value: pair.querySelector('.headerValue').value
    }));

    chrome.storage.sync.set({
      ...({ apiUrl } ? { apiUrl } : {}),
      ...({ apiKey } ? { apiKey } : {}),
      ...({ llmResponsePath } ? { llmResponsePath } : {}),
      ...({ llmPrompt } ? { llmPrompt } : {}),
      ...({ payloadObject } ? { payloadObject } : {}),
      ...({ requestHeaders } ? { requestHeaders } : {})
    }, () => {
      alert('API Settings saved');
    });
  }

  const saveRedditSettings = () => {
    const commentMapper = document.getElementById('commentMapper')?.value ?? null;
    const maxComments = document.getElementById('maxComments')?.value ?? null;

    try {
      JSON.parse(commentMapper);
    } catch (e) {
      alert('Invalid JSON for comment mapper. No settings saved.');
      return;
    }

    chrome.storage.sync.set({
      ...({ commentMapper } ? { commentMapper } : {}),
      ...({ maxComments } ? { maxComments } : {}),
    }, () => {
      alert('Reddit Settings saved');
    });
  }

  const addHeaderInput = (key = '', value = '') => {
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
