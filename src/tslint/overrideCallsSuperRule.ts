/**
* OverrideCallsSuperRule.ts
* Author: Mark Davis
* Copyright: Microsoft 2016
*
* Custom tslint rule used to enforce certain overrided method calls their `super` version.
*/

import _ from 'lodash';
import ts from 'typescript';
import { RuleFailure, Rules, RuleWalker } from 'tslint';

const MISSING_SUPER_CALL = 'Method override must call super.%';
const MISSING_TOP_LEVEL_SUPER_CALL = 'Method override must call super.% in the top-level statements of the method body';

const SUPER_REGEXP = /\bsuper\.([a-zA-Z0-9_]+)\(/g;

export class Rule extends Rules.AbstractRule {
    apply(sourceFile: ts.SourceFile): RuleFailure[] {
        const options = this.getOptions();
        const overrideCallsSuperWalker = new OverrideCallsSuperWalker(sourceFile, options);
        const methodNamesToCheck = options.ruleArguments;
        methodNamesToCheck.forEach(f => overrideCallsSuperWalker.addOverrideMethodToCheck(f));
        return this.applyWithWalker(overrideCallsSuperWalker);
    }
}

class OverrideCallsSuperWalker extends RuleWalker {
    private _methodNamesToCheck: string[] = [];

    addOverrideMethodToCheck(methodName: string): void {
        this._methodNamesToCheck.push(methodName);
    }

    visitMethodDeclaration(node: ts.MethodDeclaration): void {
        const methodName = node.name.getText();

        if (_.includes(this._methodNamesToCheck, methodName)) {
            this._checkOverrideCallsSuper(node, methodName);
        }

        // call the base version of this visitor to actually parse this node
        super.visitMethodDeclaration(node);
    }

    private _checkOverrideCallsSuper(node: ts.MethodDeclaration, methodName: string): void {
        // Must have a call to super (for the same method name) in the top-level list of statements.
        let hasSuperCall = false;
        if (node.body) {
            hasSuperCall = _.some(node.body.statements, statement => {
                if (statement.kind !== ts.SyntaxKind.ExpressionStatement) {
                    return false;
                }
                const expressionStatement = statement as ts.ExpressionStatement;
                if (expressionStatement.expression.kind !== ts.SyntaxKind.CallExpression) {
                    return false;
                }
                const callExpression = expressionStatement.expression as ts.CallExpression;
                if (callExpression.expression.kind !== ts.SyntaxKind.PropertyAccessExpression) {
                    return false;
                }
                const propertyAccessExpression = callExpression.expression as ts.PropertyAccessExpression;
                if (propertyAccessExpression.expression.kind !== ts.SyntaxKind.SuperKeyword) {
                    return false;
                }
                return this._hasSuperCallForSameMethodName(callExpression, methodName);
            });
        }

        if (!hasSuperCall) {
            // If it had a super call for the same method but not at the top level, then give a more specific warning.
            const failureTemplate = this._hasSuperCallForSameMethodName(node, methodName)
                ? MISSING_TOP_LEVEL_SUPER_CALL
                : MISSING_SUPER_CALL;
            const failureString = failureTemplate.replace(/%/g, methodName);
            // Create a failure at the current position.
            this.addFailure(this.createFailure(node.getStart(), node.getWidth(), failureString));
        }
    }

    private _hasSuperCallForSameMethodName(node: ts.Node, methodName: string): boolean {
        const text = node.getText();
        let match: RegExpExecArray | null;

        while ((match = SUPER_REGEXP.exec(text))) {
            if (match[1] === methodName) {
                // This method is fine, so we can bail early.
                // Note: reseting the regex index so it is in a fresh state for its next use.
                SUPER_REGEXP.lastIndex = 0;
                return true;
            }
        }

        return false;
    }
}
