/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	createConnection, InitializeParams, ServerCapabilities, CompletionItemKind, ResourceOperationKind, FailureHandlingKind,
	DiagnosticTag, CompletionItemTag, TextDocumentSyncKind, MarkupKind, SignatureHelp, SignatureInformation, ParameterInformation,
	Location, Range, DocumentHighlight, DocumentHighlightKind, CodeAction, Command, TextEdit, Position, DocumentLink,
	ColorInformation, Color, ColorPresentation, FoldingRange, SelectionRange, SymbolKind, ProtocolRequestType, WorkDoneProgress,
	InlineValueText, InlineValueVariableLookup, InlineValueEvaluatableExpression, RequestType,
	WorkDoneProgressCreateRequest, WillCreateFilesRequest, WillRenameFilesRequest, WillDeleteFilesRequest, DidDeleteFilesNotification,
	DidRenameFilesNotification, DidCreateFilesNotification, Proposed, ProposedFeatures, Diagnostic, DiagnosticSeverity, TypeHierarchyItem
} from '../../../server/node';

import { URI } from 'vscode-uri';
import { $DiagnosticClientCapabilities } from 'vscode-languageserver-protocol/src/common/proposed.diagnostic';

const connection: ProposedFeatures.Connection = createConnection(ProposedFeatures.all);

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

const receivedNotifications: Set<string> = new Set();
namespace GotNotifiedRequest {
	export const method: 'testing/gotNotified' = 'testing/gotNotified';
	export const type = new RequestType<string, boolean, void>(method);
}

