const vscode = require('vscode');
const axios = require('axios');
const path = require('path'); // Required for file path

let chatHistory = []; // Global variable to store chat history
let panel = null; // Single Webview Panel (for both Chatbot and Options)
let sollyPanel = null; // Solly Webview Panel

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // Create a floating button in the status bar for the chatbot
    let chatButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    chatButton.text = '💬 Chat'; // Text + emoji (you can replace this with an icon)
    chatButton.tooltip = 'Click to open the chatbot';
    chatButton.command = 'extension.toggleChatBot';
    chatButton.show(); // Show the button in the status bar

    // Automatically open the webview (with Otter and options) on launch
    openWebviewPanel(context); // Call this function to open the panel on extension launch

    // Register a command to toggle the chatbot window (if needed)
    let disposableChatbot = vscode.commands.registerCommand('extension.toggleChatBot', () => {
        if (panel) {
            panel.dispose(); // Close the chat window if it's open
            panel = null;
        } else {
            openWebviewPanel(context); // Open the panel when the button is clicked
        }
    });

    // Register a command to open the Jira webview
    let disposableJira = vscode.commands.registerCommand('extension.openJiraWebview', () => {
        openJiraWebview(context);
    });

    context.subscriptions.push(chatButton);
    context.subscriptions.push(disposableChatbot);
    context.subscriptions.push(disposableJira);
}

// Function to open the Webview panel
function openWebviewPanel(context) {
    if (!panel) {
        // Create and open the webview (Options and Chatbot) in the extreme right column
        panel = vscode.window.createWebviewPanel(
            'chatbot', // Internal identifier
            'Solly Options', // Title displayed on the panel
            vscode.ViewColumn.Three, // Display in the extreme right column
            { enableScripts: true } // Enable JavaScript in the Webview
        );

        // Set the initial content for the webview (Options panel)
        panel.webview.html = getOptionsHtml(context);

        // Handle messages from the Webview (toggle between options and chatbot)
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'openChatbot') {
                // Load the chatbot HTML inside the same panel
                panel.webview.html = getChatbotHtml(context);
            } else if (message.command === 'askQuestion') {
                // Handle chatbot questions
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
            } else if (message.command === 'openJira') {
                // Open the Jira webview
                vscode.commands.executeCommand('extension.openJiraWebview');
            }
        });

        // Reset panel when it is closed
        panel.onDidDispose(() => {
            panel = null;
        });
    }
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
        const response = await axios.request(config);
        console.log(response.data);

        // Return the API's response
        return response.data.message || 'No response from the bot';
    } catch (error) {
        console.error('Error calling the chatbot API:', error);
        return 'Sorry, there was an error processing your request.';
    }
}

