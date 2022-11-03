import { parse } from "acorn";
import MagicString from "magic-string";
import analyse from "./ast/analyse.js";
import { hasOwnProperty } from "./utils/helper.js";

export default class Module {
	constructor({ code, path, bundle }) {
		this.code = new MagicString(code, {
			filename: path,
		});
		this.path = path;
		this.bundle = bundle;
		// 存放当前模块定义变量的语句
		this.definitions = {};
		// 存放当前模块导入的变量
		this.imports = {};
		// 存放当前模块导出的变量
		this.exports = {};
		// 存放当前模块被修改的变量语句，例如：{ age: [age += 90] }
		this.modifications = {};

		try {
			this.ast = parse(this.code, {
				ecmaVersion: 2022,
				sourceType: "module",
			});
		} catch (error) {
			error.file = path;
			throw error;
		}

		this.analyse();
	}

	analyse() {
		// 先分析 AST，填充 imports、exports, indexed by variable name
		this.ast.body.forEach((node) => {
			// import 也有好几种方式，随后补充
			if (node.type === "ImportDeclaration") {
				const source = node.source.value;
				node.specifiers.forEach((specifier) => {
					if (specifier.type === "ImportSpecifier") {
						const importedName = specifier.imported.name;
						const localName = specifier.local.name;
						this.imports[localName] = {
							localName,
							importedName,
							source,
						};
					}
				});
			}

			if (node.type === "ExportNamedDeclaration") {
				const declaration = node.declaration;
				if (declaration) {
					let localName;
					if (declaration.type === "FunctionDeclaration") {
						// export function foo () {}
						localName = declaration.id.name;
					} else {
						// export const foo = 42
						localName = declaration.declarations[0].id.name;
					}
					const exportedName = localName;
					this.exports[localName] = {
						localName,
						exportedName,
						node,
						expression: declaration,
					};
				} else {
					// export { foo, bar, baz }
					// export { age } from './msg.js'
					// export { age } from './msg.js' 相当于下面两行
					// import { age } from './msg.js'； export { age };
					let source = node.source && node.source.value;

					node.specifiers.forEach((specifier) => {
						const localName = specifier.local.name;
						const exportedName = specifier.exported.name;
						this.exports[localName] = {
							localName,
							exportedName,
						};

						if (source) {
							this.imports[localName] = {
								source,
								localName,
								importedName: exportedName,
							};
						}
					});
				}
			}

			if (node.type === "ExportDefaultDeclaration") {
				const isDeclaration = /Declaration$/.test(node.declaration.type);

				this.exports.default = {
					node,
					exportedName: "default",
					localName: isDeclaration ? node.declaration.id.name : "default",
					isDeclaration,
				};
			}
		});

		analyse(this.ast, this.code, this);

		// 获取当前模块所定义的 statement 语句
		this.ast.body.forEach((statement) => {
			Object.keys(statement._defines).forEach((name) => {
				this.definitions[name] = statement;
			});
		});

		// 获取当前模块所修改的 statement 语句
		this.ast.body.forEach((statement) => {
			Object.keys(statement._modifications).forEach((name) => {
				if (!this.modifications[name]) {
					this.modifications[name] = [];
				}
				this.modifications[name].push(statement);
			});
		});
	}

	// expandAllStatements，整理对应的 statement，某些 statement 需要直接删除掉（如 import 声明、变量声明,等后面有地方去使用时才使用这些语句），
	//找出 statement 所依赖的变量语句，找出来放入到 result 中去，当前自身语句也需要存到 result 中去。最后返回该 result。
	expandAllStatements(isEntryModule) {
		let allStatements = [];

		this.ast.body.forEach((statement) => {
			if (statement.type === "ImportDeclaration") {
				return;
			}
			if (statement.type === "VariableDeclaration") {
				return;
			}
			if (
				statement.type === "FunctionDeclaration" ||
				statement.type === "ArrowFunctionExpression" ||
				statement.type === "FunctionExpression"
			) {
				return;
			}
			let statements = this.expandStatement(statement);
			if (statements.length >= 2) {
				const { length } = statements;
				allStatements.push(statements[length - 1]);
				allStatements = (statements.slice(0, length - 1) || []).concat(
					allStatements
				);
			} else {
				allStatements.push(...statements)
			}
		});

		return allStatements;
	}

	expandStatement(statement) {
		if (statement._included) {
			return [];
		}

		statement._included = true;

		let result = [];
		const _dependsOn = Object.keys(statement._dependsOn);
		_dependsOn.forEach((name) => {
			let definitions = this.define(name);
			result.push(...definitions);
		});

		// 语句自身也需要放入到 result 结果中去。
		result.push(statement);


		// export const a = 90; a += 88
		const defines = Object.keys(statement._defines);
		defines.forEach((name) => {
			//找到定义的变量依赖的修改的语句
			const modifications =
				hasOwnProperty(this.modifications, name) && this.modifications[name];
			if (modifications) {
				//把修改语句也展开放到结果里
				modifications.forEach((statement) => {
					if (!statement._included) {
						let statements = this.expandStatement(statement);
						result.push(...statements);
					}
				});
			}
		});

		return result;
	}

	define(name) {
		let result = [];

		// 判断变量是否是从 import 导入的。
		if (hasOwnProperty(this.imports, name)) {
			const { source, importedName } = this.imports[name];
			const importModule = this.bundle.fetchModule(source, this.path);
			// export {
			// 	name as name1
			// }
			// export const name = 'xx'
			const { localName, exportedName } = importModule.exports[importedName];
			result = importModule.define(localName);
		} else {
			let statement = this.definitions[name];
			if (statement && !statement._included) {
				result = this.expandStatement(statement);
			}
		}

		return result;
	}
}