connection.onInitialize((params: InitializeParams): any => {
	assert.equal((params.capabilities.workspace as any).applyEdit, true);
	assert.equal(params.capabilities.workspace!.workspaceEdit!.documentChanges, true);
	assert.deepEqual(params.capabilities.workspace!.workspaceEdit!.resourceOperations, [ResourceOperationKind.Create, ResourceOperationKind.Rename, ResourceOperationKind.Delete]);
	assert.equal(params.capabilities.workspace!.workspaceEdit!.failureHandling, FailureHandlingKind.TextOnlyTransactional);
	assert.equal(params.capabilities.workspace!.symbol!.resolveSupport!.properties[0], 'location.range');
	assert.equal(params.capabilities.textDocument!.completion!.completionItem!.deprecatedSupport, true);
	assert.equal(params.capabilities.textDocument!.completion!.completionItem!.preselectSupport, true);
	assert.equal(params.capabilities.textDocument!.completion!.completionItem!.tagSupport!.valueSet.length, 1);
	assert.equal(params.capabilities.textDocument!.completion!.completionItem!.tagSupport!.valueSet[0], CompletionItemTag.Deprecated);
	assert.equal(params.capabilities.textDocument!.signatureHelp!.signatureInformation!.parameterInformation!.labelOffsetSupport, true);
	assert.equal(params.capabilities.textDocument!.definition!.linkSupport, true);
	assert.equal(params.capabilities.textDocument!.declaration!.linkSupport, true);
	assert.equal(params.capabilities.textDocument!.implementation!.linkSupport, true);
	assert.equal(params.capabilities.textDocument!.typeDefinition!.linkSupport, true);
	assert.equal(params.capabilities.textDocument!.rename!.prepareSupport, true);
	assert.equal(params.capabilities.textDocument!.publishDiagnostics!.relatedInformation, true);
	assert.equal(params.capabilities.textDocument!.publishDiagnostics!.tagSupport!.valueSet.length, 2);
	assert.equal(params.capabilities.textDocument!.publishDiagnostics!.tagSupport!.valueSet[0], DiagnosticTag.Unnecessary);
	assert.equal(params.capabilities.textDocument!.publishDiagnostics!.tagSupport!.valueSet[1], DiagnosticTag.Deprecated);
	assert.equal(params.capabilities.textDocument!.documentLink!.tooltipSupport, true);

	const valueSet = params.capabilities.textDocument!.completion!.completionItemKind!.valueSet!;
	assert.equal(valueSet[0], 1);
	assert.equal(valueSet[valueSet.length - 1], CompletionItemKind.TypeParameter);
	assert.equal(params.capabilities.workspace!.fileOperations!.willCreate, true);

	const diagnosticClientCapabilities = (params.capabilities as $DiagnosticClientCapabilities).textDocument!.diagnostic;
	assert.equal(diagnosticClientCapabilities?.dynamicRegistration, true);
	assert.equal(diagnosticClientCapabilities?.relatedDocumentSupport, false);

	const notebookCapabilities = (params.capabilities as Proposed.$NotebookDocumentClientCapabilities).notebookDocument!;
	assert.equal(notebookCapabilities.synchronization.dynamicRegistration, true);

	const capabilities: ServerCapabilities & Proposed.$DiagnosticServerCapabilities & Proposed.$NotebookDocumentSyncServerCapabilities = {
		textDocumentSync: TextDocumentSyncKind.Full,
		definitionProvider: true,
		hoverProvider: true,
		completionProvider: { resolveProvider: true, triggerCharacters: ['"', ':'] },
		signatureHelpProvider: {
			triggerCharacters: [':'],
			retriggerCharacters: [':']
		},
		referencesProvider: true,
		documentHighlightProvider: true,
		codeActionProvider: {
			resolveProvider: true
		},
		documentFormattingProvider: true,
		documentRangeFormattingProvider: true,
		documentOnTypeFormattingProvider: {
			firstTriggerCharacter: ':'
		},
		renameProvider: {
			prepareProvider: true
		},
		documentLinkProvider: {
			resolveProvider: true
		},
		colorProvider: true,
		declarationProvider: true,
		foldingRangeProvider: true,
		implementationProvider: true,
		selectionRangeProvider: true,
		inlineValuesProvider: {},
		typeDefinitionProvider: true,
		callHierarchyProvider: true,
		semanticTokensProvider: {
			legend: {
				tokenTypes: [],
				tokenModifiers: []
			},
			range: true,
			full: {
				delta: true
			}
		},
		workspace: {
			fileOperations: {
				// Static reg is folders + .txt files with operation kind in the path
				didCreate: {
					filters: [{ scheme: 'file-test', pattern: { glob: '**/created-static/**{/,/*.txt}' } }]
				},
				didRename: {
					filters: [
						{ scheme: 'file-test', pattern: { glob: '**/renamed-static/**/', matches: 'folder' } },
						{ scheme: 'file-test', pattern: { glob: '**/renamed-static/**/*.txt', matches: 'file' } },
						// Additionally, to ensure we detect file types correctly, subscribe to only files in
						// this folder.
						{ scheme: 'file-test', pattern: { glob: '**/only-files/**/*', matches: 'file' } }
					]
				},
				didDelete: {
					filters: [
						{ scheme: 'file-test', pattern: { glob: '**/deleted-static/**{/,/*.txt}' } },
						// Additionally, to ensure we detect file types correctly, subscribe to only files in
						// this folder.
						{ scheme: 'file-test', pattern: { glob: '**/only-files/**/*', matches: 'file' } }
					]
				},
				willCreate: {
					filters: [{ scheme: 'file-test', pattern: { glob: '**/created-static/**{/,/*.txt}' } }]
				},
				willRename: {
					filters: [
						{ scheme: 'file-test', pattern: { glob: '**/renamed-static/**/', matches: 'folder' } },
						{ scheme: 'file-test', pattern: { glob: '**/renamed-static/**/*.txt', matches: 'file' } }
					]
				},
				willDelete: {
					filters: [{ scheme: 'file-test', pattern: { glob: '**/deleted-static/**{/,/*.txt}' } }]
				},
			},
		},
		linkedEditingRangeProvider: true,
		diagnosticProvider: {
			identifier: 'da348dc5-c30a-4515-9d98-31ff3be38d14',
			interFileDependencies: true,
			workspaceDiagnostics: true
		},
		typeHierarchyProvider: true,
		workspaceSymbolProvider: {
			resolveProvider: true
		},
		notebookDocumentSync: {
			notebookDocumentSelector: [{
				notebookDocumentFilter: { notebookType: 'jupyter-notebook' },
				cellSelector: [{language: 'bat'}]
			}],
			mode: 'notebook'
		}
	};
	return { capabilities, customResults: { hello: 'world' } };
});

