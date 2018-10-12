/**
* incorrectStateAccess.ts
* Author: Sergei Dryganets
* Copyright: Microsoft 2017
*
* Custom tslint rule used to find cases where the code references
* this.state from componentWillMount method.
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import * as Lint from 'tslint';
import ts from 'typescript';
import { isMethodDeclaration } from 'typescript';
import { isCallExpression, isPropertyAccessExpression } from 'tsutils';
var DEBUG = false;
var ERROR_MESSAGE = 'this.state is undefined in componentWillMount callback.';
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithFunction(sourceFile, walk, this.ruleArguments);
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: 'incorrect-state-access',
        description: 'Bans state access for ReSub components',
        rationale: 'In ReSub Component this.state is undefined during componentWillMount. We need to warn users about it.',
        optionsDescription: '',
        options: {},
        type: 'functionality',
        typescriptOnly: true,
    };
    return Rule;
}(Lint.Rules.AbstractRule));
export { Rule };
var methods = {};
var method;
// Builds method call graph.
// For each method stores this.state statements
function analyzeMethodBody(node) {
    if (isCallExpression(node)) {
        var expr = node.getText();
        if (expr.indexOf('this.') === 0) {
            var index = expr.indexOf('(');
            if (index) {
                var name_1 = expr.substring(5, index);
                method.calling.push(name_1);
                if (DEBUG) {
                    console.log('Method call', method.name + ' -> ' + name_1);
                }
            }
        }
        analyzeNodeChildren(node, 'CallExpression');
    }
    else if (isPropertyAccessExpression(node)) {
        if (node.getText().lastIndexOf('this.state.') !== -1) {
            method.stateNodes.push(node);
            analyzeNodeChildren(node, 'ErrorProperyExpression', true);
        }
        else {
            analyzeNodeChildren(node, 'PropertyExpression', true);
        }
    }
    else {
        analyzeNodeChildren(node, 'Node');
    }
}
function analyzeNodeChildren(node, context, skip) {
    if (DEBUG) {
        console.log(context, node.kind, node.getText());
    }
    if (!skip) {
        node.forEachChild(analyzeMethodBody);
    }
}
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (isMethodDeclaration(node)) {
            var methodName = node.name.getText();
            method = { name: methodName, calling: [], node: node, stateNodes: [] };
            methods[node.name.getText()] = method;
            if (node.body) {
                analyzeMethodBody(node.body);
            }
        }
        else if (node.kind === ts.SyntaxKind.EndOfFileToken) {
            // End of file. Use collected information to analyze function call graph starting from willComponentMount
            var visitedMethods = {};
            var queue_1 = [];
            var methodsList = ctx.options.concat(['componentWillMount']);
            methodsList.forEach(function (methodName) {
                var method = methods[methodName];
                if (method) {
                    queue_1.push(method);
                }
            });
            while (queue_1.length > 0) {
                var method_1 = queue_1.pop();
                if (!visitedMethods[method_1.name]) {
                    visitedMethods[method_1.name] = true;
                    method_1.stateNodes.forEach(function (node) {
                        ctx.addFailureAtNode(node, ERROR_MESSAGE);
                    });
                    method_1.calling.forEach(function (name) {
                        var called = methods[name];
                        if (called) {
                            queue_1.push(called);
                        }
                    });
                }
            }
            // clean up
            methods = {};
        }
        else {
            return ts.forEachChild(node, cb);
        }
    });
}
