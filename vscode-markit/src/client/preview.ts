import { compileToHTML } from "markit";
import {
  ExtensionContext,
  TextEditor,
  Uri,
  ViewColumn,
  WebviewPanel,
  window,
  workspace,
} from "vscode";

let previewPanel: WebviewPanel | undefined;
let activeEditor: TextEditor | undefined;

export default async (context: ExtensionContext): Promise<void> => {
  const editor = window.activeTextEditor;

  if (!editor) {
    window.showErrorMessage("No active editor found");
    return;
  }

  const document = editor.document;

  if (document.languageId !== "markit") {
    window.showErrorMessage("Active file is not a Markit document");
    return;
  }

  activeEditor = editor;

  // Create or show existing preview panel
  if (previewPanel) {
    previewPanel.reveal(ViewColumn.Beside);
  } else {
    const mediaPath = Uri.joinPath(context.extensionUri, "media");
    const filename = document.fileName.split("/").pop() || "untitled";
    previewPanel = window.createWebviewPanel(
      "markitPreview",
      filename + " (preview)",
      ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [mediaPath],
      },
    );

    // Watch for document changes
    const changeSubscription = workspace.onDidChangeTextDocument((e) => {
      if (e.document === document && previewPanel) {
        updatePreview(previewPanel, context, e.document.getText());
      }
    });

    // Watch for cursor/selection changes to sync scroll
    const selectionChangeSubscription = window.onDidChangeTextEditorSelection(
      (e) => {
        if (e.textEditor === activeEditor && previewPanel) {
          const line = e.selections[0].active.line + 1; // Convert 0-based to 1-based
          previewPanel.webview.postMessage({ type: "scrollToLine", line });
        }
      },
    );

    // Watch for visible range changes (scrolling)
    const visibleRangeSubscription = window.onDidChangeTextEditorVisibleRanges(
      (e) => {
        if (e.textEditor === activeEditor && previewPanel) {
          const line = e.visibleRanges[0].start.line + 1; // Convert 0-based to 1-based
          previewPanel.webview.postMessage({ type: "scrollToLine", line });
        }
      },
    );

    previewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      selectionChangeSubscription.dispose();
      visibleRangeSubscription.dispose();
      previewPanel = undefined;
      activeEditor = undefined;
    });
  }

  // Update preview content
  updatePreview(previewPanel, context, document.getText());
};

const updatePreview = (
  previewPanel: WebviewPanel,
  context: ExtensionContext,
  content: string,
): void => {
  const [html] = compileToHTML(content);

  // Get webview URIs for CSS and JS files
  const cssUri = previewPanel.webview.asWebviewUri(
    Uri.joinPath(context.extensionUri, "media", "preview.css"),
  );
  const jsUri = previewPanel.webview.asWebviewUri(
    Uri.joinPath(context.extensionUri, "media", "preview.js"),
  );

  // Replace inline styles with external resources
  const htmlWithExternalResources = html.replace(
    "</head>",
    `<link rel="stylesheet" href="${cssUri}">
    <script src="${jsUri}"></script></head>`,
  );

  previewPanel.webview.html = htmlWithExternalResources;
};