connection.onInitialized(() => {
	// Dynamic reg is folders + .js files with operation kind in the path
	void connection.client.register(DidCreateFilesNotification.type, {
		filters: [{ scheme: 'file-test', pattern: { glob: '**/created-dynamic/**{/,/*.js}' } }]
	});
	void connection.client.register(DidRenameFilesNotification.type, {
		filters: [
			{ scheme: 'file-test', pattern: { glob: '**/renamed-dynamic/**/', matches: 'folder' } },
			{ scheme: 'file-test', pattern: { glob: '**/renamed-dynamic/**/*.js', matches: 'file' } }
		]
	});
	void connection.client.register(DidDeleteFilesNotification.type, {
		filters: [{ scheme: 'file-test', pattern: { glob: '**/deleted-dynamic/**{/,/*.js}' } }]
	});
	void connection.client.register(WillCreateFilesRequest.type, {
		filters: [{ scheme: 'file-test', pattern: { glob: '**/created-dynamic/**{/,/*.js}' } }]
	});
	void connection.client.register(WillRenameFilesRequest.type, {
		filters: [
			{ scheme: 'file-test', pattern: { glob: '**/renamed-dynamic/**/', matches: 'folder' } },
			{ scheme: 'file-test', pattern: { glob: '**/renamed-dynamic/**/*.js', matches: 'file' } }
		]
	});
	void connection.client.register(WillDeleteFilesRequest.type, {
		filters: [{ scheme: 'file-test', pattern: { glob: '**/deleted-dynamic/**{/,/*.js}' } }]
	});
});

//const type: typeof SemanticTokensRegistrationType.type = WillDeleteFilesRequest.type;

connection.onDeclaration((params) => {
	assert.equal(params.position.line, 1);
	assert.equal(params.position.character, 1);
	return { uri: params.textDocument.uri, range: { start: { line: 1, character: 1}, end: {line: 1, character: 2 }}};
});

connection.onDefinition((params) => {
	assert.equal(params.position.line, 1);
	assert.equal(params.position.character, 1);
	return { uri: params.textDocument.uri, range: { start: { line: 0, character: 0}, end: {line: 0, character: 1 }}};
});

connection.onHover((_params) => {
	return {
		contents: {
			kind: MarkupKind.PlainText,
			value: 'foo'
		}
	};
});

connection.onCompletion((_params) => {
	return [
		{ label: 'item', insertText: 'text' }
	];
});

connection.onCompletionResolve((item) => {
	item.detail = 'detail';
	return item;
});

connection.onSignatureHelp((_params) => {
	const result: SignatureHelp = {
		signatures: [
			SignatureInformation.create('label', 'doc', ParameterInformation.create('label', 'doc'))
		],
		activeSignature: 1,
		activeParameter: 1
	};
	return result;
});

connection.onReferences((params) => {
	return [
		Location.create(params.textDocument.uri, Range.create(0,0,0,0)),
		Location.create(params.textDocument.uri, Range.create(1,1,1,1))
	];
});

connection.onDocumentHighlight((_params) => {
	return [
		DocumentHighlight.create(Range.create(2, 2, 2, 2), DocumentHighlightKind.Read)
	];
});

connection.onCodeAction((_params) => {
	return [
		CodeAction.create('title', Command.create('title', 'id'))
	];
});

connection.onCodeActionResolve((codeAction) => {
	codeAction.title = 'resolved';
	return codeAction;
});

connection.onDocumentFormatting((_params) => {
	return [
		TextEdit.insert(Position.create(0, 0), 'insert')
	];
});

connection.onDocumentRangeFormatting((_params) => {
	return [
		TextEdit.del(Range.create(1, 1, 1, 2))
	];
});

connection.onDocumentOnTypeFormatting((_params) => {
	return [
		TextEdit.replace(Range.create(2, 2, 2, 3), 'replace')
	];
});

connection.onPrepareRename((_params) => {
	return Range.create(1, 1, 1, 2);
});

