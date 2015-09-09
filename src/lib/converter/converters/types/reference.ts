import * as ts from "typescript";

import {Context} from "../../Context";
import {Converter} from "../../Converter";
import {convertNode} from "../node";
import {convertType} from "../type";
import {Type} from "../../../models/Type";
import {IntrinsicType} from "../../../models/types/IntrinsicType";
import {ReflectionKind} from "../../../models/Reflection";
import {ReflectionType} from "../../../models/types/ReflectionType";
import {DeclarationReflection} from "../../../models/reflections/DeclarationReflection";DeclarationReflection
import {TypeNodeConverter} from "../type";
import {createReferenceType} from "../factories/reference";


export class ReferenceConverter implements TypeNodeConverter<ts.TypeReference, ts.TypeReferenceNode>
{
    /**
     * The priority this converter should be executed with.
     * A higher priority means the converter will be applied earlier.
     */
    priority:number = -50;



    /**
     * Test whether this converter can handle the given TypeScript node.
     */
    supportsNode(context:Context, node:ts.TypeReferenceNode, type:ts.TypeReference):boolean {
        return !!(type.flags & ts.TypeFlags.ObjectType);
    }


    /**
     * Test whether this converter can handle the given TypeScript type.
     */
    supportsType(context:Context, type:ts.TypeReference):boolean {
        return !!(type.flags & ts.TypeFlags.ObjectType);
    }


    /**
     * Create a type literal reflection.
     *
     * This is a utility function used by [[convertTypeReferenceNode]] and
     * [[convertTypeReferenceType]] when encountering an object or type literal.
     *
     * A type literal is explicitly set:
     * ```
     * var someValue:{a:string; b:number;};
     * ```
     *
     * An object literal types are usually reflected by the TypeScript compiler:
     * ```
     * function someFunction() { return {a:'Test', b:1024}; }
     * ```
     *
     * @param context  The context object describing the current state the converter is in.
     * @param symbol  The symbol describing the type literal.
     * @param node  If known the node which produced the type literal. Type literals that are
     *   implicitly generated by TypeScript won't have a corresponding node.
     * @returns A type reflection representing the given type literal.
     */
    convert(context:Context, symbol:ts.Symbol, node?:ts.Node):Type {
        for (let declaration of symbol.declarations) {
            if (context.visitStack.indexOf(declaration) !== -1) {
                if (declaration.kind == ts.SyntaxKind.TypeLiteral ||
                        declaration.kind == ts.SyntaxKind.ObjectLiteralExpression) {
                    return createReferenceType(context, declaration.parent.symbol);
                } else {
                    return createReferenceType(context, declaration.symbol);                    
                }
            }
        }

        var declaration = new DeclarationReflection();
        declaration.kind = ReflectionKind.TypeLiteral;
        declaration.name = '__type';
        declaration.parent = context.scope;

        context.registerReflection(declaration, null, symbol);
        context.trigger(Converter.EVENT_CREATE_DECLARATION, declaration, node);
        context.withScope(declaration, () => {
            symbol.declarations.forEach((node) => {
                convertNode(context, node);
            });
        });

        return new ReflectionType(declaration);
    }


    /**
     * Convert the type reference node to its type reflection.
     *
     * This is a node based converter, see [[convertTypeReferenceType]] for the type equivalent.
     *
     * ```
     * class SomeClass { }
     * var someValue:SomeClass;
     * ```
     *
     * @param context  The context object describing the current state the converter is in.
     * @param node  The type reference node that should be converted.
     * @param type  The type of the type reference node.
     * @returns The type reflection representing the given reference node.
     */
    convertNode(context:Context, node:ts.TypeReferenceNode, type:ts.TypeReference):Type {
        if (!type.symbol) {
            return new IntrinsicType('Object');
        } else if (type.symbol.flags & ts.SymbolFlags.TypeLiteral || type.symbol.flags & ts.SymbolFlags.ObjectLiteral) {
            return this.convert(context, type.symbol, node);
        }

        var result = createReferenceType(context, type.symbol);
        if (node.typeArguments) {
            result.typeArguments = node.typeArguments.map((n) => convertType(context, n));
        }

        return result;
    }


    /**
     * Convert the given type reference to its type reflection.
     *
     * This is a type based converter, see [[convertTypeReference]] for the node equivalent.
     *
     * ```
     * class SomeClass { }
     * var someValue:SomeClass;
     * ```
     *
     * @param context  The context object describing the current state the converter is in.
     * @param type  The type reference that should be converted.
     * @returns The type reflection representing the given type reference.
     */
    convertType(context:Context, type:ts.TypeReference):Type {
        if (!type.symbol) {
            return new IntrinsicType('Object');
        } else if (type.symbol.flags & ts.SymbolFlags.TypeLiteral || type.symbol.flags & ts.SymbolFlags.ObjectLiteral) {
            return this.convert(context, type.symbol);
        }

        var result = createReferenceType(context, type.symbol);
        if (type.typeArguments) {
            result.typeArguments = type.typeArguments.map((t) => convertType(context, null, t));
        }

        return result;
    }
}
