const vscode = require("vscode");
const path = require("path");
const os = require("os");
const fs = require("fs");
const fsPromises = require("fs/promises");
const axios = require("axios");
const FormData = require("form-data");
const yazl = require("yazl");

const API_SCAN_URL = "http://localhost:5000/api/scan";
const MAX_WORKSPACE_FILES = 100;
const MAX_FILE_SIZE_BYTES = 1024 * 1024;
const MAX_DISPLAY_RESULTS = 5;

const ALLOWED_WORKSPACE_EXTENSIONS = new Set([".js", ".ts", ".json"]);
const EXCLUDED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build"]);

/**
 * @typedef {"High" | "Medium" | "Low"} Severity
 */

/**
 * @typedef {object} ScanIssue
 * @property {string} id
 * @property {string} title
 * @property {Severity} severity
 * @property {string} explanation
 * @property {string} fix
 * @property {string} file
 * @property {number|string|undefined} line
 * @property {string|undefined} absoluteFilePath
 */

/**
 * @typedef {object} RuntimeState
 * @property {vscode.ExtensionContext} context
 * @property {vscode.WebviewPanel|undefined} panel
 * @property {Map<string, ScanIssue>} issuesById
 * @property {Map<string, ScanIssue[]>} issuesByFile
 * @property {ScanIssue[]} issues
 * @property {string} summary
 * @property {number|null} score
 * @property {{ High: vscode.TextEditorDecorationType, Medium: vscode.TextEditorDecorationType, Low: vscode.TextEditorDecorationType }} decorationTypes
 */

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const state = createRuntimeState(context);

    const scanCurrentFileCommand = vscode.commands.registerCommand(
        "aiSecurityReviewAgent.scanCurrentFile",
        async () => {
            await scanCurrentFile(state);
        }
    );

    const scanWorkspaceCommand = vscode.commands.registerCommand(
        "aiSecurityReviewAgent.scanWorkspace",
        async () => {
            await scanWorkspace(state);
        }
    );

    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            applyDecorationsForEditor(editor, state);
        }
    });

    context.subscriptions.push(
        scanCurrentFileCommand,
        scanWorkspaceCommand,
        activeEditorListener,
        state.decorationTypes.High,
        state.decorationTypes.Medium,
        state.decorationTypes.Low
    );
}

function deactivate() {
    // Disposables are released through context subscriptions.
}

/**
 * @param {RuntimeState} state
 */
async function scanCurrentFile(state) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("No active file to scan.");
        return;
    }

    const document = editor.document;
    const content = document.getText();

    if (!content.trim()) {
        vscode.window.showWarningMessage("The active file is empty.");
        return;
    }

    const panel = getOrCreateResultsPanel(state);
    panel.reveal(vscode.ViewColumn.Beside);
    panel.webview.postMessage({ type: "loading", message: "Scanning current file..." });
    vscode.window.showInformationMessage("Scan started...");

    try {
        const formData = new FormData();
        formData.append("file", Buffer.from(content, "utf8"), {
            filename: path.basename(document.fileName) || "untitled.js",
            contentType: "text/plain",
        });

        const scanData = await sendToBackend(formData);
        const normalized = normalizeScanResults(scanData, {
            scope: "current",
            workspaceRoot: getWorkspaceRootForUri(document.uri),
            currentFilePath: document.fileName,
        });

        updateIssuesState(state, normalized.issues, normalized.summary, normalized.score);
        renderResultsInWebview(state, "Current File");
        applyDecorationsToVisibleEditors(state);

        vscode.window.showInformationMessage("Scan completed");
    } catch (error) {
        const message = toErrorMessage(error);
        panel.webview.postMessage({ type: "error", message });
        vscode.window.showErrorMessage(message);
    }
}

/**
 * @param {RuntimeState} state
 */
async function scanWorkspace(state) {
    const workspaceRoot = getPrimaryWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
    }

    const panel = getOrCreateResultsPanel(state);
    panel.reveal(vscode.ViewColumn.Beside);
    panel.webview.postMessage({ type: "loading", message: "Scanning workspace..." });
    vscode.window.showInformationMessage("Scan started...");

    let zipPath;

    try {
        const files = await getWorkspaceFiles(workspaceRoot);
        if (!files.length) {
            const emptyMessage = "No eligible workspace files found to scan.";
            panel.webview.postMessage({ type: "error", message: emptyMessage });
            vscode.window.showWarningMessage(emptyMessage);
            return;
        }

        zipPath = await createWorkspaceZip(files);

        const formData = new FormData();
        formData.append("file", fs.createReadStream(zipPath), {
            filename: `workspace-scan-${Date.now()}.zip`,
            contentType: "application/zip",
        });

        const scanData = await sendToBackend(formData);
        const normalized = normalizeScanResults(scanData, {
            scope: "workspace",
            workspaceRoot,
            currentFilePath: undefined,
        });

        updateIssuesState(state, normalized.issues, normalized.summary, normalized.score);
        renderResultsInWebview(state, "Workspace");
        applyDecorationsToVisibleEditors(state);

        vscode.window.showInformationMessage("Scan completed");
    } catch (error) {
        const message = toErrorMessage(error);
        panel.webview.postMessage({ type: "error", message });
        vscode.window.showErrorMessage(message);
    } finally {
        if (zipPath) {
            await fsPromises.unlink(zipPath).catch(() => undefined);
        }
    }
}

