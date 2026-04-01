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
    emitPanelState(state, "initializing", "Preparing current file scan", true);
    vscode.window.showInformationMessage("Scan started...");

    try {
        emitPanelState(state, "payload", "Building file payload", true);
        const formData = new FormData();
        formData.append("file", Buffer.from(content, "utf8"), {
            filename: path.basename(document.fileName) || "untitled.js",
            contentType: "text/plain",
        });

        emitPanelState(state, "api_call", "Sending file to scanner API", true);
        const scanData = await sendToBackend(formData);
        emitPanelState(state, "normalizing", "Normalizing scan response", true);
        const normalized = normalizeScanResults(scanData, {
            scope: "current",
            workspaceRoot: getWorkspaceRootForUri(document.uri),
            currentFilePath: document.fileName,
        });

        updateIssuesState(state, normalized.issues, normalized.summary, normalized.score);
        renderResultsInWebview(state, "Current File");
        emitPanelState(state, "decorate", "Applying highlights to editor", true);
        applyDecorationsToVisibleEditors(state);
        emitPanelState(state, "completed", "Current file scan completed", false);

        vscode.window.showInformationMessage("Scan completed");
    } catch (error) {
        const message = toErrorMessage(error);
        emitPanelState(state, "failed", message, false);
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
    emitPanelState(state, "initializing", "Preparing workspace scan", true);
    vscode.window.showInformationMessage("Scan started...");

    let zipPath;

    try {
        emitPanelState(state, "discovery", "Collecting eligible workspace files", true);
        const files = await getWorkspaceFiles(workspaceRoot);
        if (!files.length) {
            const emptyMessage = "No eligible workspace files found to scan.";
            emitPanelState(state, "failed", emptyMessage, false);
            panel.webview.postMessage({ type: "error", message: emptyMessage });
            vscode.window.showWarningMessage(emptyMessage);
            return;
        }

        emitPanelState(state, "packaging", "Creating workspace zip archive", true);
        zipPath = await createWorkspaceZip(files);

        emitPanelState(state, "api_call", "Uploading archive to scanner API", true);
        const formData = new FormData();
        formData.append("file", fs.createReadStream(zipPath), {
            filename: `workspace-scan-${Date.now()}.zip`,
            contentType: "application/zip",
        });

        const scanData = await sendToBackend(formData);
        emitPanelState(state, "normalizing", "Processing API scan results", true);
        const normalized = normalizeScanResults(scanData, {
            scope: "workspace",
            workspaceRoot,
            currentFilePath: undefined,
        });

        updateIssuesState(state, normalized.issues, normalized.summary, normalized.score);
        renderResultsInWebview(state, "Workspace");
        emitPanelState(state, "decorate", "Applying highlights to open editors", true);
        applyDecorationsToVisibleEditors(state);
        emitPanelState(state, "completed", "Workspace scan completed", false);

        vscode.window.showInformationMessage("Scan completed");
    } catch (error) {
        const message = toErrorMessage(error);
        emitPanelState(state, "failed", message, false);
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
    emitPanelState(state, "fix_prepare", "Preparing auto-fix", true);
    const issue = state.issuesById.get(issueId);
    if (!issue) {
        emitPanelState(state, "fix_failed", "Unable to find issue for fix application", false);
        vscode.window.showErrorMessage("Unable to find issue for fix application.");
        return;
    }

    if (!issue.fix || !issue.fix.trim()) {
        emitPanelState(state, "fix_failed", "Issue does not include an auto-fix snippet", false);
        vscode.window.showErrorMessage("This issue does not include an auto-fix snippet.");
        return;
    }

    if (!issue.absoluteFilePath) {
        emitPanelState(state, "fix_failed", "No target file available for fix application", false);
        vscode.window.showErrorMessage("No target file available to apply this fix.");
        return;
    }

    let document;
    try {
        document = await vscode.workspace.openTextDocument(issue.absoluteFilePath);
    } catch {
        emitPanelState(state, "fix_failed", "Could not open target file for fix application", false);
        vscode.window.showErrorMessage("Could not open file for fix application.");
        return;
    }

    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const range = resolveIssueRange(issue, document, editor);
    if (!range) {
        emitPanelState(state, "fix_failed", "Unable to determine vulnerable range", false);
        vscode.window.showErrorMessage(
            "Unable to determine vulnerable range. Select code manually and apply fix again."
        );
        return;
    }

    emitPanelState(state, "fix_build", "Generating safe patch", true);
    const safePatch = buildSafePatch(issue, document, range);
    if (!safePatch) {
        emitPanelState(state, "fix_failed", "No safe auto-fix could be generated", false);
        vscode.window.showErrorMessage(
            "No safe auto-fix could be generated. The model output was not valid code for this file."
        );
        return;
    }

    emitPanelState(state, "fix_apply", "Applying patch to editor", true);
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
        emitPanelState(state, "fix_failed", "Failed to apply fix in editor", false);
        vscode.window.showErrorMessage("Failed to apply fix in editor.");
        return;
    }

    emitPanelState(state, "fix_done", "Fix applied successfully", false);
    vscode.window.showInformationMessage("Fix applied successfully");

    const remainingIssues = state.issues.filter((item) => item.id !== issueId);
    updateIssuesState(state, remainingIssues, state.summary, state.score);
    renderResultsInWebview(state, "Updated Results");
    applyDecorationsToVisibleEditors(state);
}

