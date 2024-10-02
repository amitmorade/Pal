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