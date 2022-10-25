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