/**
 * @param {RuntimeState} state
 * @param {string} stage
 * @param {string} detail
 * @param {boolean} loading
 */
function emitPanelState(state, stage, detail, loading) {
    if (!state.panel) {
        return;
    }

    state.panel.webview.postMessage({
        type: "state",
        stage,
        detail,
        loading,
        timestamp: new Date().toISOString(),
    });

    if (loading) {
        state.panel.webview.postMessage({ type: "loading", message: detail || "Working..." });
    }
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
            --bg: #090809;
            --shell: #120d0e;
            --panel: #180f10;
            --panel-2: #231314;
            --line: #3a1a1d;
            --line-2: #5a2326;
            --text: #fff2f0;
            --muted: #f3b8b2;
            --high: #f40000;
            --medium: #f44e3f;
            --low: #f4796b;
            --accent: #f4998d;
            --accent-2: #f44e3f;
            --glow: rgba(244, 0, 0, 0.24);
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            padding: 10px;
            background: var(--bg);
            color: var(--text);
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 12px;
            line-height: 1.45;
        }

        .hidden { display: none; }

        .terminal-shell {
            border: 1px solid var(--line);
            background: linear-gradient(180deg, rgba(25, 14, 15, 0.98), rgba(10, 7, 8, 0.98));
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 0 1px rgba(244, 78, 63, 0.08), 0 18px 40px rgba(0, 0, 0, 0.45);
        }

        .topbar {
            padding: 9px 12px;
            border-bottom: 1px solid var(--line);
            color: var(--muted);
            background: linear-gradient(90deg, #120d0e, #1d0f10);
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #f3fff5;
            font-weight: 700;
            letter-spacing: 0.02em;
        }

        .live-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: var(--high);
            box-shadow: 0 0 10px rgba(244, 0, 0, 0.8);
        }

        .meta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .chip {
            border: 1px solid var(--line-2);
            background: var(--panel-2);
            color: var(--muted);
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 11px;
        }

        .chip.live {
            color: #ffd0cb;
            border-color: rgba(244, 78, 63, 0.55);
            background: rgba(244, 78, 63, 0.08);
        }

        .layout {
            display: grid;
            grid-template-columns: 260px minmax(0, 1fr) 320px;
            min-height: 620px;
        }

        .sidebar,
        .content,
        .fixpane {
            border-right: 1px solid var(--line);
            background: rgba(16, 10, 11, 0.78);
        }

        .fixpane { border-right: none; }

        .section-head {
            padding: 12px;
            border-bottom: 1px solid var(--line);
            background: rgba(22, 12, 13, 0.92);
        }

        .section-title {
            margin: 0;
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #f6d3cf;
        }

        .section-subtitle {
            margin: 6px 0 0;
            color: var(--text);
            font-size: 13px;
            line-height: 1.4;
        }

        .section-body {
            padding: 12px;
        }

        .prompt-line {
            margin: 0 0 10px;
            color: var(--accent);
            text-shadow: 0 0 10px var(--glow);
        }

        .state-box {
            border: 1px solid var(--line);
            border-radius: 8px;
            background: #110a0b;
            padding: 10px;
            margin-bottom: 10px;
        }

        .state-title {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            color: var(--muted);
            margin: 0 0 6px;
        }

        .state-current {
            margin: 0;
            color: #ffe2de;
        }

        .state-log {
            margin: 8px 0 0;
            padding-left: 16px;
            color: var(--muted);
        }

        .state-log li { margin-bottom: 2px; }

        .status {
            color: var(--muted);
        }

        .list {
            padding: 12px;
            display: grid;
            gap: 10px;
        }

        .group-head {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: center;
            margin-bottom: 8px;
            color: var(--muted);
        }

        .group-name {
            text-transform: uppercase;
            letter-spacing: 0.06em;
            font-size: 11px;
        }

        .group-count {
            font-size: 11px;
        }

        .issue-item {
            border: 1px solid var(--line);
            border-radius: 8px;
            background: linear-gradient(180deg, rgba(31, 15, 16, 0.92), rgba(14, 8, 9, 0.96));
            padding: 10px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
        }

        .issue-item:hover {
            border-color: rgba(244, 78, 63, 0.55);
            box-shadow: 0 0 0 1px rgba(244, 78, 63, 0.08);
            transform: translateY(-1px);
        }

        .issue-item.active {
            border-color: rgba(244, 0, 0, 0.75);
            box-shadow: 0 0 0 1px rgba(244, 0, 0, 0.12);
        }

        .issue-top {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: flex-start;
            margin-bottom: 6px;
        }

        .issue-title {
            margin: 0;
            font-size: 13px;
            line-height: 1.35;
            color: #fff6f5;
        }

        .issue-file,
        .issue-line {
            color: var(--muted);
            font-size: 11px;
            margin: 0;
        }

        .badge {
            border-radius: 999px;
            padding: 2px 8px;
            border: 1px solid;
            font-size: 11px;
            white-space: nowrap;
        }

        .high { color: var(--high); border-color: rgba(244, 0, 0, 0.6); background: rgba(244, 0, 0, 0.1); }
        .medium { color: var(--medium); border-color: rgba(244, 78, 63, 0.6); background: rgba(244, 78, 63, 0.1); }
        .low { color: var(--low); border-color: rgba(244, 121, 107, 0.6); background: rgba(244, 121, 107, 0.1); }

        .console-block {
            border: 1px solid var(--line);
            border-radius: 8px;
            background: #0f090a;
            padding: 10px;
            margin-bottom: 10px;
        }

        .console-label {
            margin: 0 0 6px;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.07em;
            font-size: 11px;
        }

        .console-text {
            margin: 0;
            white-space: pre-wrap;
            color: #ffe7e5;
        }

        .fix-card {
            border: 1px solid var(--line);
            border-radius: 10px;
            background: linear-gradient(180deg, rgba(29, 14, 15, 0.96), rgba(13, 8, 9, 0.98));
            overflow: hidden;
        }

        .fix-card .section-head {
            background: linear-gradient(180deg, rgba(46, 13, 15, 0.95), rgba(20, 10, 11, 0.92));
        }

        .fix-preview {
            margin: 0;
            padding: 10px;
            background: #090809;
            border: 1px solid var(--line);
            border-radius: 8px;
            color: #ffd3cf;
            white-space: pre-wrap;
            overflow-x: auto;
            min-height: 120px;
        }

        .fix-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 10px;
        }

        .btn {
            border: 1px solid #f40000;
            background: linear-gradient(180deg, #f40000, #b80000);
            color: #fff0ef;
            padding: 7px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-family: inherit;
            font-size: 12px;
        }

        .btn:hover { background: linear-gradient(180deg, #ff1e1e, #c50303); }

        .btn.secondary {
            border-color: var(--line-2);
            background: #211112;
            color: #ffd7d3;
        }

        .btn.secondary:hover { background: #311719; }

        .timeline {
            margin: 0;
            padding: 0;
            list-style: none;
            display: grid;
            gap: 4px;
        }

        .timeline li {
            display: flex;
            gap: 8px;
            align-items: flex-start;
            color: var(--muted);
        }

        .timeline .t-stage {
            min-width: 74px;
            color: #ffd7d3;
        }

        .timeline .t-stage.failed { color: var(--high); }
        .timeline .t-stage.success { color: var(--low); }
        .timeline .t-stage.active { color: var(--medium); }

        .status-wrap {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: center;
            font-size: 11px;
            color: var(--muted);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: var(--high);
            box-shadow: 0 0 10px rgba(244, 0, 0, 0.85);
            display: inline-block;
            margin-right: 6px;
        }

        .workspace-title {
            color: #f3fff5;
            font-weight: 700;
        }

        @media (max-width: 1200px) {
            .layout { grid-template-columns: 240px minmax(0, 1fr); }
            .fixpane { grid-column: 1 / -1; border-top: 1px solid var(--line); }
        }

        @media (max-width: 850px) {
            .layout { grid-template-columns: 1fr; }
            .sidebar, .content, .fixpane { border-right: none; border-bottom: 1px solid var(--line); }
        }

        .loading-banner,
        .error-banner,
        .empty-banner {
            border: 1px dashed var(--line-2);
            border-radius: 8px;
            padding: 10px;
            color: var(--muted);
            background: rgba(14, 8, 9, 0.72);
        }

        .error-banner { color: var(--high); }

        .summary-card {
            display: grid;
            gap: 8px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
        }

        .summary-chip {
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--panel);
            padding: 8px;
        }

        .summary-chip .k {
            color: var(--muted);
            font-size: 11px;
            margin-bottom: 4px;
        }

        .summary-chip .v {
            color: #fff6f5;
            font-size: 14px;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <section class="terminal-shell">
        <div class="topbar">
            <div class="brand">
                <span class="status-dot"></span>
                <span>AI Security Review Agent</span>
            </div>
            <div class="meta-row">
                <span class="chip live">LIVE</span>
                <span class="chip" id="stageBadge">idle</span>
                <span class="chip" id="meta">mode=idle issues=0</span>
            </div>
        </div>

        <div class="layout">
            <aside class="sidebar">
                <div class="section-head">
                    <p class="section-title">issues</p>
                    <p class="section-subtitle">Choose a finding to inspect or fix.</p>
                </div>
                <div class="section-body">
                    <div id="issueIndex" class="list"></div>
                </div>
            </aside>

            <main class="content">
                <div class="section-head">
                    <p class="section-title">review console</p>
                    <p id="selectedTitle" class="section-subtitle">No issue selected</p>
                </div>
                <div class="section-body">
                    <div class="prompt-line">$ scan --mode auto --target current</div>
                    <section class="state-box">
                        <p class="state-title">
                            <span>state</span>
                            <span id="stateClock">--:--:--</span>
                        </p>
                        <p id="stateCurrent" class="state-current">idle: waiting for command</p>
                        <ol id="stateLog" class="state-log"></ol>
                    </section>

                    <section id="loading" class="loading-banner">Scanning...</section>
                    <section id="error" class="error-banner hidden"></section>
                    <section id="summary" class="summary-card hidden"></section>
                    <section id="issues" class="hidden"></section>
                </div>
            </main>

            <aside class="fixpane">
                <div class="section-head">
                    <p class="section-title">ai fix</p>
                    <p id="fixSubtitle" class="section-subtitle">Select a finding to preview the fix.</p>
                </div>
                <div class="section-body">
                    <div class="fix-card">
                        <div class="section-head">
                            <p class="section-title">selected issue</p>
                            <p id="fixTitle" class="workspace-title">None</p>
                        </div>
                        <div class="section-body">
                            <p id="fixMeta" class="issue-file">No finding selected</p>
                            <div class="summary-grid">
                                <div class="summary-chip"><div class="k">severity</div><div id="fixSeverity" class="v">-</div></div>
                                <div class="summary-chip"><div class="k">file</div><div id="fixFile" class="v">-</div></div>
                                <div class="summary-chip"><div class="k">line</div><div id="fixLine" class="v">-</div></div>
                            </div>

                            <p class="label">explanation</p>
                            <p id="fixExplanation" class="text">Select a finding from the issue rail.</p>

                            <p class="label">fix preview</p>
                            <pre id="fixPreview" class="fix-preview">No fix selected.</pre>

                            <div class="fix-actions">
                                <button id="applyBtn" class="btn">apply_fix</button>
                                <button id="skipBtn" class="btn secondary">skip</button>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    </section>

    <script>
        const vscodeApi = acquireVsCodeApi();

        const state = {
            loading: true,
            error: "",
            scope: "",
            summary: "",
            score: null,
            issues: [],
            stageHistory: [],
            selectedIssueId: null,
        };

        const metaEl = document.getElementById("meta");
        const stageBadgeEl = document.getElementById("stageBadge");
        const stateClockEl = document.getElementById("stateClock");
        const issueIndexEl = document.getElementById("issueIndex");
        const selectedTitleEl = document.getElementById("selectedTitle");
        const loadingEl = document.getElementById("loading");
        const errorEl = document.getElementById("error");
        const summaryEl = document.getElementById("summary");
        const issuesEl = document.getElementById("issues");
        const stateCurrentEl = document.getElementById("stateCurrent");
        const stateLogEl = document.getElementById("stateLog");
        const fixSubtitleEl = document.getElementById("fixSubtitle");
        const fixTitleEl = document.getElementById("fixTitle");
        const fixMetaEl = document.getElementById("fixMeta");
        const fixSeverityEl = document.getElementById("fixSeverity");
        const fixFileEl = document.getElementById("fixFile");
        const fixLineEl = document.getElementById("fixLine");
        const fixExplanationEl = document.getElementById("fixExplanation");
        const fixPreviewEl = document.getElementById("fixPreview");
        const applyBtnEl = document.getElementById("applyBtn");
        const skipBtnEl = document.getElementById("skipBtn");

        function escapeHtml(text) {
            return String(text)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#39;");
        }

        function badgeClass(severity) {
            if (severity === "High") return "badge high";
            if (severity === "Medium") return "badge medium";
            return "badge low";
        }

        function getSelectedIssue() {
            if (!state.issues.length) {
                return null;
            }

            return state.issues.find((issue) => issue.id === state.selectedIssueId) || state.issues[0];
        }

        function setSelectedIssue(issueId) {
            state.selectedIssueId = issueId;
            render();
        }

        function renderMeta() {
            const count = state.issues.length;
            const mode = state.scope ? state.scope.toLowerCase() : "idle";
            const scoreText = typeof state.score === "number" ? " score=" + state.score : "";
            metaEl.textContent = "mode=" + mode + " issues=" + count + scoreText;
        }

        function formatClock(iso) {
            const date = new Date(iso || Date.now());
            const hh = String(date.getHours()).padStart(2, "0");
            const mm = String(date.getMinutes()).padStart(2, "0");
            const ss = String(date.getSeconds()).padStart(2, "0");
            return hh + ":" + mm + ":" + ss;
        }

        function renderState() {
            const latest = state.stageHistory[0];
            const stage = latest?.stage || "idle";
            const detail = latest?.detail || "waiting for command";

            stageBadgeEl.textContent = stage;
            stateClockEl.textContent = formatClock(latest?.timestamp);
            stateCurrentEl.textContent = stage + ": " + detail;

            stateLogEl.innerHTML = "";
            for (const item of state.stageHistory.slice(0, 6)) {
                const li = document.createElement("li");
                const stageClass = item.stage.includes("fail") ? "t-stage failed" : item.loading ? "t-stage active" : "t-stage success";
                li.innerHTML = '<span class="' + stageClass + '">[' + formatClock(item.timestamp) + '] ' + escapeHtml(item.stage) + '</span><span>' + escapeHtml(item.detail) + '</span>';
                stateLogEl.appendChild(li);
            }
        }

        function renderIssueIndex() {
            issueIndexEl.innerHTML = "";

            if (!state.issues.length) {
                const empty = document.createElement("div");
                empty.className = "empty-banner";
                empty.textContent = "No issues in the latest scan.";
                issueIndexEl.appendChild(empty);
                return;
            }

            const grouped = new Map();
            for (const issue of state.issues) {
                const severity = issue.severity || "Low";
                if (!grouped.has(severity)) {
                    grouped.set(severity, []);
                }
                grouped.get(severity).push(issue);
            }

            for (const severity of ["High", "Medium", "Low"]) {
                const list = grouped.get(severity);
                if (!list || !list.length) {
                    continue;
                }

                const section = document.createElement("div");
                const header = document.createElement("div");
                header.className = "group-head";
                header.innerHTML = '<span class="group-name">' + severity + '</span><span class="group-count">' + list.length + '</span>';
                section.appendChild(header);

                for (const issue of list) {
                    const item = document.createElement("div");
                    item.className = "issue-item" + (issue.id === state.selectedIssueId || (!state.selectedIssueId && issue === state.issues[0]) ? " active" : "");
                    item.addEventListener("click", () => setSelectedIssue(issue.id));

                    item.innerHTML =
                        '<div class="issue-top">' +
                            '<div>' +
                                '<p class="issue-title">' + escapeHtml(issue.title || "Untitled issue") + '</p>' +
                                '<p class="issue-file">' + escapeHtml(issue.file || "Unknown file") + '</p>' +
                            '</div>' +
                            '<span class="' + badgeClass(issue.severity) + '">' + escapeHtml(issue.severity || "Low") + '</span>' +
                        '</div>' +
                        '<p class="issue-line">' + escapeHtml(issue.line ? "Line " + issue.line : "Line n/a") + '</p>';

                    section.appendChild(item);
                }

                issueIndexEl.appendChild(section);
            }
        }

        function renderSelectedIssue() {
            const issue = getSelectedIssue();

            if (!issue) {
                selectedTitleEl.textContent = "No issue selected";
                fixSubtitleEl.textContent = "Select a finding to preview the fix.";
                fixTitleEl.textContent = "None";
                fixMetaEl.textContent = "No finding selected";
                fixSeverityEl.textContent = "-";
                fixFileEl.textContent = "-";
                fixLineEl.textContent = "-";
                fixExplanationEl.textContent = "Select a finding from the issue rail.";
                fixPreviewEl.textContent = "No fix selected.";
                return;
            }

            selectedTitleEl.textContent = issue.title || "Untitled issue";
            fixSubtitleEl.textContent = issue.file || "Unknown file";
            fixTitleEl.textContent = issue.title || "Untitled issue";
            fixMetaEl.textContent = issue.severity || "Low";
            fixSeverityEl.textContent = issue.severity || "Low";
            fixSeverityEl.className = issue.severity === "High" ? "v high" : issue.severity === "Medium" ? "v medium" : "v low";
            fixFileEl.textContent = issue.file || "Unknown file";
            fixLineEl.textContent = issue.line ? String(issue.line) : "n/a";
            fixExplanationEl.textContent = issue.explanation || "No explanation provided.";
            fixPreviewEl.textContent = issue.fix || "No fix provided.";
        }

        function renderSummary() {
            summaryEl.innerHTML = "";
            const summaryBox = document.createElement("div");
            summaryBox.className = "console-block";
            summaryBox.innerHTML =
                '<p class="console-label">summary</p>' +
                '<p class="console-text">' + escapeHtml(state.summary || "No summary available.") + '</p>';

            const stats = document.createElement("div");
            stats.className = "summary-grid";

            const total = document.createElement("div");
            total.className = "summary-chip";
            total.innerHTML = '<div class="k">issues</div><div class="v">' + state.issues.length + '</div>';

            const score = document.createElement("div");
            score.className = "summary-chip";
            score.innerHTML = '<div class="k">score</div><div class="v">' + (typeof state.score === "number" ? state.score : "n/a") + '</div>';

            const scope = document.createElement("div");
            scope.className = "summary-chip";
            scope.innerHTML = '<div class="k">scope</div><div class="v">' + escapeHtml(state.scope || "idle") + '</div>';

            stats.appendChild(total);
            stats.appendChild(score);
            stats.appendChild(scope);

            summaryEl.appendChild(summaryBox);
            summaryEl.appendChild(stats);
        }

        function renderIssues() {
            issuesEl.innerHTML = "";

            if (!state.issues.length) {
                const empty = document.createElement("section");
                empty.className = "empty-banner";
                empty.textContent = "No vulnerabilities found.";
                issuesEl.appendChild(empty);
                return;
            }
        }

        function render() {
            renderMeta();
            renderState();
            renderIssueIndex();
            renderSelectedIssue();

            loadingEl.classList.toggle("hidden", !state.loading);
            errorEl.classList.toggle("hidden", !state.error);
            summaryEl.classList.toggle("hidden", state.loading || Boolean(state.error));
            issuesEl.classList.toggle("hidden", state.loading || Boolean(state.error));

            if (state.error) {
                errorEl.textContent = state.error;
                return;
            }

            if (state.loading) {
                loadingEl.textContent = "Scanning...";
                return;
            }

            renderSummary();
            renderIssues();
        }

        window.addEventListener("message", (event) => {
            const message = event.data || {};

            if (message.type === "state") {
                const entry = {
                    stage: String(message.stage || "working"),
                    detail: String(message.detail || "in progress"),
                    loading: Boolean(message.loading),
                    timestamp: message.timestamp || new Date().toISOString(),
                };

                state.stageHistory = [entry, ...(state.stageHistory || [])].slice(0, 20);
                state.loading = entry.loading;
                render();
                return;
            }

            if (message.type === "loading") {
                state.loading = true;
                state.error = "";
                loadingEl.textContent = message.message || "Scanning...";
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
                state.selectedIssueId = state.issues[0]?.id || null;
                render();
            }
        });

        applyBtnEl.addEventListener("click", () => {
            const issue = getSelectedIssue();
            if (issue) {
                vscodeApi.postMessage({ command: "applyFix", issueId: issue.id });
            }
        });

        skipBtnEl.addEventListener("click", () => {
            if (!state.issues.length) {
                return;
            }

            const currentIndex = Math.max(0, state.issues.findIndex((issue) => issue.id === state.selectedIssueId));
            const next = state.issues[(currentIndex + 1) % state.issues.length];
            state.selectedIssueId = next.id;
            render();
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