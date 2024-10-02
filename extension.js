const vscode = require('vscode');
const axios = require('axios');

let chatHistory = [];  // Global variable to store chat history

function activate(context) {
  let panel;  // To reference the Webview panel (chat window)

  // Create a floating button in the status bar
  let chatButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  chatButton.text = '💬 Chat';  // Text + emoji (you can replace this with an icon)
  chatButton.tooltip = 'Click to open the chatbot';
  chatButton.command = 'extension.toggleChatBot';
  chatButton.show();  // Show the button in the status bar

  // Register a command to toggle the chat window
  let disposable = vscode.commands.registerCommand('extension.toggleChatBot', () => {
    if (panel) {
      panel.dispose();  // Close the chat window if it's open
      panel = null;
    } else {
      // Create and open the chat window (Webview)
      panel = vscode.window.createWebviewPanel(
        'chatbot',  // Internal identifier
        'ChatBot',  // Title displayed on the panel
        vscode.ViewColumn.One,  // Display in the current column
        { enableScripts: true }  // Enable JavaScript in the Webview
      );

      // Set the content for the chat window (Webview)
      panel.webview.html = getChatbotHtml();

      // Send the existing chat history to the Webview so it can be re-rendered
      panel.webview.postMessage({ command: 'loadHistory', history: chatHistory });

      // Listen for messages from the Webview (when the user sends a message)
      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'askQuestion') {
          // Add the user's message to the chat history
          chatHistory.push({ sender: 'user', text: message.text });

          try {
            // Call the chatbot API with the user's message
            const apiResponse = await callChatbotAPI(message.text);
            // Add the bot's response to the chat history
            chatHistory.push({ sender: 'bot', text: apiResponse });

            // Send the response back to the Webview
            panel.webview.postMessage({ command: 'reply', text: apiResponse });
          } catch (error) {
            console.error('Error calling the chatbot API:', error);
            const errorMessage = 'Sorry, there was an error processing your request.';
            chatHistory.push({ sender: 'bot', text: errorMessage });
            panel.webview.postMessage({ command: 'reply', text: errorMessage });
          }
        }
      });

      // Reset panel when it is closed
      panel.onDidDispose(() => {
        panel = null;
      });
    }
  });

  context.subscriptions.push(chatButton);
  context.subscriptions.push(disposable);
}

// Function to call the chatbot API
async function callChatbotAPI(userMessage) {

    let data = JSON.stringify({
        "message": userMessage,
        "history": []
      });
    
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://custdocs-api.mymaas.net/chat?Content-Type=application/json',
        headers: { 
          'Content-Type': 'application/json'
        },
        data : data
      };
      

    try {
      // Make the POST request to the chatbot API
      const response = await axios.request(config);

      console.log(response.data);
  
      // Return the API's response (assuming the response has a 'reply' field)
      return response.data.message || 'No response from the bot';
    } catch (error) {
      console.error('Error calling the chatbot API:', error);
      return 'Sorry, there was an error processing your request.';
    }
  }

// HTML content for the chat window
function getChatbotHtml() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ChatBot</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          height: 100vh;
          background-color: #f7f7f7;
        }

        .chat-header {
          background-color: #4CAF50;
          color: white;
          padding: 15px;
          text-align: center;
        }

        .chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 10px;
          overflow-y: auto;
        }

        .message {
          margin-bottom: 10px;
          padding: 10px;
          border-radius: 10px;
          max-width: 70%;
        }

        .message.user {
          background-color: #e6ffe6;
          align-self: flex-end;
          color: black;
        }

        .message.bot {
          background-color: #d9d9d9;
          align-self: flex-start;
          color: black;
        }

        .chat-footer {
          display: flex;
          padding: 10px;
          background-color: #fff;
          border-top: 1px solid #ddd;
        }

        .chat-input {
          flex: 1;
          padding: 10px;
          border-radius: 5px;
          border: 1px solid #ddd;
        }

        .chat-button {
          background-color: #4CAF50;
          color: white;
          border: none;
          padding: 10px;
          margin-left: 10px;
          border-radius: 5px;
          cursor: pointer;
        }

        .chat-button:disabled {
          background-color: grey;
          cursor: not-allowed;
        }
      </style>
    </head>
    <body>
      <div class="chat-header">Ask Amit</div>
      <div id="chat-container" class="chat-container"></div>
      <div class="chat-footer">
        <input id="chat-input" class="chat-input" type="text" placeholder="Type your message..." />
        <button id="send-button" class="chat-button" onclick="sendMessage()">Send</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();

        function sendMessage() {
          const inputField = document.getElementById('chat-input');
          const sendButton = document.getElementById('send-button');
          const message = inputField.value;

          if (message) {
            appendMessage('user', message);

            // Disable the button and input while chatbot is processing
            sendButton.disabled = true;
            inputField.disabled = true;

            vscode.postMessage({ command: 'askQuestion', text: message });
            inputField.value = '';  // Clear input field
          }
        }

        function appendMessage(sender, text) {
          const container = document.getElementById('chat-container');
          const messageDiv = document.createElement('div');
          messageDiv.className = 'message ' + sender;
          messageDiv.innerText = text;
          container.appendChild(messageDiv);
          container.scrollTop = container.scrollHeight;  // Auto-scroll to the bottom
        }

        // Typing simulation: Append the bot's response character by character
        function typeMessage(text) {
          const container = document.getElementById('chat-container');
          const messageDiv = document.createElement('div');
          messageDiv.className = 'message bot';
          container.appendChild(messageDiv);

          let i = 0;

          function type() {
            if (i < text.length) {
              messageDiv.innerText += text.charAt(i);  // Append one character at a time
              i++;
              setTimeout(type, 50);  // Set typing speed (50ms between each character)
            } else {
              document.getElementById('send-button').disabled = false;  // Re-enable the button after typing is complete
              document.getElementById('chat-input').disabled = false;  // Re-enable the input field
              container.scrollTop = container.scrollHeight;  // Auto-scroll to the bottom
            }
          }

          type();  // Start typing
        }

        // Load the chat history when the Webview is reloaded
        function loadHistory(history) {
          history.forEach(item => {
            appendMessage(item.sender, item.text);
          });
        }

        // Listen for messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;

          if (message.command === 'reply') {
            // Display the response using the typing effect
            typeMessage(message.text);
          } else if (message.command === 'loadHistory') {
            // Load the stored chat history
            loadHistory(message.history);
          }
        });
      </script>
    </body>
    </html>
  `;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
