import { resolve } from "path";
import fs from "fs";
import { defaultResolver } from './utils/resolvePath.js'
import { fileIsExist, hasOwnProperty } from './utils/helper.js'
import Module from './Module.js'

export default class Bundle {
    constructor(options) {
        this.entryPath = resolve(options.entry).replace(/\.js$/, '') + '.js';
        this.resolvePath = options.resolvePath || defaultResolver
        this.entryModule = null
        this.modulePromises = {}  // 存放所有的模块
        this.statements = []
    }

    build() {
        const entryModule = this.fetchModule(this.entryPath)
        this.entryModule = entryModule
        const statements = entryModule.expandAllStatements(true)
        this.statements = statements
        return statements
    }

    fetchModule(importee, importer) {
        const path = importer ? this.resolvePath(importee, importer) : importee
        const isExist = fileIsExist(path)
        if (isExist) {
            const code = fs.readFileSync(path, {
                encoding: 'utf8',
            })
            const module = new Module({
                code,
                path,
                bundle: this
            })
            this.modulePromises[path] = module
            return module
        } else {
            throw new Error(`file ${path} is not exist`)
        }
    }

    generate(options = {}) {

    }

}