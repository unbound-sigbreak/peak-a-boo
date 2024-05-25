let username = null;
let rawComments = null;
let parsedComments = null;

window.onload = function() {
  const closeModalButton = document.getElementById('close-modal');
  const commentsRefresh = document.getElementById('comments-refresh');
  const commentsProcessed = document.getElementById('comments-processed-refresh');
  const showParsedCommentsButton = document.getElementById('show-parsed-comments');
  const parsedCommentsWrapper = document.getElementById('parsed-comments-debug-wrapper');
  const llmResponseContent = document.getElementById('llm-response-data');

  parsedCommentsWrapper.style.display = 'none';

  closeModalButton.onclick = () => {
    window.close();
  };

  showParsedCommentsButton.onclick = () => {
    if (parsedCommentsWrapper.style.display === 'none' || parsedCommentsWrapper.style.display === '') {
      parsedCommentsWrapper.style.display = 'block';
      showParsedCommentsButton.innerText = 'Hide Parsed Comments';
    } else {
      parsedCommentsWrapper.style.display = 'none';
      showParsedCommentsButton.innerText = 'Show Parsed Comments';
    }
  };
  
  commentsRefresh.onclick = () => {
    const errorList = [];
    document.getElementById('comments-retrieved-state').innerText = 'Loading';
    document.getElementById('comments-parsed-state').innerText = 'No';
    document.getElementById('comments-processed-state').innerText = 'Outdated';
    document.getElementById('comments-processed-refresh').style.display = 'none';
    
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
            errorList.push('Error parsing comment JSON data');
          }
        }
        chrome.runtime.sendMessage({
          action: "sendRawCommentContentToModal",
          content: {
            username,
            rawComments: jsonComments,
            errorList
          }
        });
  
        chrome.runtime.sendMessage(
          { action: "parseCommentsForLlm", rawComments: jsonComments },
          (response) => {
            chrome.runtime.sendMessage({
              action: "sendParsedCommentContentToModal",
              content: {
                username,
                parsedComments: response.comments,
                errorList
              }
            });
          }
        );
      } else {
        console.error('[Peak-A-Boo]: Error fetching user data', response?.error);
      }
    });
  };

  commentsProcessed.onclick = () => {
    document.getElementById('comments-processed-state').innerText = 'Loading';
    document.getElementById('comments-processed-refresh').style.display = 'none';

    chrome.runtime.sendMessage({
      action: "performLlmApiCall",
      content: {
        username,
        parsedComments: parsedComments
      }
    }, (response) => {
      if (response?.success) {
        document.getElementById('comments-processed-refresh').style.display = 'block';
        if (response.data.error) {
          console.log('API call response', response.data);
          document.getElementById('comments-processed-state').innerText = 'Error';
          llmResponseContent.innerText = JSON.stringify(response.data, null, 2);
          return;
        }
        document.getElementById('comments-processed-state').innerText = 'Yes';
        llmResponseContent.innerText = JSON.stringify(response.data, null, 2);
      } else {
        document.getElementById('comments-processed-state').innerText = 'Error';
        llmResponseContent.innerText = response.error;
      }
    });
  };
};

chrome.runtime.onMessage.addListener((data, sender) => {
  if (data && data.type === 'SET_RAW_COMMENTS') {
    rawComments = JSON.stringify(data.content.rawComments, null, 2);
    username = data.content.username;
    document.getElementById('comments-processed-refresh').style.display = 'none';
    document.getElementById('comments-retrieved-state').innerText = 'Yes';
    document.getElementById('comments-parsed-state').innerText = 'Loading';
    return true;
  }

  if (data && data.type === 'SET_PARSED_COMMENTS') {
    parsedComments = data.content.parsedComments;
    username = data.content.username;
    document.getElementById('comments-parsed-section').innerText = 'Comments Parsed: ' + parsedComments.length;
    document.getElementById('parsed-comments-debug').innerText = JSON.stringify(parsedComments, null, 2);
    if (parsedComments.length > 1) {
      document.getElementById('comments-processed-refresh').style.display = 'block';
      document.getElementById('comments-parsed-state').innerText = 'Yes';
    }
    return true;
  }
  return false;
});
