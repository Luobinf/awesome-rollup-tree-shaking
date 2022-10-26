import { parse } from 'acorn'
import MagicString from 'magic-string'
import analyse from './ast/analyse.js'

export default class Module {
	constructor({ code, path, bundle }) {
		this.code = new MagicString(code, {
			filename: path
		})
		this.path = path
		this.bundle = bundle
		// 存放当前模块定义变量的语句
		this.definitions = {}
		// 存放当前模块导入的变量
		this.imports = {}
		// 存放当前模块导出的变量
		this.exports = {}

		try {
			this.ast = parse(this.code, {
				ecmaVersion: 2022,
				sourceType: 'module'
			})
		} catch (error) {
			error.file = path
			throw error
		}

		this.analyse()

	}

	analyse() {

		// 先分析 AST，填充 imports、exports, indexed by variable name
		this.ast.body.forEach(node => {
			// import 也有好几种方式，随后补充
			if (node.type === 'ImportDeclaration') {
				const source = node.source.value
				node.specifiers.forEach(specifier => {
					if (specifier.type === 'ImportSpecifier') {
						const importedName = specifier.imported.name
						const localName = specifier.local.name
						this.imports[localName] = {
							localName,
							importedName,
							source
						}
					}
				})
			}

			if (node.type === 'ExportNamedDeclaration') {
				const declaration = node.declaration
				if (declaration) {
					let localName;
					if (declaration.type === 'FunctionDeclaration') {
						// export function foo () {}
						localName = declaration.id.name
					} else {
						// export const foo = 42
						localName = declaration.declarations[0].id.name
					}
					const exportedName = localName
					this.exports[localName] = {
						localName,
						exportedName,
						node,
						expression: declaration
					}
				} else {
					// export { foo, bar, baz }
					// export { age } from './msg.js'
					// export { age } from './msg.js' 相当于下面两行
					// import { age } from './msg.js'； export { age };
					let source = node.source && node.source.value

					node.specifiers.forEach(specifier => {
						const localName = specifier.local.name
						const exportedName = specifier.exported.name
						this.exports[localName] = {
							localName,
							exportedName,
						}

						if (source) {
							this.imports[localName] = {
								source,
								localName,
								importedName: exportedName,
							}
						}
					})

				}
			}

			if (node.type === 'ExportDefaultDeclaration') {

				const isDeclaration = /Declaration$/.test(node.declaration.type);

				this.exports.default = {
					node,
					exportedName: 'default',
					localName: isDeclaration ? node.declaration.id.name : 'default',
					isDeclaration
				};
			}

		});

		analyse(this.ast, this.code, this)

		// 获取当前模块所定义的 statement 语句
		this.ast.body.forEach(statement => {
			Object.keys(statement._defines).forEach(name => {
				this.definitions[name] = statement
			})
		})
	}
}