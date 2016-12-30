/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as code from 'vscode';

export default class ProtocolCompletionItem extends code.CompletionItem {

	public data: any;
	public typedString: boolean;

	constructor(label: string) {
		super(label);
	}
}