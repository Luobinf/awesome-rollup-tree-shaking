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

// util.js
export function add(a, b) {
	return a + b
}

export const updateCachedMap = window.updateCachedMap(add)

```

当上述代码中的 add 函数被 index.js 文件引用时，对于 Webpack 来说，它的分析思路是这样的：

1. 首先创建一个纯函数，查看 add 函数是否有被其他模块引用以及使用，若没有的话则该函数可以被Tree Shaking。
2. 然后分析函数调用的地方 `window.updateCachedMap(add)` ，将 add 函数作为参数。
3. 虽然 `updateCachedMap` 函数没有被其他模块引用，但是 Webpack 并不知道该函数调用时内部有没有副作用，例如内部可能会修改全局变量等操作。
4. 因此，为了安全起见，即便没有其他模块依赖 `add` 函数，Webpack 也会将该函数打包到产物中。


因此具有副作用的模块难以被 Tree Shaking，尽管我们自己知道该函数没有副作用。我们需要一种方式去“提示” Webpack 等打包工具。


#### 1. 在 Webpack 中可以在 `package.json` 中设置 `sideEffects` 属性，如：

```JSON
{
  "name": "your-project",
  "sideEffects": false
}
```

`sideEffects` 设置为 false ，表示该项目中的所有文件都没有副作用，让我们可以安全的删除掉那些没有被使用的 exports。


如果你的 code 有副作用的话，可以将 `sideEffects` 属性设置为一个数组，并将具有副作用的文件写入，例如：


```JSON
{
  "name": "your-project",
  "sideEffects": ["./src/some-side-effectful-file.js"]
}
```


实际上，对于上述代码，不使用 `sideEffects` 属性 我们经过如下改造，Webpack 也能将 add 函数安全的 Tree Shaking。

```JS
//  util.js 改造
import { updateCachedMap } from './map.js'
export function add(a, b) {
	return a + b
}
export const cachedMap = updateCachedMap(add)
```

此时，Webpack 在分析到 `updateCachedMap` 函数时，会去 `map.js` 文件中检测到该函数是纯函数，且 `add` 函数没有被其他模块依赖，故可以安全的 Tree Shaking。



#### 2. 在函数调用前增加特定标识符 `/*#__PURE__*/` 

该标识符用于表示该函数是纯函数，用于告诉 Webpack 该函数调用并不会对上下文环境产生副作用。例如上述例子可以改成如下方式：

```JS

// index.js
import { add } from './util'

// util.js
export function add(a, b) {
	return a + b
}

export const updateCachedMap = /*#__PURE__*/window.updateCachedMap(add)