/**
 * @param {RuntimeState} state
 * @param {string} issueId
 */
async function applyFix(issueId, state) {
    const issue = state.issuesById.get(issueId);
    if (!issue) {
        vscode.window.showErrorMessage("Unable to find issue for fix application.");
        return;
    }

    if (!issue.fix || !issue.fix.trim()) {
        vscode.window.showErrorMessage("This issue does not include an auto-fix snippet.");
        return;
    }

    if (!issue.absoluteFilePath) {
        vscode.window.showErrorMessage("No target file available to apply this fix.");
        return;
    }

    let document;
    try {
        document = await vscode.workspace.openTextDocument(issue.absoluteFilePath);
    } catch {
        vscode.window.showErrorMessage("Could not open file for fix application.");
        return;
    }

    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const range = resolveIssueRange(issue, document, editor);
    if (!range) {
        vscode.window.showErrorMessage(
            "Unable to determine vulnerable range. Select code manually and apply fix again."
        );
        return;
    }

    const safePatch = buildSafePatch(issue, document, range);
    if (!safePatch) {
        vscode.window.showErrorMessage(
            "No safe auto-fix could be generated. The model output was not valid code for this file."
        );
        return;
    }

    const didApply = await editor.edit((editBuilder) => {
        if (safePatch.mode === "document") {
            const fullRange = new vscode.Range(
                new vscode.Position(0, 0),
                document.lineAt(document.lineCount - 1).range.end
            );
            editBuilder.replace(fullRange, safePatch.text);
            return;
        }

        editBuilder.replace(range, safePatch.text);
    });

    if (!didApply) {
        vscode.window.showErrorMessage("Failed to apply fix in editor.");
        return;
    }

    vscode.window.showInformationMessage("Fix applied successfully");

    const remainingIssues = state.issues.filter((item) => item.id !== issueId);
    updateIssuesState(state, remainingIssues, state.summary, state.score);
    renderResultsInWebview(state, "Updated Results");
    applyDecorationsToVisibleEditors(state);
}

/**
 * @param {ScanIssue} issue
 * @param {vscode.TextDocument} document
 * @param {vscode.Range} range
 */
function buildSafePatch(issue, document, range) {
    const sanitizedFix = sanitizeFixSnippet(issue.fix, document);
    const selectedText = document.getText(range);

    if (isSecretIssue(issue)) {
        const hardenedDocument = hardenSecretAssignments(document.getText(), document.languageId);
        if (hardenedDocument && hardenedDocument !== document.getText()) {
            return { mode: "document", text: hardenedDocument };
        }
    }

    if (isInsecureHttpIssue(issue)) {
        const hardenedDocument = hardenInsecureHttpUsage(document.getText(), document.languageId);
        if (hardenedDocument && hardenedDocument !== document.getText()) {
            return { mode: "document", text: hardenedDocument };
        }
    }

    if (looksLikeValidCodeForLanguage(sanitizedFix, document.languageId)) {
        return { mode: "range", text: sanitizedFix };
    }

    if (isIamWildcardIssue(issue) && (document.languageId === "json" || document.languageId === "jsonc")) {
        const remediated = remediateIamPolicyDocument(document.getText());
        if (remediated) {
            return { mode: "document", text: remediated };
        }
    }

    if (isSecretIssue(issue)) {
        const hardened = hardenSecretAssignments(selectedText, document.languageId);
        if (hardened && hardened !== selectedText) {
            return { mode: "range", text: hardened };
        }
    }

    return null;
}

/**
 * @param {ScanIssue} issue
 */
function isIamWildcardIssue(issue) {
    const title = String(issue.title || "").toLowerCase();
    return title.includes("wildcard") || title.includes("iam") || title.includes("least-privilege");
}

/**
 * @param {ScanIssue} issue
 */
function isSecretIssue(issue) {
    const title = String(issue.title || "").toLowerCase();
    return (
        title.includes("secret") ||
        title.includes("api key") ||
        title.includes("token") ||
        title.includes("hardcoded") ||
        title.includes("password")
    );
}

/**
 * @param {ScanIssue} issue
 */
function isInsecureHttpIssue(issue) {
    const title = String(issue.title || "").toLowerCase();
    return (
        title.includes("http") ||
        title.includes("insecure transport") ||
        title.includes("insecure protocol") ||
        title.includes("use https")
    );
}

/**
 * @param {string} text
 * @param {string} languageId
 */
function looksLikeValidCodeForLanguage(text, languageId) {
    const value = String(text || "").trim();
    if (!value) {
        return false;
    }

    if (isLikelyNaturalLanguage(value)) {
        return false;
    }

    if (languageId === "json" || languageId === "jsonc") {
        const compact = value.replace(/\s+/g, " ");
        if (/replace wildcard actions/i.test(compact)) {
            return false;
        }
        return /[\{\}\[\]"]/.test(value) || /"\s*:/.test(value);
    }

    return /[;{}()[\]=]/.test(value) || /(const|let|var|function|=>|import|export)\s/.test(value);
}

/**
 * @param {string} text
 */
function isLikelyNaturalLanguage(text) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) {
        return true;
    }

    const words = normalized.split(" ");
    const hasLongSentence = words.length >= 8 && /[a-zA-Z]{3,}/.test(normalized);
    const codeSignal = /[{}()[\];:=]|=>|\"\s*:|\bconst\b|\blet\b|\bfunction\b/.test(normalized);

    return hasLongSentence && !codeSignal;
}

