import Scope from './Scope.js'
import walk from './walk.js'

export default function analyse(ast, magicString, module) {

	// 根据 AST，对每一条 statement 进行分析，找出每一条语句所定义的变量与使用到的变量（_defines、_dependsOn）。
	//要找到每一条语句所定义的变量与依赖的变量，是需要进行变量查找的，故要先形成作用域。
	let scope = new Scope({
		name: '全局作用域'
	})
	let currentTopLevelStatement = null

	function addScope(declarator) {
		const name = declarator.id.name
		scope.add(name)

		if (!scope.parent) {
			currentTopLevelStatement._defines[name] = true
		}
	}

	// first generate scope info, so we can know the statement's definitions.
	ast.body.forEach(statement => {
		Object.defineProperties(statement, {
			_defines: { value: {} },
			_dependsOn: { value: {} },
			_included: { value: false, writable: true },
			_module: { value: module },
			_source: { value: magicString.snip(statement.start, statement.end) },
		})

		currentTopLevelStatement = statement

		walk(statement, {
			enter(node) {
				let newScope;
				switch (node.type) {
					case 'VariableDeclaration':
						// 逻辑
						node.declarations.forEach(declaration => {
							// scope.add(declaration.id.name)
							addScope(declaration)
						})
						break
					case 'FunctionDeclaration':
					case 'ArrowFunctionExpression':
					case 'FunctionExpression':
						let names = node.params.map( param => param.name)
						if(node.type === 'FunctionDeclaration') {
							addScope(node)
						} else if( node.type === 'FunctionExpression' && node.id ){
							names.push(node.id.name)
						}
						newScope = new Scope({
							name: node.id.name,
							names,
							parent: scope,
						})
					// 例如 if(true) { let name = 90 } 中的 块级作用域
					case 'BlockStatement':
						newScope = new Scope({
							name: '块级作用域',
							names: [],
							parent: scope
						})
						break
					default:
						break
				}
				if(newScope) {
					Object.defineProperty(node, '_scope', {
						value: newScope
					})
					scope = newScope
				}
			},
			leave(node) {
				if(node._scope) {
					scope = scope.parent
				}
				// 退出当前语句时重置
				if(node === currentTopLevelStatement) {
					currentTopLevelStatement = null
				}
			}
		})

	});


	// then，对每一条 statement 进行分析，找出每一条语句所使用到的（依赖的）变量，填充 _dependsOn 属性。
	ast.body.forEach(statement => {
		function checkForReads(node, parent) {
			if(node.type === 'Identifier') {
				// 需要忽视 bar.name 中的 name 属性
				if(parent.type === 'MemberExpression' && node !== parent.object) {
					return
				}
				// 需要忽视 bar = { name: 90 } 中的 name 属性
				if(parent.type === 'Property' && node === parent.key) {
					return
				}

				// name 变量所在的作用域，用于判断该变量是否需要添加到 _dependsOn 中去。
				const definingScope = scope.findDefiningScope(node.name)
				// statement 语句收集 _dependsOn 时，深度递归会遇到定义的变量与依赖的变量，需要排除定义的变量。
				// for example：let aliasName = 'jack' + name，需要把 aliasName 变量忽视。
				if((!definingScope || definingScope.depth === 0)&& !statement._defines[node.name]) {
					statement._dependsOn[node.name] = true
				}
			}
		}

		walk(statement, {
			enter(node, parent) {
				if(/^Import/.test( node.type )) return

				if(node._scope) scope = node._scope

				checkForReads(node, parent)

			},
			leave(node) {
				if ( node._scope ) scope = scope.parent;
			}
		})
	})

	ast._scope = scope;

}