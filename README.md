## 实现原理

1. 首先对入口模块生成 AST
2. 分析 AST，找出模块所有的定义definitions（var、const、let、function）、imports、exports
3. 根据 AST，对每一条 statement 进行分析，找出每一条语句所定义的变量与使用到的变量（_defines、_dependsOn），并生成对应的作用域。
4. expandAllStatements，整理对应的 statement，某些 statement 需要直接删除掉（如 import 声明、变量声明），找出 statement 所依赖的变量语句，找出来放入到 result 中去，当前自身语句也需要存到 result 中去。最后返回该 result。
5. 根据 result 中的数据 generate 最终的代码。


```JS
function say() {
  const name = 9;
  console.log('hello', name);
}
```

对上述代码进行分析，该语句依赖的变量为空，定义的变量为say。因为 name 属性可以在 say 函数的作用域中找到，故不需要依赖外部的 name 变量。

## 源码 rollup ——v0.3.1

实际上 rollup 中创建块级作用域时，存在的 var 变量提升对于打包结果来说毫无意义，即使不使用该变量，打包结果也会包含var变量的那一部分代码


需要支持块级作用域，实现变量重命名。

## 副作用

纯函数：

参考

1. https://cloud.tencent.com/developer/article/1688742


# Tree-Shaking

## 什么是 Tree Shaking


Tree Shaking 是一种 Dead Code Elimination 技术，依赖于 ES6 Module 规范，它会在实际运行过程中静态分析模块之间的导入导出，确定模块中有哪些导出值未被其他模块使用，进而删除这一部分代码，达到打包产物体积的优化。Tree Shaking 最初在 Rollup 中实现，随后在 Webpack 2中也实现了该技术。


## 理论基础

在 ES6 Module 规范之前，CommonJS、AMD、CMD 等 JavaScript 模块化方案中，导入导出行为可以是高度动态的，例如：

```JS
function judgeType(type) {
  return type
}
if(type === judgeType('fn')) {
  require('./fn')
} else {
  require('./foo')
}
```

上述代码意味着，需要在实际运行过程中才能确定导入的是哪个模块，哪些模块是不需要的，模块之间的依赖关系难以确定，因此不适合 Tree Shaking。而在 ES Module 规范中:

* import 模块名只能是字符串常量

* import 一般只能在模块的最顶层出现

* import binding 是 immutable 的

这意味着以下代码是非法的：

```JS
function judgeType(type) {
  return type
}
if(type === judgeType('fn')) {
  import fn from './fn.js'
} else {
  import foo from './foo.js'
}
```

所以在 ES Module 规范下，模块之间的依赖关系是高度确定的，与运行状态无关，编译工具只需要对 ES Module 做静态分析，分析模块之间的导入导出，确定模块中有哪些导出值未被其他模块使用，进而消除这一部分未使用的代码，这是实现 Tree Shaking 技术的前提条件。


## 实现原理

### Rollup 

#### AST

[AST explorer](https://astexplorer.net/) 平台，可以实时看到 JavaScript 代码转化成为 AST 之后的结果，平台支持使用多种解析器（如@babel/parser、acron等）将代码转化成 AST，我们使用 [acorn](https://github.com/acornjs/acorn) 作为解析器，查看被解析之后的结果，[如下图所示: ](https://astexplorer.net/#/gist/88c4134c499f5fcdc7f2fa31e44fc373/9b9101c83b691ba4d582214245e4fc17477fd3ad)


[![xbEj8P.md.png](https://s1.ax1x.com/2022/11/02/xbEj8P.md.png)](https://imgse.com/i/xbEj8P)


经过 AST 转化之后变成了一种 [ESTree](https://github.com/estree/estree) 规范的数据结构。社区上多项著名项目都基于 [acorn](https://github.com/acornjs/acorn) 的能力扩展而来，例如 ESLint、Babel。

#### acron 解析



### Webpack


## 参考

1. https://medium.com/@netxm/what-is-tree-shaking-de7c6be5cadd





# Tree Shaking

时至今日，Tree Shaking 技术对于前端工程师来说，已经不是一个陌生的词了。Tree Shaking 翻译过来即为 “摇树”，常用于描述移除 JavaScript 上下文中未引用的代码，从而达到打包产物体积的优化。Tree Shaking 最初在 Rollup 中实现，随后在 Webpack 2中也实现了该技术。


## 理论基础

### 问题一： Tree Shaking 为什么要依赖 ES Module 规范？

在 ES6 Module 规范之前，CommonJS、AMD、CMD 等 JavaScript 模块化方案中，导入导出行为可以是高度动态的，例如：

```JS
function judgeType(type) {
  return type
}
if(type === judgeType('fn')) {
  require('./fn')
} else {
  require('./foo')
}
```

上述代码意味着，需要在实际运行过程中才能确定导入的是哪个模块，哪些模块是不需要的，模块之间的依赖关系难以确定，因此不适合 Tree Shaking。而在 ES Module 规范中:

* import 模块名只能是字符串常量

* import 一般只能在模块的最顶层出现

* import binding 是 immutable 的

这意味着以下代码在 ESM 中是非法的：

```JS
function judgeType(type) {
  return type
}
if(type === judgeType('fn')) {
  import fn from './fn.js'
} else {
  import foo from './foo.js'
}
```

所以在 ES Module 规范下，模块之间的依赖关系是高度确定的，与运行状态无关，编译工具只需要对 ES Module 做静态分析，分析模块之间的导入导出，确定模块中有哪些导出值未被其他模块使用，进而消除这一部分未使用的代码，这是实现 Tree Shaking 技术的前提条件。



### 问题二： 什么是副作用模块，如何对副作用模块进行 Tree Shaking？

如果你熟悉函数式编程，你可能听说过”副作用函数“，但是”副作用模块“这又是个啥？我们来看以下这段代码：

```JS

// index.js
import { add } from './util'
console.log(add)

// util.js
export function add(a, b) {
	return a + b
}

export const updateCachedMap = window.updateCachedMap(add)

```

当上述代码中的 add 函数被 index.js 文件引用时，对于 Webpack 来说，它的分析思路是这样的：






