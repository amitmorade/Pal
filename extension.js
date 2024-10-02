const vscode = require('vscode');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let sollyPanel = null;

    function createSollyWebview() {
        if (sollyPanel) {
            // If the panel already exists, reveal it
            sollyPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        // Create a new column for the webview panel
        vscode.commands.executeCommand('workbench.action.splitEditorRight').then(() => {
            // Decrease the size of the new column, but keep the original one unchanged
            vscode.commands.executeCommand('workbench.action.decreaseViewSize');

            sollyPanel = vscode.window.createWebviewPanel(
                'sollyOverlay', // Identifies the type of the webview. Used internally
                'Solly', // Title of the panel displayed to the user
                vscode.ViewColumn.Beside, // Editor column to show the new webview panel in
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                }
            );

            const imagePath = vscode.Uri.file(path.join(context.extensionPath, 'images', 'solly.png'));
            const imageSrc = sollyPanel.webview.asWebviewUri(imagePath);
            sollyPanel.webview.html = getWebviewContent(imageSrc);

            // Add a click event listener to the webview
            sollyPanel.webview.onDidReceiveMessage(message => {
                if (message.command === 'imageClicked') {
                    vscode.window.showInformationMessage();
                }
            });

            // Reset the panel variable when the panel is closed
            sollyPanel.onDidDispose(() => {
                sollyPanel = null;
            });
        });
    }

    // Create the Solly webview when the extension is activated
    createSollyWebview();
}

function getWebviewContent(imageSrc) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Solly</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                overflow: hidden;
                display: flex;
                justify-content: flex-end;
                align-items: flex-end;
                height: 100vh; /* Full height */
                background: transparent; /* Transparent background */
                position: relative;
                z-index: 9999;
                min-width: 160px;
            }
            img {
                width: 30px;
                height: 30px;
                cursor: pointer;
                transition: width 0.3s ease, height 0.3s ease;
            }
            img.expanded {
                width: 60px; /* Increase the size on click */
                height: 60px;
            }
            /* Styles for floating popup */
            .popup {
                position: absolute;
                bottom: 50px;
                left: 50%;
                transform: translateX(-50%);
                padding: 20px;
                background: transparent; /* Transparent popup background */
                z-index: 10000;
                display: none; /* Initially hidden */
                flex-direction: column; /* Stack bars vertically */
                gap: 10px; /* Space between the bars */
            }
            .popup .bar {
                width: 150px;
                border-radius: 5px;
                height: 30px;
                background: gray;
                transition: background 0.5s;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .popup .bar:hover {
                background: lightgreen;
            }
        </style>
    </head>
    <body>
        <img src="${imageSrc}" alt="Solly" onclick="togglePopupAndExpand()">
        <div class="popup" id="popup">
            <div class="bar"> Solly Docs </div>
            <div class="bar"> Jira Tasks </div>
            <div class="bar"> Reminders </div>
            <div class="bar"> Hide </div>
        </div>
        <script>
            function togglePopupAndExpand() {
                const popup = document.getElementById('popup');
                const img = document.querySelector('img');

                // Toggle popup visibility
                if (popup.style.display === 'none' || popup.style.display === '') {
                    popup.style.display = 'flex'; // Show the popup
                } else {
                    popup.style.display = 'none'; // Hide the popup
                }

                // Toggle Solly's size by toggling the 'expanded' class
                img.classList.toggle('expanded');

                const vscode = acquireVsCodeApi();
                vscode.postMessage({ command: 'imageClicked' });
            }
        </script>
    </body>
    </html>`;
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
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
        data: data
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

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
