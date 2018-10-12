/**
* OverrideCallsSuperRule.ts
* Author: Mark Davis
* Copyright: Microsoft 2016
*
* Custom tslint rule used to enforce certain overrided method calls their `super` version.
*/
import ts from 'typescript';
import { RuleFailure, Rules } from 'tslint';
export declare class Rule extends Rules.AbstractRule {
    apply(sourceFile: ts.SourceFile): RuleFailure[];
}
