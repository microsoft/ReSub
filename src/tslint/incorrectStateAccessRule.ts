/**
* incorrectStateAccess.ts
* Author: Sergei Dryganets
* Copyright: Microsoft 2017
*
* Custom tslint rule used to find cases where the code references
* this.state from componentWillMount method.
*/

import * as Lint from 'tslint';
import ts from 'typescript';
import { isMethodDeclaration } from 'typescript';
import { isCallExpression, isPropertyAccessExpression } from 'tsutils';

const DEBUG = false;
const ERROR_MESSAGE = 'this.state is undefined in componentWillMount callback.';

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: 'incorrect-state-access',
        description: 'Bans state access for ReSub components',
        rationale: 'In ReSub Component this.state is undefined during componentWillMount. We need to warn users about it.',
        optionsDescription: '',
        options: {},
        type: 'functionality',
        typescriptOnly: true,
    };

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk, this.ruleArguments);
    }
}

interface MethodInfo {
    name: string;
    calling: string[];
    node: ts.MethodDeclaration;
    stateNodes: ts.Node[];
}

let methods: {[key: string]: MethodInfo} = {};
let method: MethodInfo;

// Builds method call graph.
// For each method stores this.state statements
function analyzeMethodBody(node: ts.Node): void {
    if (isCallExpression(node)) {
        let expr = node.getText();
        if (expr.indexOf('this.') === 0) {
            const index = expr.indexOf('(');
            if (index) {
                const name = expr.substring(5, index);
                method.calling.push(name);
                if (DEBUG) {
                    console.log('Method call', method.name + ' -> ' + name);
                }
            }
        }
        analyzeNodeChildren(node, 'CallExpression');
    } else if (isPropertyAccessExpression(node)) {
        if (node.getText().lastIndexOf('this.state.') !== -1) {
            method.stateNodes.push(node);
            analyzeNodeChildren(node, 'ErrorProperyExpression', true);
        } else {
            analyzeNodeChildren(node, 'PropertyExpression', true);
        }
    } else {
        analyzeNodeChildren(node, 'Node');
    }
}

function analyzeNodeChildren(node: ts.Node, context: string, skip?: boolean): void {
    if (DEBUG) {
        console.log(context, node.kind, node.getText());
    }

    if (!skip) {
        node.forEachChild(analyzeMethodBody);
    }
}

function walk(ctx: Lint.WalkContext<string[]>): void {
    return ts.forEachChild(ctx.sourceFile, function cb(node): void {
        if (isMethodDeclaration(node)) {
            const methodName = node.name.getText();
            method = { name: methodName, calling: [], node, stateNodes: [] };
            methods[node.name.getText()] = method;
            if (node.body) {
                analyzeMethodBody(node.body);
            }
        } else if (node.kind === ts.SyntaxKind.EndOfFileToken) {
            // End of file. Use collected information to analyze function call graph starting from willComponentMount
            let visitedMethods: {[key: string]: boolean} = {};
            let queue: MethodInfo[] = [];

            const methodsList = ctx.options.concat(['componentWillMount']);

            methodsList.forEach((methodName: string) => {
                const method =  methods[methodName];
                if (method) {
                    queue.push(method);
                }
            });

            while (queue.length > 0) {
                const method = queue.pop()!!!;

                if (!visitedMethods[method.name]) {
                    visitedMethods[method.name] = true;
                    method.stateNodes.forEach((node: ts.Node) => {
                        ctx.addFailureAtNode(node, ERROR_MESSAGE);
                    });

                    method.calling.forEach((name: string) => {
                        const called = methods[name];
                        if (called) {
                            queue.push(called);
                        }
                    });
                }
            }

            // clean up
            methods = {};
        } else {
            return ts.forEachChild(node, cb);
        }
    });
}
