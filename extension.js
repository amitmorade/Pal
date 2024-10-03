const vscode = require('vscode');
const axios = require('axios');
const path = require('path'); // Required for file path

let chatHistory = []; // Global variable to store chat history
let panel; // Chatbot Webview Panel
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

    // Create a floating button in the status bar for Solly
    let sollyButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    sollyButton.text = '⚙️ Solly'; // Text + emoji (you can replace this with an icon)
    sollyButton.tooltip = 'Click to open Solly';
    sollyButton.command = 'extension.toggleSolly';
    sollyButton.show(); // Show the button in the status bar

    // Register a command to toggle the chatbot window
    let disposableChatbot = vscode.commands.registerCommand('extension.toggleChatBot', () => {
        if (panel) {
            panel.dispose(); // Close the chat window if it's open
            panel = null;
        } else {
            // Create and open the chat window (Webview)
            panel = vscode.window.createWebviewPanel(
                'chatbot', // Internal identifier
                'ChatBot', // Title displayed on the panel
                vscode.ViewColumn.One, // Display in the current column
                { enableScripts: true } // Enable JavaScript in the Webview
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
    context.subscriptions.push(disposableChatbot);

    // Register a command to toggle the Solly window
    let disposableSolly = vscode.commands.registerCommand('extension.toggleSolly', () => {
        createSollyWebview(context); // Call function to create Solly Webview
    });

    context.subscriptions.push(sollyButton);
    context.subscriptions.push(disposableSolly);

    // Register a command to show notifications
    let disposableNotification = vscode.commands.registerCommand('extension.showNotification', (name) => {
        vscode.window.showInformationMessage(`Reminder: ${name}`);
    });

    context.subscriptions.push(disposableNotification);
}
//create webview content
function getWebviewContent(imageSrc) {
    return `
      <!DOCTYPE html>
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
            cursor: pointer; /* Cursor pointer for bars */
          }
          .popup .bar:hover {
            background: lightgreen; /* Change color on hover */
          }
          /* Styles for the reminder form */
          .reminder-form {
            display: none;
            flex-direction: column;
            gap: 10px;
            background: #f9f9f9; /* Light gray background */
            padding: 15px; /* Slightly reduce padding for a more compact look */
            border-radius: 8px; /* Increase border radius for a softer look */
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); /* Softer shadow */
            max-width: 170px;
            position: absolute;
            bottom: 80px; /* Position above the popup */
            left: 50%;
            transform: translateX(-50%);
            z-index: 10001; /* Ensure it is above other elements */
            margin-bottom: 20px; /* Add bottom margin */
          }

          /* Style for inputs and button */
          .reminder-form input, .reminder-form button {
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #ccc; /* Light gray border */
            width: 120px; /* Maintain the width */
            font-family: Arial, sans-serif; /* Change font for better aesthetics */
            font-size: 14px; /* Increase font size for readability */
          }

          /* Change input and button background on focus */
          .reminder-form input:focus, .reminder-form button:focus {
            border-color: #4a90e2; /* Blue border on focus */
            outline: none; /* Remove outline */
            box-shadow: 0 0 5px rgba(74, 144, 226, 0.5); /* Light blue shadow */
          }

          /* Style button */
          .reminder-form button {
            background-color: #4a90e2; /* Blue background */
            color: white; /* White text color */
            cursor: pointer; /* Pointer cursor for button */
            transition: background-color 0.3s; /* Smooth transition for hover effect */
          }

          /* Button hover effect */
          .reminder-form button:hover {
            background-color: #357ABD; /* Darker blue on hover */
          }

        </style>
      </head>
      <body>
        <img src="${imageSrc}" alt="Solly" onclick="togglePopupAndExpand()">
        <div class="popup" id="popup">
          <div class="bar" onclick="showReminderForm()"> Reminders </div>
          <div class="bar"> Solly Docs </div>
          <div class="bar"> Jira Tasks </div>
          <div class="bar" onclick="hidePopup()"> Hide </div>
        </div>
        <div class="reminder-form" id="reminder-form">
          <input type="text" id="reminder-name" placeholder="Reminder Name">
          <input type="datetime-local" id="reminder-time">
          <button onclick="setReminder()">Set Reminder</button>
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
  
          function showReminderForm() {
            const form = document.getElementById('reminder-form');
            const popup = document.getElementById('popup');
            form.style.display = 'flex';
            popup.style.display = 'none'; // Hide the popup when the form is displayed
          }
  
          function hidePopup() {
            const popup = document.getElementById('popup');
            popup.style.display = 'none'; // Hide the popup
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
            const form = document.getElementById('reminder-form');
            form.style.display = 'none'; // Hide the form
            const popup = document.getElementById('popup');
            popup.style.display = 'flex'; // Show the popup again
          }

          // Close the reminder form when clicking outside of it
          document.addEventListener('click', function(event) {
            const form = document.getElementById('reminder-form');
            const popup = document.getElementById('popup');
            const img = document.querySelector('img');

            // Check if the click is outside the reminder form and popup
            if (!form.contains(event.target) && !popup.contains(event.target) && event.target !== img) {
              form.style.display = 'none'; // Hide the reminder form
              popup.style.display = 'flex'; // Show the popup again if it was hidden
            }
          });
        </script>
      </body>
      </html>
    `;
}

// Function to create the Solly Webview
function createSollyWebview(context) {
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
                vscode.window.showInformationMessage('Solly image clicked!');
            } else if (message.command === 'showNotification') {
                vscode.window.showInformationMessage(`Reminder: ${message.name}`);
            }
        });

        // Reset the panel variable when the panel is closed
        sollyPanel.onDidDispose(() => {
            sollyPanel = null;
        });
    });
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

// Inside your activate function, after creating the WebView
panel.webview.onDidReceiveMessage(message => {
    switch (message.command) {
        case 'setReminderClicked':
            // Show an alert in VS Code
            vscode.window.showInformationMessage('Set Reminder button was clicked!');
            break;
    }
});

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
