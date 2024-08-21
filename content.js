const __PREFIX = '[Reddit-Peak-A-Boo]: ';
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'llmButtonInjectRescan') {
    removeButtonElements();
    const result = injectButtonElements();
    console.log(result);
  }
});

const injectButtonElements = () => {
  const consoleOut = [];
  if (window.location.href.includes("reddit.com/r/")) {
    const mainDivs = document.querySelectorAll('div.flex.items-center.pr-xs.overflow-hidden');

    if (!mainDivs.length) {
      consoleOut.push('[Peak-A-Boo]: Could not find main divs');
    }

    let buttonsInjected = 0;
    mainDivs.forEach((mainDiv) => {
      const nestedDiv = mainDiv.querySelector('div.flex.flex-row.items-center.overflow-hidden');
      if (nestedDiv) {
        const tracker = nestedDiv.querySelector('faceplate-tracker a');
        if (tracker) {
          const username = tracker.innerText.trim();
          const badges = mainDiv.querySelector('shreddit-comment-badges');
          
          if (badges) {
            const button = document.createElement('button');
            button.innerText = 'LLM';
            button.className = 'peak-a-boo-llm-button';
            button.style.marginLeft = '10px';

            button.onclick = () => {
              onLlmButtonClick(username);
            };
            badges.parentElement.insertBefore(button, badges.nextSibling);
            buttonsInjected++;
          }
        } else {
          consoleOut.push(`${__PREFIX} Could not find faceplate-tracker`);
        }
      } else {
        consoleOut.push(`${__PREFIX} Could not find nested div`);
      }
    });
    consoleOut.push(`${__PREFIX} Buttons Injected: '${buttonsInjected}'`);

  } else {
    consoleOut.push(`${__PREFIX} Not on a Reddit page`);
  }

  return consoleOut;
};

const removeButtonElements = () => {
  const buttons = document.querySelectorAll('.peak-a-boo-llm-button');
  buttons.forEach(button => button.remove());
};

const onLlmButtonClick = (username) => {
  const errorList = [];

  const modalWindow = window.open(chrome.runtime.getURL(`modal.html?username=${username}`), `Peak-A-Boo ${username}`, 'width=1000,height=600');
  chrome.runtime.sendMessage({
    action: "fetchRedditUserData",
    username: username
  }, (response) => {
    if (response?.success) {
      let jsonComments = null;
      try {
        jsonComments = JSON.parse(response.data);
      } catch (e) {
        if (typeof response.data === 'object') {
          jsonComments = response.data;
        } else {
          errorList.push(`${__PREFIX} (fetchRedditUserData) Error parsing comment JSON data`);
        }
      }
      updateJsonScriptTag(username, jsonComments, 'rawComments');

      chrome.runtime.sendMessage({
        action: "sendRawCommentContentToModal",
        content: {
          username,
          rawComments: jsonComments,
          errorList
        }
      });

      const totalRequested = -1;
      chrome.runtime.sendMessage(
        { action: "parseCommentsForLlm", rawComments: jsonComments, maxComments: totalRequested },
        (response) => {
          updateJsonScriptTag(username, response.comments, 'parsedForLlm');

          chrome.runtime.sendMessage({
            action: "sendParsedCommentContentToModal",
            content: {
              username,
              parsedComments: response.comments,
              totalRequested: totalRequested,
              processedComments: response.totalProcessed,
              errorList
            }
          });
        }
      );
    } else {
      console.error(`${__PREFIX} (parseCommentsForLlm) Error fetching user data`, response?.error);
    }
  });
}

window.addEventListener('load', () => {
  setTimeout(() => {
    console.log(injectButtonElements());
    window.addEventListener('click', (event) => { // Reinject on relative routes
      const targetTagName = event.target.tagName.toLowerCase();
      const currentButtons = document.querySelectorAll('.peak-a-boo-llm-button');
      if (currentButtons.length < 1 && ['a', 'time', 'main', 'p', 'span'].includes(targetTagName)) {
        setTimeout(() => {
          removeButtonElements();
          console.log(injectButtonElements());
        }, 500);
      }
  }, true);
  }, 500);
});

function updateJsonScriptTag(username, userData, key) {
  const scriptId = 'redditUserData';
  let scriptTag = document.getElementById(scriptId);

  if (!scriptTag) {
    scriptTag = document.createElement('script');
    scriptTag.id = scriptId;
    scriptTag.type = 'application/json';
    scriptTag.textContent = '{}';
    document.documentElement.appendChild(scriptTag);
  }

  const existingData = JSON.parse(scriptTag.textContent);
  
  if (!existingData[username]) {
    existingData[username] = {};
  }
  existingData[username][key] = userData;

  scriptTag.textContent = JSON.stringify(existingData);
}