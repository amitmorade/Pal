const vscode = require('vscode');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    try {
        const res = await axios.get("https://blog.webdevsimplified.com/rss.xml");
        const parser = new XMLParser();
        const parsedData = parser.parse(res.data);
        const articles = parsedData.rss.channel.item.map(article => ({
            label: article.title,
            detail: article.description,
            link: article.link,
        }));
        if (article == null) return
        vscode.env.openExternal(article.link);
        const disposable = vscode.commands.registerCommand('pal.helloWorld',
            async function () {
                vscode.window.showInformationMessage('Solly is on its way!');
                const article = await vscode.window.showQuickPick(articles, {
                    matchOnDetail: true
                })
                console.log(article);
            });
        context.subscriptions.push(disposable);
    } catch (error) {
        console.error('Error fetching or parsing XML:', error);
    }
}
function deactivate() { }
module.exports = {
    activate,
    deactivate
}