connection.onRenameRequest((_params) => {
	return { documentChanges: [] };
});

connection.onDocumentLinks((_params) => {
	return [
		DocumentLink.create(Range.create(1, 1, 1, 2))
	];
});

connection.onDocumentLinkResolve((link) => {
	link.target = URI.file('/target.txt').toString();
	return link;
});

connection.onDocumentColor((_params) => {
	return [
		ColorInformation.create(Range.create(1, 1, 1, 2), Color.create(1, 2, 3, 4))
	];
});

connection.onColorPresentation((_params) => {
	return [
		ColorPresentation.create('label')
	];
});

connection.onFoldingRanges((_params) => {
	return [
		FoldingRange.create(1,2)
	];
});

connection.onImplementation((params) => {
	assert.equal(params.position.line, 1);
	assert.equal(params.position.character, 1);
	return { uri: params.textDocument.uri, range: { start: { line: 2, character: 2}, end: {line: 3, character: 3 }}};
});

connection.onSelectionRanges((_params) => {
	return [
		SelectionRange.create(Range.create(1,2,3,4))
	];
});

let lastFileOperationRequest: unknown;
connection.workspace.onDidCreateFiles((params) => { lastFileOperationRequest = { type: 'create', params }; });
connection.workspace.onDidRenameFiles((params) => { lastFileOperationRequest = { type: 'rename', params }; });
connection.workspace.onDidDeleteFiles((params) => { lastFileOperationRequest = { type: 'delete', params }; });

connection.onRequest(
	new ProtocolRequestType<null, null, never, any, any>('testing/lastFileOperationRequest'),
	() => {
		return lastFileOperationRequest;
	},
);

connection.workspace.onWillCreateFiles((params) => {
	const createdFilenames = params.files.map((f) => `${f.uri}`).join('\n');
	return {
		documentChanges: [{
			textDocument: { uri: '/dummy-edit', version: null },
			edits: [
				TextEdit.insert(Position.create(0, 0), `WILL CREATE:\n${createdFilenames}`),
			]
		}],
	};
});

connection.workspace.onWillRenameFiles((params) => {
	const renamedFilenames = params.files.map((f) => `${f.oldUri} -> ${f.newUri}`).join('\n');
	return {
		documentChanges: [{
			textDocument: { uri: '/dummy-edit', version: null },
			edits: [
				TextEdit.insert(Position.create(0, 0), `WILL RENAME:\n${renamedFilenames}`),
			]
		}],
	};
});

connection.workspace.onWillDeleteFiles((params) => {
	const deletedFilenames = params.files.map((f) => `${f.uri}`).join('\n');
	return {
		documentChanges: [{
			textDocument: { uri: '/dummy-edit', version: null },
			edits: [
				TextEdit.insert(Position.create(0, 0), `WILL DELETE:\n${deletedFilenames}`),
			]
		}],
	};
});

connection.onTypeDefinition((params) => {
	assert.equal(params.position.line, 1);
	assert.equal(params.position.character, 1);
	return { uri: params.textDocument.uri, range: { start: { line: 2, character: 2}, end: {line: 3, character: 3 }}};
});

connection.languages.callHierarchy.onPrepare((params) => {
	return [
		{
			kind: SymbolKind.Function,
			name: 'name',
			range: Range.create(1, 1, 1, 1),
			selectionRange: Range.create(2, 2, 2, 2),
			uri: params.textDocument.uri
		}
	];
});

connection.languages.callHierarchy.onIncomingCalls((params) => {
	return [
		{
			from: params.item,
			fromRanges: [ Range.create(1, 1, 1, 1)]
		}
	];
});

connection.languages.callHierarchy.onOutgoingCalls((params) => {
	return [
		{
			to: params.item,
			fromRanges: [ Range.create(1, 1, 1, 1)]
		}
	];
});

connection.languages.semanticTokens.onRange(() => {
	return {
		resultId: '1',
		data: []
	};
});

connection.languages.semanticTokens.on(() => {
	return {
		resultId: '2',
		data: []
	};
});

connection.languages.semanticTokens.onDelta(() => {
	return {
		resultId: '3',
		data: []
	};
});