// HTML content for the chat window
function getChatbotHtml(context) {
    const imageSrc = vscode.Uri.joinPath(context.extensionUri, 'images', 'solly.png');
    const webviewImageSrc = panel.webview.asWebviewUri(imageSrc);

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
          position: relative;
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
          max-width: 60%; /* Set a max width for messages */
          word-wrap: break-word; /* Ensure long words break and wrap */
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
          white-space: pre-wrap; /* Ensures white space and line breaks are preserved */
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
        .otter-img {
          width: 50px;
          height: 50px;
          position: absolute;
          bottom: 60px; /* Adjust the position above the Send button */
          right: 20px;
          cursor: pointer;
          z-index: 9999; /* Ensure it's clickable on top of the chat */
        }
        .popup {
          position: absolute;
          bottom: 120px; /* Adjust as needed */
          right: 20px;
          background-color: rgba(255, 255, 255, 0.9); /* Make popup more visible */
          border-radius: 10px;
          padding: 10px;
          display: none;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          z-index: 9999; /* Ensure it appears above the chat */
        }
        .popup.active {
          display: flex; /* Show the popup when active */
        }
        .button {
          background-color: #4CAF50;
          color: white;
          padding: 10px;
          border-radius: 5px;
          text-align: center;
          width: 150px;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }
        .button:hover {
          background-color: #45a049;
        }
        .button:active {
          background-color: #3d8b40;
        }
        .reminder-form {
          display: none;
          flex-direction: column;
          gap: 10px;
          background: #f9f9f9;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          position: absolute;
          bottom: 150px;
          right: 20px;
          z-index: 1000;
        }
        .close-reminder-btn {
          background-color: red;
          color: white;
          border: none;
          border-radius: 5px;
          padding: 5px;
          margin-top: 10px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="chat-header">Ask Solly</div>
      <div id="chat-container" class="chat-container"></div>
      <div class="chat-footer">
        <input id="chat-input" class="chat-input" type="text" placeholder="Type your message..." />
        <button id="send-button" class="chat-button" onclick="sendMessage()">Send</button>
      </div>
      <img src="${webviewImageSrc}" alt="Otter" class="otter-img" onclick="toggleOptions()" />
      <div id="popup" class="popup">
        <div class="button" onclick="openChatbot(true)">Solly Docs</div>
        <div class="button" onclick="openJira()">Jira Tasks</div>
        <div class="button" onclick="showReminderForm()">Reminders</div>
        <div class="button" onclick="hidePopup()">Hide</div>
      </div>
      <div class="reminder-form" id="reminder-form">
        <input type="text" id="reminder-name" placeholder="Reminder Name">
        <input type="datetime-local" id="reminder-time">
        <button onclick="setReminder()">Set Reminder</button>
        <button class="close-reminder-btn" onclick="closeReminderForm()">Close</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        let chatHistory = []; // Store chat history globally

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

        function openJira() {
            vscode.postMessage({ command: 'openJira' });
          }

        function toggleOptions() {
          const popup = document.getElementById('popup');
          popup.classList.toggle('active'); // Toggle visibility of popup
        }

        function hidePopup() {
          const popup = document.getElementById('popup');
          popup.classList.remove('active'); // Hide the popup
        }

        function showReminderForm() {
          hidePopup(); // Hide options when showing reminder form
          const reminderForm = document.getElementById('reminder-form');
          reminderForm.style.display = 'flex';
        }

        function closeReminderForm() {
          const reminderForm = document.getElementById('reminder-form');
          reminderForm.style.display = 'none'; // Close reminder form when user clicks 'Close'
        }

        function setReminder() {
          const name = document.getElementById('reminder-name').value;
          const time = document.getElementById('reminder-time').value;
          const reminderTime = new Date(time).getTime();
          const currentTime = new Date().getTime();
          const delay = reminderTime - currentTime;

          if (delay > 0) {
            setTimeout(() => {
              alert(\`Reminder: \${name}\`);
            }, delay);
          } else {
            alert('Please set a future time for the reminder.');
          }

          // Hide the form after setting the reminder
          closeReminderForm();
        }
      </script>
    </body>
    </html>
  `;
}

// HTML content for the options panel (styled like the design)
function getOptionsHtml(context) {
    const imageSrc = vscode.Uri.joinPath(context.extensionUri, 'images', 'solly.png');
    const webviewImageSrc = panel.webview.asWebviewUri(imageSrc);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Solly Options</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: flex-end;
            align-items: flex-end;
            height: 100vh;
            background-color: #1e1e1e; /* Match the VS Code theme */
            position: relative;
          }
          img {
            width: 50px;
            height: 50px;
            cursor: pointer;
            position: absolute;
            bottom: 10px;
            right: 10px;
          }
          .popup {
            position: absolute;
            bottom: 70px;
            right: 10px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 10px;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }
          .popup.active {
            display: flex; /* Show the popup when active */
          }
          .button {
            background-color: grey;
            color: white;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
            width: 150px;
            cursor: pointer;
            transition: background-color 0.3s ease;
          }
          .button:hover {
            background-color: #4CAF50;
          }
        </style>
      </head>
      <body>
        <img src="${webviewImageSrc}" alt="Solly" onclick="togglePopup()" />
        <div id="popup" class="popup">
          <div class="button" onclick="openChatbot()">Solly Docs</div>
          <div class="button" onclick="openJira()">Jira Tasks</div>
          <div class="button">Reminders</div>
          <div class="button" onclick="hidePopup()">Hide</div>
        </div>
  
        <script>
          const vscode = acquireVsCodeApi();
  
          function openChatbot() {
            vscode.postMessage({ command: 'openChatbot' });
          }
  
          function openJira() {
            vscode.postMessage({ command: 'openJira' });
          }
  
          function togglePopup() {
            const popup = document.getElementById('popup');
            popup.classList.toggle('active'); // Toggle visibility of popup
          }
  
          function hidePopup() {
            const popup = document.getElementById('popup');
            popup.classList.remove('active'); // Hide the popup
          }
        </script>
      </body>
      </html>
    `;
}

//function you can use to open the Jira webview
function openJiraWebview(context) {
    const jiraPanel = vscode.window.createWebviewPanel(
        'jira', // Internal identifier
        'Jira Tasks', // Title displayed on the panel
        vscode.ViewColumn.One, // Display in the first column
        { enableScripts: true } // Enable JavaScript in the Webview
    );

    // Set the initial content for the Jira webview
    jiraPanel.webview.html = getJiraHtml();
}

// HTML content for the Jira webview
function getJiraHtml() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Jira Tasks</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          height: 100vh;
          background-color: #f7f7f7;
          position: relative;
        }
        .header {
          background-color: #4CAF50;
          color: white;
          padding: 15px;
          text-align: center;
        }
        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 10px;
          overflow-y: auto;
        }
      </style>
    </head>
    <body>
      <div class="header">Jira Tasks</div>
      <div class="content">
        <!-- Add your Jira content here -->
      </div>
    </body>
    </html>
  `;
}

// Function to deactivate the extension
function deactivate() { }

module.exports = {
    activate,
    deactivate
};