/**
 * Attempts deterministic least-privilege IAM action cleanup for wildcard actions.
 * @param {string} jsonText
 */
function remediateIamPolicyDocument(jsonText) {
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        return null;
    }

    const statements = Array.isArray(parsed?.Statement)
        ? parsed.Statement
        : parsed?.Statement
            ? [parsed.Statement]
            : [];

    let changed = false;

    for (const statement of statements) {
        if (!statement || typeof statement !== "object") {
            continue;
        }

        const resources = Array.isArray(statement.Resource)
            ? statement.Resource
            : typeof statement.Resource === "string"
                ? [statement.Resource]
                : [];

        const inferredActions = inferLeastPrivilegeActions(resources);
        if (!inferredActions.length) {
            continue;
        }

        if (typeof statement.Action === "string") {
            if (statement.Action.trim() === "*") {
                statement.Action = inferredActions;
                changed = true;
            }
            continue;
        }

        if (Array.isArray(statement.Action)) {
            const before = statement.Action.map((item) => String(item).trim());
            const filtered = before.filter((item) => item && item !== "*");

            if (filtered.length !== before.length) {
                statement.Action = filtered.length ? filtered : inferredActions;
                changed = true;
            }
        }
    }

    if (!changed) {
        return null;
    }

    return JSON.stringify(parsed, null, 2);
}

/**
 * @param {string[]} resources
 */
function inferLeastPrivilegeActions(resources) {
    const joined = resources.join(" ").toLowerCase();

    if (joined.includes(":s3:::") || joined.includes("arn:aws:s3")) {
        return ["s3:GetObject", "s3:PutObject", "s3:ListBucket"];
    }

    if (joined.includes(":dynamodb:") || joined.includes("arn:aws:dynamodb")) {
        return ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"];
    }

    if (joined.includes(":sns:") || joined.includes("arn:aws:sns")) {
        return ["sns:Publish"];
    }

    if (joined.includes(":sqs:") || joined.includes("arn:aws:sqs")) {
        return ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"];
    }

    return [];
}

/**
 * Replaces obvious hardcoded secret assignments with process.env lookups.
 * @param {string} source
 * @param {string} languageId
 */