connection.languages.onLinkedEditingRange(() => {
	return {
		ranges: [ Range.create(1,1,1,1)],
		wordPattern: '\\w'
	};
});

connection.languages.diagnostics.on(() => {
	return {
		kind: Proposed.DocumentDiagnosticReportKind.full,
		items: [
			Diagnostic.create(Range.create(1, 1, 1, 1), 'diagnostic', DiagnosticSeverity.Error)
		]
	};
});

connection.languages.diagnostics.onWorkspace(() => {
	return {
		items: [ {
			kind: Proposed.DocumentDiagnosticReportKind.full,
			uri: 'uri',
			version: 1,
			items: [
				Diagnostic.create(Range.create(1, 1, 1, 1), 'diagnostic', DiagnosticSeverity.Error)
			]
		}]
	};
});

const typeHierarchySample = {
	superTypes: [] as TypeHierarchyItem[],
	subTypes: [] as TypeHierarchyItem[]
};
connection.languages.typeHierarchy.onPrepare((params) => {
	const currentItem = {
		kind: SymbolKind.Class,
		name: 'ClazzB',
		range: Range.create(1, 1, 1, 1),
		selectionRange: Range.create(2, 2, 2, 2),
		uri: params.textDocument.uri
	} as TypeHierarchyItem;
	typeHierarchySample.superTypes = [ {...currentItem, name: 'classA', uri: 'uri-for-A'}];
	typeHierarchySample.subTypes = [ {...currentItem, name: 'classC', uri: 'uri-for-C'}];
	return [currentItem];
});

connection.languages.typeHierarchy.onSupertypes((_params) => {
	return typeHierarchySample.superTypes;
});

connection.languages.typeHierarchy.onSubtypes((_params) => {
	return typeHierarchySample.subTypes;
});

connection.languages.inlineValues.on((_params) => {
	return [
		InlineValueText.create(Range.create(1, 2, 3, 4), 'text'),
		InlineValueVariableLookup.create(Range.create(1, 2, 3, 4), 'variableName', false),
		InlineValueEvaluatableExpression.create(Range.create(1, 2, 3, 4), 'expression'),
	];
});

connection.onRequest(
	new ProtocolRequestType<null, null, never, any, any>('testing/sendSampleProgress'),
	async (_, __) => {
		const progressToken = 'TEST-PROGRESS-TOKEN';
		await connection.sendRequest(WorkDoneProgressCreateRequest.type, { token: progressToken });
		void connection.sendProgress(WorkDoneProgress.type, progressToken, { kind: 'begin', title: 'Test Progress' });
		void connection.sendProgress(WorkDoneProgress.type, progressToken, { kind: 'report', percentage: 50, message: 'Halfway!' });
		void connection.sendProgress(WorkDoneProgress.type, progressToken, { kind: 'end', message: 'Completed!' });
	},
);

connection.onWorkspaceSymbol(() => {
	return [
		{ name: 'name', kind: SymbolKind.Array, location: { uri: 'file:///abc.txt' }}
	];
});

connection.onWorkspaceSymbolResolve((symbol) => {
	symbol.location = Location.create(symbol.location.uri, Range.create(1,2,3,4));
	return symbol;
});

connection.notebooks.synchronization.onDidOpenNotebookDocument(() => {
	receivedNotifications.add(Proposed.DidOpenNotebookDocumentNotification.method);
});
connection.notebooks.synchronization.onDidChangeNotebookDocument(() => {
	receivedNotifications.add(Proposed.DidChangeNotebookDocumentNotification.method);
});
connection.notebooks.synchronization.onDidSaveNotebookDocument(() => {
	receivedNotifications.add(Proposed.DidSaveNotebookDocumentNotification.method);
});
connection.notebooks.synchronization.onDidCloseNotebookDocument(() => {
	receivedNotifications.add(Proposed.DidCloseNotebookDocumentNotification.method);
});

connection.onRequest(GotNotifiedRequest.type, (method: string) => {
	const result = receivedNotifications.has(method);
	if (result) {
		receivedNotifications.delete(method);
	}
	return result;
});
// Listen on the connection
connection.listen();