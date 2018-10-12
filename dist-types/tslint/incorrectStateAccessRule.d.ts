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
export declare class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata;
    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[];
}
