const vscode = require('vscode');
const axios = require('axios');
const path = require('path'); // Required for file path

let chatHistory = []; // Global variable to store chat history
let panel = null; // Single Webview Panel (for both Chatbot and Options)

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

  // Register a command to toggle the chatbot window (if needed)
  let disposableChatbot = vscode.commands.registerCommand('extension.toggleChatBot', () => {
    if (panel) {
      panel.dispose(); // Close the chat window if it's open
      panel = null;
    } else {
      openWebviewPanel(context); // Open the panel when the button is clicked
    }
  });

  context.subscriptions.push(chatButton);
  context.subscriptions.push(disposableChatbot);
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

    // Set the initial content for the webview (Chatbot panel)
    panel.webview.html = getChatbotHtml(context);

    // Handle messages from the Webview (toggle between options and chatbot)
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'askQuestion') {
        // Display "Solly is searching" status update
        panel.webview.postMessage({ command: 'searching' });

        // Handle chatbot questions
        chatHistory.push({ sender: 'user', text: message.text });

        try {
          // Call the chatbot API with the user's message
          const apiResponse = await callChatbotAPI(message.text);

          // After getting the response, display "Solly is typing" status
          panel.webview.postMessage({ command: 'typing' });

          // Add the bot's response to the chat history
          chatHistory.push({ sender: 'bot', text: apiResponse });

          // Send the response back to the Webview for the typing effect
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
    url: 'https://custdocs-api.mymaas.net/chat?Content-Type=application/json', // API endpoint placeholder
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
          margin-bottom: 35px;
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
        .status-message {
          font-size: 12px;
          color: gray;
          text-align: center;
          margin-top: 10px;
        }
        .reminder-form {
          display: none;
          position: absolute;
          bottom: 160px;
          right: 20px;
          background-color: white;
          padding: 20px;
          box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        .reminder-form input {
          margin-bottom: 10px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 5px;
          width: 200px;
        }
        .reminder-form button {
          padding: 10px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          width: 100%;
          margin-bottom: 5px;
        }
        .reminder-form .close-button {
          background-color: red;
        }
      </style>
    </head>
    <body>
      <div class="chat-header">Ask Solly</div>
      <div id="chat-container" class="chat-container"></div>
      <div id="status-message" class="status-message"></div> <!-- Status message -->
      <div class="chat-footer">
        <input id="chat-input" class="chat-input" type="text" placeholder="Type your message..." />
        <button id="send-button" class="chat-button" onclick="sendMessage()">Send</button>
      </div>
      <img src="${webviewImageSrc}" alt="Otter" class="otter-img" onclick="toggleOptions()" />
      <div id="popup" class="popup">
        <div class="button" onclick="openChatbot(true)">Solly Docs</div>
        <div class="button" onclick="toggleReminderForm()">Reminders</div>
        <div class="button">Jira Tasks</div>
        <div class="button" onclick="hidePopup()">Hide</div>
      </div>
      <div class="reminder-form" id="reminder-form">
        <input type="text" id="reminder-name" placeholder="Reminder Name" />
        <input type="datetime-local" id="reminder-time" />
        <button onclick="setReminder()">Set Reminder</button>
        <button class="close-button" onclick="closeReminderForm()">Close</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        let chatHistory = []; // Store chat history globally

        function sendMessage() {
          const inputField = document.getElementById('chat-input');
          const sendButton = document.getElementById('send-button');
          const statusMessage = document.getElementById('status-message');
          const message = inputField.value;

          if (message) {
            appendMessage('user', message);

            // Disable the button and input while chatbot is processing
            sendButton.disabled = true;
            inputField.disabled = true;
            statusMessage.innerText = "Solly is searching...";

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

        function toggleOptions() {
          const popup = document.getElementById('popup');
          popup.classList.toggle('active'); // Toggle visibility of popup
        }

        function hidePopup() {
          const popup = document.getElementById('popup');
          popup.classList.remove('active'); // Hide the popup
        }

        function toggleReminderForm() {
          const form = document.getElementById('reminder-form');
          form.style.display = form.style.display === 'block' ? 'none' : 'block';
        }

        function closeReminderForm() {
          const form = document.getElementById('reminder-form');
          form.style.display = 'none';
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

          closeReminderForm();
        }

        // Typing simulation: Append the bot's response character by character
        function typeMessage(text) {
          const container = document.getElementById('chat-container');
          const messageDiv = document.createElement('div');
          const statusMessage = document.getElementById('status-message');
          messageDiv.className = 'message bot';
          container.appendChild(messageDiv);

          statusMessage.innerText = "Solly is typing..."; // Update status message

          let i = 0;
          function type() {
            if (i < text.length) {
              messageDiv.innerText += text.charAt(i);  // Append one character at a time
              i++;
              setTimeout(type, 30);  // Increased typing speed
            } else {
              document.getElementById('send-button').disabled = false;  // Re-enable the button after typing is complete
              document.getElementById('chat-input').disabled = false;  // Re-enable the input field
              statusMessage.innerText = "";  // Clear status message
              container.scrollTop = container.scrollHeight;  // Auto-scroll to the bottom
            }
          }
          type();  // Start typing
        }

        // Listen for messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;

          if (message.command === 'reply') {
            // Display the response using the typing effect
            typeMessage(message.text);
          } else if (message.command === 'searching') {
            // Show "Solly is searching" while getting response
            const statusMessage = document.getElementById('status-message');
            statusMessage.innerText = "Solly is searching...";
          } else if (message.command === 'typing') {
            // Show "Solly is typing" before typing starts
            const statusMessage = document.getElementById('status-message');
            statusMessage.innerText = "Solly is typing...";
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
