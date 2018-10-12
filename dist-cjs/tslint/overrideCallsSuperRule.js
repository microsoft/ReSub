"use strict";
/**
* OverrideCallsSuperRule.ts
* Author: Mark Davis
* Copyright: Microsoft 2016
*
* Custom tslint rule used to enforce certain overrided method calls their `super` version.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_1 = __importDefault(require("lodash"));
var typescript_1 = __importDefault(require("typescript"));
var tslint_1 = require("tslint");
var MISSING_SUPER_CALL = 'Method override must call super.%';
var MISSING_TOP_LEVEL_SUPER_CALL = 'Method override must call super.% in the top-level statements of the method body';
var SUPER_REGEXP = /\bsuper\.([a-zA-Z0-9_]+)\(/g;
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        var options = this.getOptions();
        var overrideCallsSuperWalker = new OverrideCallsSuperWalker(sourceFile, options);
        var methodNamesToCheck = options.ruleArguments;
        methodNamesToCheck.forEach(function (f) { return overrideCallsSuperWalker.addOverrideMethodToCheck(f); });
        return this.applyWithWalker(overrideCallsSuperWalker);
    };
    return Rule;
}(tslint_1.Rules.AbstractRule));
exports.Rule = Rule;
var OverrideCallsSuperWalker = /** @class */ (function (_super) {
    __extends(OverrideCallsSuperWalker, _super);
    function OverrideCallsSuperWalker() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._methodNamesToCheck = [];
        return _this;
    }
    OverrideCallsSuperWalker.prototype.addOverrideMethodToCheck = function (methodName) {
        this._methodNamesToCheck.push(methodName);
    };
    OverrideCallsSuperWalker.prototype.visitMethodDeclaration = function (node) {
        var methodName = node.name.getText();
        if (lodash_1.default.includes(this._methodNamesToCheck, methodName)) {
            this._checkOverrideCallsSuper(node, methodName);
        }
        // call the base version of this visitor to actually parse this node
        _super.prototype.visitMethodDeclaration.call(this, node);
    };
    OverrideCallsSuperWalker.prototype._checkOverrideCallsSuper = function (node, methodName) {
        var _this = this;
        // Must have a call to super (for the same method name) in the top-level list of statements.
        var hasSuperCall = false;
        if (node.body) {
            hasSuperCall = lodash_1.default.some(node.body.statements, function (statement) {
                if (statement.kind !== typescript_1.default.SyntaxKind.ExpressionStatement) {
                    return false;
                }
                var expressionStatement = statement;
                if (expressionStatement.expression.kind !== typescript_1.default.SyntaxKind.CallExpression) {
                    return false;
                }
                var callExpression = expressionStatement.expression;
                if (callExpression.expression.kind !== typescript_1.default.SyntaxKind.PropertyAccessExpression) {
                    return false;
                }
                var propertyAccessExpression = callExpression.expression;
                if (propertyAccessExpression.expression.kind !== typescript_1.default.SyntaxKind.SuperKeyword) {
                    return false;
                }
                return _this._hasSuperCallForSameMethodName(callExpression, methodName);
            });
        }
        if (!hasSuperCall) {
            // If it had a super call for the same method but not at the top level, then give a more specific warning.
            var failureTemplate = this._hasSuperCallForSameMethodName(node, methodName)
                ? MISSING_TOP_LEVEL_SUPER_CALL
                : MISSING_SUPER_CALL;
            var failureString = failureTemplate.replace(/%/g, methodName);
            // Create a failure at the current position.
            this.addFailure(this.createFailure(node.getStart(), node.getWidth(), failureString));
        }
    };
    OverrideCallsSuperWalker.prototype._hasSuperCallForSameMethodName = function (node, methodName) {
        var text = node.getText();
        var match;
        // tslint:disable-next-line
        while ((match = SUPER_REGEXP.exec(text))) {
            if (match[1] === methodName) {
                // This method is fine, so we can bail early.
                // Note: reseting the regex index so it is in a fresh state for its next use.
                SUPER_REGEXP.lastIndex = 0;
                return true;
            }
        }
        return false;
    };
    return OverrideCallsSuperWalker;
}(tslint_1.RuleWalker));