function hardenSecretAssignments(source, languageId) {
    const value = String(source || "");

    if (languageId === "javascript" || languageId === "typescript" || languageId === "javascriptreact" || languageId === "typescriptreact") {
        const assignmentPattern = /(\b(?:const|let|var)\s+)?([A-Za-z_][A-Za-z0-9_]*(?:api[_-]?key|secret|token|password)[A-Za-z0-9_]*)\s*([:=])\s*(["'`])([^"'`]+)\4/gi;
        const objectPattern = /(["'])([A-Za-z_][A-Za-z0-9_]*(?:api[_-]?key|secret|token|password)[A-Za-z0-9_]*)\1\s*:\s*(["'`])([^"'`]+)\3/gi;

        let hardened = value.replace(assignmentPattern, (full, declaration, keyName, operator) => {
            const envKey = toEnvKey(keyName) || "REPLACE_WITH_SECRET";
            const declarationPrefix = declaration || "";
            return `${declarationPrefix}${keyName} ${operator} process.env.${envKey}`;
        });

        hardened = hardened.replace(objectPattern, (full, quote, keyName) => {
            const envKey = toEnvKey(keyName) || "REPLACE_WITH_SECRET";
            return `${quote}${keyName}${quote}: process.env.${envKey}`;
        });

        return hardened;
    }

    return value;
}

/**
 * @param {string} source
 * @param {string} languageId
 */
function hardenInsecureHttpUsage(source, languageId) {
    const value = String(source || "");

    if (languageId === "javascript" || languageId === "typescript" || languageId === "javascriptreact" || languageId === "typescriptreact" || languageId === "html") {
        return value.replace(/http:\/\//gi, "https://");
    }

    if (languageId === "json" || languageId === "jsonc") {
        return value.replace(/"http:\/\//gi, '"https://');
    }

    return value;
}

/**
 * @param {string} name
 */
function toEnvKey(name) {
    return String(name || "")
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase();
}

/**
 * Removes markdown fences and plain-English advice so only code is applied.
 * @param {string} fix
 * @param {vscode.TextDocument} document
 */
function sanitizeFixSnippet(fix, document) {
    let cleaned = String(fix || "")
        .replace(/```[a-zA-Z0-9_-]*\n?/g, "")
        .replace(/```/g, "")
        .trim();

    if (!cleaned) {
        return "";
    }

    if (document.languageId === "json" || document.languageId === "jsonc") {
        const filteredLines = cleaned
            .split(/\r?\n/)
            .map((line) => line.trimEnd())
            .filter((line) => {
                const value = line.trim();
                if (!value) {
                    return false;
                }

                if (/^replace\s+wildcard\s+actions?/i.test(value)) {
                    return false;
                }

                if (/^(explanation|suggested\s+fix|recommended\s+fix)\s*:?/i.test(value)) {
                    return false;
                }

                if (/^[\{\}\[\],]/.test(value)) {
                    return true;
                }

                if (/^"/.test(value)) {
                    return true;
                }

                if (/^(true|false|null|-?\d+(\.\d+)?)$/i.test(value)) {
                    return true;
                }

                return /^[A-Za-z0-9_\-"']+\s*:/.test(value);
            });

        if (filteredLines.length > 0) {
            cleaned = filteredLines.join("\n").trim();
        }
    }

    return cleaned;
}

/**
 * @param {RuntimeState} state
 */
function getOrCreateResultsPanel(state) {
    if (state.panel) {
        return state.panel;
    }

    const panel = vscode.window.createWebviewPanel(
        "aiSecurityReviewAgent.results",
        "AI Security Review Agent",
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
        }
    );

    panel.webview.html = getWebviewHtml();

    panel.webview.onDidReceiveMessage(
        async (message) => {
            if (message?.command === "applyFix" && typeof message.issueId === "string") {
                await applyFix(message.issueId, state);
            }
        },
        null,
        state.context.subscriptions
    );

    panel.onDidDispose(() => {
        state.panel = undefined;
    });

    state.panel = panel;
    return panel;
}

/**
 * @param {FormData} formData
 */
async function sendToBackend(formData) {
    const response = await axios.post(API_SCAN_URL, formData, {
        headers: formData.getHeaders(),
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
    });

    if (response.status >= 400) {
        const backendMessage =
            response.data?.message || response.data?.error || `Backend scan failed (${response.status})`;
        throw new Error(backendMessage);
    }

    const payload = response.data;
    const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;

    if (!data || typeof data !== "object") {
        throw new Error("Backend returned an invalid scan response.");
    }

    return {
        results: Array.isArray(data.results) ? data.results : [],
        summary: typeof data.summary === "string" ? data.summary : "",
        score: typeof data.score === "number" ? data.score : null,
    };
}

/**
 * @param {{ results: any[], summary: string, score: number | null }} scanData
 * @param {{ scope: "current" | "workspace", workspaceRoot: string|undefined, currentFilePath: string|undefined }} context
 */
function normalizeScanResults(scanData, context) {
    const normalizedIssues = scanData.results
        .map((issue, index) => normalizeIssue(issue, index, context))
        .filter(Boolean)
        .slice(0, MAX_DISPLAY_RESULTS);

    return {
        issues: normalizedIssues,
        summary: scanData.summary || "No summary provided.",
        score: scanData.score,
    };
}

/**
 * @param {any} issue
 * @param {number} index
 * @param {{ scope: "current" | "workspace", workspaceRoot: string|undefined, currentFilePath: string|undefined }} context
 * @returns {ScanIssue|null}
 */
function normalizeIssue(issue, index, context) {
    if (!issue || typeof issue !== "object") {
        return null;
    }

    const fileFromBackend = typeof issue.file === "string" ? issue.file : "";
    const absoluteFilePath = resolveAbsoluteFilePath(fileFromBackend, context);

    return {
        id: `issue-${Date.now()}-${index}`,
        title: typeof issue.title === "string" ? issue.title : "Untitled issue",
        severity: normalizeSeverity(issue.severity),
        explanation:
            typeof issue.explanation === "string" && issue.explanation.trim()
                ? issue.explanation
                : "No explanation provided.",
        fix: typeof issue.fix === "string" ? issue.fix : "",
        file: fileFromBackend || (absoluteFilePath ? path.basename(absoluteFilePath) : "Unknown file"),
        line: issue.line,
        absoluteFilePath,
    };
}

/**
 * @param {string} fileFromBackend
 * @param {{ scope: "current" | "workspace", workspaceRoot: string|undefined, currentFilePath: string|undefined }} context
 */
function resolveAbsoluteFilePath(fileFromBackend, context) {
    if (context.scope === "current" && context.currentFilePath) {
        return context.currentFilePath;
    }

    if (!fileFromBackend) {
        return context.currentFilePath;
    }

    if (path.isAbsolute(fileFromBackend)) {
        return fileFromBackend;
    }

    if (context.workspaceRoot) {
        return path.resolve(context.workspaceRoot, fileFromBackend);
    }

    return context.currentFilePath;
}

/**
 * @param {RuntimeState} state
 * @param {ScanIssue[]} issues
 * @param {string} summary
 * @param {number | null} score
 */
function updateIssuesState(state, issues, summary, score) {
    state.issues = issues;
    state.summary = summary;
    state.score = score;
    state.issuesById = new Map();
    state.issuesByFile = new Map();

    for (const issue of issues) {
        state.issuesById.set(issue.id, issue);

        if (!issue.absoluteFilePath) {
            continue;
        }

        const existing = state.issuesByFile.get(issue.absoluteFilePath) || [];
        existing.push(issue);
        state.issuesByFile.set(issue.absoluteFilePath, existing);
    }
}

/**
 * @param {RuntimeState} state
 * @param {string} scope
 */
function renderResultsInWebview(state, scope) {
    const panel = getOrCreateResultsPanel(state);

    panel.webview.postMessage({
        type: "results",
        payload: {
            scope,
            summary: state.summary,
            score: state.score,
            issues: state.issues,
        },
    });
}

/**
 * @param {RuntimeState} state
 */
function applyDecorationsToVisibleEditors(state) {
    for (const editor of vscode.window.visibleTextEditors) {
        applyDecorationsForEditor(editor, state);
    }
}

/**
 * @param {vscode.TextEditor} editor
 * @param {RuntimeState} state
 */
function applyDecorationsForEditor(editor, state) {
    const filePath = editor.document.uri.fsPath;
    const issues = state.issuesByFile.get(filePath) || [];

    /** @type {vscode.DecorationOptions[]} */
    const high = [];
    /** @type {vscode.DecorationOptions[]} */
    const medium = [];
    /** @type {vscode.DecorationOptions[]} */
    const low = [];

    for (const issue of issues) {
        const range = resolveIssueRange(issue, editor.document, editor);
        if (!range) {
            continue;
        }

        const hoverMessage = new vscode.MarkdownString(
            `${issue.title}\n\nSeverity: ${issue.severity}\n\n${issue.explanation}`
        );

        const decorationOption = { range, hoverMessage };

        if (issue.severity === "High") {
            high.push(decorationOption);
        } else if (issue.severity === "Medium") {
            medium.push(decorationOption);
        } else {
            low.push(decorationOption);
        }
    }

    editor.setDecorations(state.decorationTypes.High, high);
    editor.setDecorations(state.decorationTypes.Medium, medium);
    editor.setDecorations(state.decorationTypes.Low, low);
}

/**
 * @param {ScanIssue} issue
 * @param {vscode.TextDocument} document
 * @param {vscode.TextEditor|undefined} editor
 */
function resolveIssueRange(issue, document, editor) {
    const parsed = parseLineRange(issue.line);
    if (parsed) {
        const startLine = Math.max(0, Math.min(document.lineCount - 1, parsed.start - 1));
        const endLine = Math.max(startLine, Math.min(document.lineCount - 1, parsed.end - 1));

        const start = new vscode.Position(startLine, 0);
        const end = document.lineAt(endLine).range.end;
        return new vscode.Range(start, end);
    }

    if (editor && !editor.selection.isEmpty) {
        return new vscode.Range(editor.selection.start, editor.selection.end);
    }

    return null;
}

/**
 * @param {number|string|undefined} line
 */
function parseLineRange(line) {
    if (typeof line === "number" && Number.isFinite(line)) {
        const fixed = Math.max(1, Math.floor(line));
        return { start: fixed, end: fixed };
    }

    if (typeof line !== "string") {
        return null;
    }

    const matches = line.match(/\d+/g);
    if (!matches || !matches.length) {
        return null;
    }

    const start = Math.max(1, Number(matches[0]));
    const end = matches[1] ? Math.max(start, Number(matches[1])) : start;

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
    }

    return { start, end };
}

/**
 * @param {Severity|string|undefined} severity
 * @returns {Severity}
 */
function normalizeSeverity(severity) {
    const normalized = String(severity || "").toLowerCase();

    if (normalized === "high") {
        return "High";
    }

    if (normalized === "medium") {
        return "Medium";
    }

    return "Low";
}

/**
 * @param {string} workspaceRoot
 */
async function getWorkspaceFiles(workspaceRoot) {
    /** @type {{ absolutePath: string, relativePath: string }[]} */
    const selected = [];
    const queue = [workspaceRoot];

    while (queue.length && selected.length < MAX_WORKSPACE_FILES) {
        const currentDir = queue.shift();
        if (!currentDir) {
            break;
        }

        /** @type {import("node:fs").Dirent[]} */
        let entries;
        try {
            entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (selected.length >= MAX_WORKSPACE_FILES) {
                break;
            }

            const fullPath = path.join(currentDir, entry.name);
            const entryNameLower = entry.name.toLowerCase();

            if (entry.isDirectory()) {
                if (!EXCLUDED_DIRECTORIES.has(entryNameLower)) {
                    queue.push(fullPath);
                }
                continue;
            }

            if (!entry.isFile()) {
                continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            const isDotEnv = entry.name === ".env";

            if (!isDotEnv && !ALLOWED_WORKSPACE_EXTENSIONS.has(ext)) {
                continue;
            }

            let stat;
            try {
                stat = await fsPromises.stat(fullPath);
            } catch {
                continue;
            }

            if (stat.size > MAX_FILE_SIZE_BYTES) {
                continue;
            }

            selected.push({
                absolutePath: fullPath,
                relativePath: path.relative(workspaceRoot, fullPath),
            });
        }
    }

    return selected;
}

/**
 * @param {{ absolutePath: string, relativePath: string }[]} files
 */
async function createWorkspaceZip(files) {
    const zipPath = path.join(os.tmpdir(), `ai-security-review-${Date.now()}.zip`);

    await new Promise((resolve, reject) => {
        const zipFile = new yazl.ZipFile();
        const output = fs.createWriteStream(zipPath);

        output.on("close", () => resolve());
        output.on("error", reject);
        zipFile.outputStream.on("error", reject).pipe(output);

        for (const file of files) {
            zipFile.addFile(file.absolutePath, file.relativePath);
        }

        zipFile.end();
    });

    return zipPath;
}

function getPrimaryWorkspaceRoot() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || !folders.length) {
        return undefined;
    }

    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
    if (activeEditorUri) {
        const activeFolder = vscode.workspace.getWorkspaceFolder(activeEditorUri);
        if (activeFolder) {
            return activeFolder.uri.fsPath;
        }
    }

    return folders[0].uri.fsPath;
}

/**
 * @param {vscode.Uri} uri
 */
function getWorkspaceRootForUri(uri) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    return folder?.uri.fsPath;
}

/**
 * @param {vscode.ExtensionContext} context
 * @returns {RuntimeState}
 */
function createRuntimeState(context) {
    return {
        context,
        panel: undefined,
        issuesById: new Map(),
        issuesByFile: new Map(),
        issues: [],
        summary: "",
        score: null,
        decorationTypes: {
            High: vscode.window.createTextEditorDecorationType({
                textDecoration: "underline wavy #ff4d4f",
                overviewRulerColor: "#ff4d4f",
                overviewRulerLane: vscode.OverviewRulerLane.Right,
            }),
            Medium: vscode.window.createTextEditorDecorationType({
                textDecoration: "underline wavy #f4c430",
                overviewRulerColor: "#f4c430",
                overviewRulerLane: vscode.OverviewRulerLane.Right,
            }),
            Low: vscode.window.createTextEditorDecorationType({
                textDecoration: "underline wavy #42be65",
                overviewRulerColor: "#42be65",
                overviewRulerLane: vscode.OverviewRulerLane.Right,
            }),
        },
    };
}

/**
 * @param {unknown} error
 */
function toErrorMessage(error) {
    if (axios.isAxiosError(error)) {
        const backendMessage =
            error.response?.data?.message || error.response?.data?.error || error.message;
        return backendMessage || "Unable to complete scan request.";
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Unknown error occurred.";
}

function getWebviewHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Security Review Agent</title>
    <style>
        :root {
            color-scheme: dark;
            --bg: var(--vscode-editor-background);
            --panel: color-mix(in srgb, var(--vscode-editor-background) 78%, #0f141a 22%);
            --panel-soft: color-mix(in srgb, var(--vscode-editor-background) 86%, #1b222b 14%);
            --border: color-mix(in srgb, var(--vscode-widget-border, #2a2a2a) 70%, #3f4954 30%);
            --text: var(--vscode-editor-foreground);
            --muted: var(--vscode-descriptionForeground, #9aa6b2);
            --brand: #2eaadc;
            --brand-glow: #56d3ff;
            --high: #ff5f56;
            --medium: #f7b529;
            --low: #29c27c;
            --shadow: 0 14px 32px rgba(0, 0, 0, 0.28);
        }

        * {
            box-sizing: border-box;
            font-family: var(--vscode-font-family);
        }

        body {
            margin: 0;
            padding: 14px;
            color: var(--text);
            background:
                radial-gradient(1200px 600px at 88% -5%, rgba(46, 170, 220, 0.13), transparent 45%),
                radial-gradient(900px 420px at -10% 120%, rgba(86, 211, 255, 0.08), transparent 45%),
                var(--bg);
        }

        .hidden {
            display: none;
        }

        .card {
            position: relative;
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 14px;
            box-shadow: var(--shadow);
            margin-bottom: 12px;
            overflow: hidden;
        }

        .hero {
            padding: 14px;
            background:
                linear-gradient(120deg, rgba(46, 170, 220, 0.15), rgba(8, 12, 18, 0) 42%),
                var(--panel);
        }

        .hero-top {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: flex-start;
        }

        .title {
            margin: 0;
            font-size: 15px;
            letter-spacing: 0.01em;
            font-weight: 700;
        }

        .subtitle {
            margin: 4px 0 0;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.45;
        }

        .scope-pill {
            border: 1px solid color-mix(in srgb, var(--brand) 45%, transparent 55%);
            color: var(--brand-glow);
            background: color-mix(in srgb, var(--brand) 14%, transparent 86%);
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 11px;
            white-space: nowrap;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 700;
        }

        .stats {
            margin-top: 12px;
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
        }

        .stat {
            background: var(--panel-soft);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 8px;
            min-height: 58px;
        }

        .stat .k {
            font-size: 11px;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 4px;
        }

        .stat .v {
            font-size: 18px;
            font-weight: 700;
        }

        .v-high {
            color: var(--high);
        }

        .v-medium {
            color: var(--medium);
        }

        .v-low {
            color: var(--low);
        }

        .status-card {
            padding: 14px;
            text-align: center;
            color: var(--muted);
            line-height: 1.5;
        }

        .loading-dots::after {
            content: "";
            display: inline-block;
            width: 18px;
            text-align: left;
            animation: dots 1.2s infinite;
        }

        @keyframes dots {
            0% { content: ""; }
            33% { content: "."; }
            66% { content: ".."; }
            100% { content: "..."; }
        }

        .summary-card {
            padding: 14px;
        }

        .summary-label {
            margin: 0 0 8px;
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.09em;
        }

        .summary-body {
            margin: 0;
            line-height: 1.55;
            font-size: 13px;
            white-space: pre-wrap;
        }

        .issues-wrap {
            display: grid;
            gap: 12px;
        }

        .file-group {
            border-radius: 12px;
            border: 1px solid var(--border);
            overflow: hidden;
            background: var(--panel-soft);
        }

        .file-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            background: color-mix(in srgb, var(--panel-soft) 82%, #0f151e 18%);
        }

        .file-title {
            margin: 0;
            font-size: 12px;
            color: var(--muted);
            letter-spacing: 0.04em;
            text-transform: uppercase;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .file-count {
            font-size: 11px;
            color: var(--muted);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 2px 8px;
        }

        .issues-list {
            padding: 10px;
            display: grid;
            gap: 10px;
        }

        .issue-card {
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--panel);
            padding: 11px;
            animation: riseIn 220ms ease-out;
        }

        @keyframes riseIn {
            from { transform: translateY(5px); opacity: 0.45; }
            to { transform: translateY(0); opacity: 1; }
        }

        .issue-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 8px;
        }

        .issue-title {
            margin: 0;
            font-size: 14px;
            line-height: 1.4;
            font-weight: 700;
        }

        .severity-badge {
            font-size: 10px;
            font-weight: 800;
            border-radius: 999px;
            padding: 4px 8px;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            border: 1px solid transparent;
            flex-shrink: 0;
        }

        .severity-high {
            color: var(--high);
            border-color: color-mix(in srgb, var(--high) 60%, transparent 40%);
            background: color-mix(in srgb, var(--high) 16%, transparent 84%);
        }

        .severity-medium {
            color: var(--medium);
            border-color: color-mix(in srgb, var(--medium) 60%, transparent 40%);
            background: color-mix(in srgb, var(--medium) 16%, transparent 84%);
        }

        .severity-low {
            color: var(--low);
            border-color: color-mix(in srgb, var(--low) 60%, transparent 40%);
            background: color-mix(in srgb, var(--low) 16%, transparent 84%);
        }

        .meta-line {
            color: var(--muted);
            font-size: 11px;
            margin-bottom: 8px;
        }

        .block-label {
            margin: 10px 0 4px;
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .block-body {
            margin: 0;
            line-height: 1.5;
            font-size: 12px;
            white-space: pre-wrap;
        }

        .fix-snippet {
            margin: 0;
            margin-top: 4px;
            padding: 9px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: color-mix(in srgb, var(--panel) 78%, #0b1016 22%);
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            line-height: 1.45;
            white-space: pre-wrap;
            overflow-x: auto;
        }

        .apply-btn {
            margin-top: 10px;
            border: 1px solid color-mix(in srgb, var(--brand) 60%, transparent 40%);
            border-radius: 8px;
            padding: 7px 11px;
            cursor: pointer;
            color: #d8f3ff;
            background: linear-gradient(180deg, color-mix(in srgb, var(--brand) 36%, #122331 64%), color-mix(in srgb, var(--brand) 28%, #081017 72%));
            transition: transform 90ms ease, filter 130ms ease;
            font-size: 12px;
            font-weight: 600;
        }

        .apply-btn:hover {
            filter: brightness(1.08);
        }

        .apply-btn:active {
            transform: translateY(1px);
        }

        @media (max-width: 680px) {
            .stats {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .hero-top {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <section class="card hero">
        <div class="hero-top">
            <div>
                <h1 class="title">AI Security Review Agent</h1>
                <p class="subtitle">AI-assisted vulnerability triage with instant editor fixes.</p>
            </div>
            <div id="scopePill" class="scope-pill">Awaiting Scan</div>
        </div>
        <div id="stats" class="stats">
            <div class="stat"><div class="k">Total Issues</div><div class="v" id="statTotal">0</div></div>
            <div class="stat"><div class="k">High</div><div class="v v-high" id="statHigh">0</div></div>
            <div class="stat"><div class="k">Medium</div><div class="v v-medium" id="statMedium">0</div></div>
            <div class="stat"><div class="k">Low</div><div class="v v-low" id="statLow">0</div></div>
        </div>
    </section>

    <section id="loading" class="card status-card loading-dots">Scanning</section>
    <section id="error" class="card status-card hidden"></section>
    <section id="summary" class="card summary-card hidden"></section>
    <section id="issues" class="issues-wrap hidden"></section>

    <script>
        const vscodeApi = acquireVsCodeApi();

        const state = {
            loading: true,
            error: "",
            scope: "",
            summary: "",
            score: null,
            issues: [],
        };

        const loadingEl = document.getElementById("loading");
        const errorEl = document.getElementById("error");
        const summaryEl = document.getElementById("summary");
        const issuesEl = document.getElementById("issues");
        const scopePillEl = document.getElementById("scopePill");
        const statTotalEl = document.getElementById("statTotal");
        const statHighEl = document.getElementById("statHigh");
        const statMediumEl = document.getElementById("statMedium");
        const statLowEl = document.getElementById("statLow");

        function escapeHtml(text) {
            return String(text)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#39;");
        }

        function severityClass(severity) {
            if (severity === "High") return "severity-high";
            if (severity === "Medium") return "severity-medium";
            return "severity-low";
        }

        function computeCounts() {
            const counts = { total: state.issues.length, high: 0, medium: 0, low: 0 };

            for (const issue of state.issues) {
                if (issue.severity === "High") {
                    counts.high += 1;
                } else if (issue.severity === "Medium") {
                    counts.medium += 1;
                } else {
                    counts.low += 1;
                }
            }

            return counts;
        }

        function renderHeaderStats() {
            const counts = computeCounts();
            statTotalEl.textContent = String(counts.total);
            statHighEl.textContent = String(counts.high);
            statMediumEl.textContent = String(counts.medium);
            statLowEl.textContent = String(counts.low);

            if (state.scope) {
                scopePillEl.textContent = state.scope + " Scan";
            }
        }

        function renderSummary() {
            summaryEl.innerHTML = "";

            const label = document.createElement("p");
            label.className = "summary-label";
            label.textContent = "Summary";

            const body = document.createElement("p");
            body.className = "summary-body";
            body.textContent = state.summary || "No summary available.";

            const score = document.createElement("p");
            score.className = "summary-label";
            score.style.marginTop = "10px";
            score.textContent =
                typeof state.score === "number" ? "Risk Score: " + state.score : "Risk Score: N/A";

            summaryEl.appendChild(label);
            summaryEl.appendChild(body);
            summaryEl.appendChild(score);
        }

        function createIssueCard(issue) {
            const card = document.createElement("article");
            card.className = "issue-card";

            const lineText = issue.line ? "Line: " + issue.line : "Line: not provided";

            card.innerHTML =
                '<div class="issue-top">' +
                    '<h3 class="issue-title">' + escapeHtml(issue.title || "Untitled issue") + '</h3>' +
                    '<span class="severity-badge ' + severityClass(issue.severity) + '">' + escapeHtml(issue.severity || "Low") + '</span>' +
                '</div>' +
                '<div class="meta-line">' + escapeHtml(lineText) + '</div>' +
                '<p class="block-label">Explanation</p>' +
                '<p class="block-body">' + escapeHtml(issue.explanation || "No explanation provided.") + '</p>' +
                '<p class="block-label">Suggested Fix</p>' +
                '<pre class="fix-snippet">' + escapeHtml(issue.fix || "No fix provided.") + '</pre>';

            const applyButton = document.createElement("button");
            applyButton.className = "apply-btn";
            applyButton.textContent = "Apply Fix";
            applyButton.addEventListener("click", () => {
                vscodeApi.postMessage({ command: "applyFix", issueId: issue.id });
            });

            card.appendChild(applyButton);
            return card;
        }

        function renderIssues() {
            issuesEl.innerHTML = "";

            if (!state.issues.length) {
                const empty = document.createElement("section");
                empty.className = "card status-card";
                empty.textContent = "No vulnerabilities found in the latest scan.";
                issuesEl.appendChild(empty);
                return;
            }

            const grouped = new Map();
            for (const issue of state.issues) {
                const file = issue.file || "Unknown file";
                if (!grouped.has(file)) {
                    grouped.set(file, []);
                }
                grouped.get(file).push(issue);
            }

            for (const [file, fileIssues] of grouped.entries()) {
                const group = document.createElement("section");
                group.className = "file-group";

                const header = document.createElement("div");
                header.className = "file-header";
                header.innerHTML =
                    '<p class="file-title">' + escapeHtml(file) + '</p>' +
                    '<span class="file-count">' + fileIssues.length + ' issue(s)</span>';

                const list = document.createElement("div");
                list.className = "issues-list";

                for (const issue of fileIssues) {
                    list.appendChild(createIssueCard(issue));
                }

                group.appendChild(header);
                group.appendChild(list);
                issuesEl.appendChild(group);
            }
        }

        function render() {
            renderHeaderStats();

            loadingEl.classList.toggle("hidden", !state.loading);
            errorEl.classList.toggle("hidden", !state.error);
            summaryEl.classList.toggle("hidden", state.loading || Boolean(state.error));
            issuesEl.classList.toggle("hidden", state.loading || Boolean(state.error));

            if (state.error) {
                errorEl.textContent = state.error;
                return;
            }

            if (state.loading) {
                loadingEl.textContent = "Scanning";
                return;
            }

            renderSummary();
            renderIssues();
        }

        window.addEventListener("message", (event) => {
            const message = event.data || {};

            if (message.type === "loading") {
                state.loading = true;
                state.error = "";
                loadingEl.textContent = message.message || "Scanning";
                render();
                return;
            }

            if (message.type === "error") {
                state.loading = false;
                state.error = message.message || "An error occurred.";
                render();
                return;
            }

            if (message.type === "results") {
                state.loading = false;
                state.error = "";
                state.scope = message.payload?.scope || "";
                state.summary = message.payload?.summary || "";
                state.score = message.payload?.score ?? null;
                state.issues = Array.isArray(message.payload?.issues) ? message.payload.issues : [];
                render();
            }
        });

        render();
    </script>
</body>
</html>`;
}

module.exports = {
    activate,
    deactivate,
};