```

上述例子中带上 `/*#__PURE__*/` 标记之后， updateCachedMap 会被 Tree Shaking 删除。

### 更加友好的导出方式

由于 Tree Shaking 是作用在 export 上的，对于以下方式，即使用到了某一个变量，整个 default 对象都会被完整的保留。

```JS
export default {
  add: 'add',
  subtract: 'subtract'
}
```

我们应该使用下面这种方式，保持导出值颗粒度和原子性，对上面代码进行优化后：


```JS
const add = 'add'
const subtract = 'subtract'
export {
  add,
  subtract
}
```


## 前端工程生态与 Tree Shaking 实践

### Babel 与 Tree Shaking

使用打包工具进行构建时，都会使用 Babel 编译工具对代码进行转化，以适应低版本的浏览器。Babel 对代码进行编译默认会将 ESM 编译为 CommonJS 模块规范。然而根据前面的理论基础，我们知道要使 Tree Shaking 生效，必须使用 ESM 规范。


因此我们需要配置 Babel 对于模块化的编译降级，具体配置项在 [babel-preset-env#modules](https://babeljs.io/docs/en/babel-preset-env#modules) 中可以找到。




### Webpack 与 Tree Shaking

在 Webpack 4.0以上版本 中将 mode 设置为 production，Tree Shaking 将会自动生效。开启 production 之后，默认的 production 相关的配置对象如下

```JS
const config = {
 mode: 'production',
 optimization: {
  usedExports: true,
  minimizer: [
   new TerserPlugin({...})
  ]
 }
}
```

事实上在 Webpack 中，Tree-shaking 的实现主要分成两个步骤。分析模块 “标记” 出导出值中哪些没有被用过，然后在生成代码阶段，使用 TerserPlugin、UglifyJS 插件等将标记结果进行删除。Webpack 在分析代码时，会有三类与之相关的标记，如下图所示：


![](https://img-hxy021.didistatic.com/static/starimg/img/GUGfuhT4BN1667466712573.png)

![](https://img-hxy021.didistatic.com/static/starimg/img/yrPKE6x6jy1667466712957.png)


* 被使用过的 export 会被标记为 harmony export；
* 没有被使用过的 export 标记为 unused harmony export；
* 所有 import 标记为 harmony import。 


**标记流程主要分为三个阶段：**

1. Make 阶段，收集模块导出变量并记录到模块依赖关系图 ModuleGraph 变量中
2. Seal 阶段，遍历 ModuleGraph 标记模块导出变量有没有被使用
3. 生成产物时，若变量没有被其它模块使用则删除对应的导出语句


使用 HarmonyExportSpecifierDependency 和 HarmonyImportSpecifierDependency 分别识别和处理 import 以及 export；使用 HarmonyExportSpecifierDependency 识别 used export 和 unused export。

至此，我们大概了解了 Webpack 进行 Tree Shaking 的原理。


## 如何实现一个简单的 Tree Shaking 脚本？



### AST

[AST explorer](https://astexplorer.net/) 平台，可以实时看到 JavaScript 代码转化成为 AST 之后的结果，平台支持使用多种解析器（如@babel/parser、acron等）将代码转化成 AST，我们使用 [acorn](https://github.com/acornjs/acorn) 作为解析器，查看被解析之后的结果，[如下图所示: ](https://astexplorer.net/#/gist/88c4134c499f5fcdc7f2fa31e44fc373/9b9101c83b691ba4d582214245e4fc17477fd3ad)


[![xbEj8P.md.png](https://s1.ax1x.com/2022/11/02/xbEj8P.md.png)](https://imgse.com/i/xbEj8P)


经过 AST 转化之后变成了一种 [ESTree](https://github.com/estree/estree) 规范的数据结构。社区上多项著名项目都基于 [acorn](https://github.com/acornjs/acorn) 的能力扩展而来，例如 ESLint、Babel。


### acorn 解析


![](https://img-hxy021.didistatic.com/static/starimg/img/u4dP4AVM1W1667468234592.png)
<center>acorn工作流程图</center>
          

源代码经过词法分析，即分词得到 Token 序列，对 Token 序列进行语法分析，得到最终 AST 结果。但 acorn 稍有不同的是：acorn 将词法分析和语法分析交替进行，只需要扫描一遍代码即可得到最终 AST 结果。


acorn 在语法解析阶段主要完成 AST 的封装以及错误抛出。在这个过程中，一段源代码可以用：

Program——整个程序

Statement——语句

Expression——表达式

来描述。

当然，Program 包含了多段 Statement，Statement 又由多个 Expression 或者 Statement 组成。这三种大元素，就构成了遵循 ESTree 规范的 AST。最终的 AST 产出，也是这三种元素的数据结构拼合。


## 实现原理

1. 首先对入口模块生成 AST
2. 分析 AST，找出模块所有的定义definitions（var、const、let、function等）、imports、exports
3. 根据 AST，对每一条 statement 进行分析，找出每一条语句所定义的变量与使用到的变量（_defines、_dependsOn），并生成对应的作用域。
4. expandAllStatements，整理对应的 statement，某些 statement 需要直接删除掉（如 import 声明、变量声明），找出 statement 所依赖的变量语句，找出来放入到 result 中去，当前自身语句也需要存到 result 中去。最后返回该 result。
5. 根据 result 中的数据 generate 最终的代码。



























