export default class Scope {
    constructor(options) {
        // 当前作用域名字
        this.name = options.name
        // 当前作用域所定义的变量
        this.names = options.names || []
        this.parent = options.parent
        // 维护作用域嵌套层级。
        this.depth = this.parent ? this.parent.depth + 1: 0
    }

    // 将变量添加到当前作用域
    add(name) {
        this.names.push(name)
    }

    findDefiningScope(name) {
        if (this.names.includes(name)) {
            return this
        }
        if (this.parent) {
            return this.parent.findDefiningScope(name)
        }
        return null
    }

}