import { resolve } from "path";
import fs from "fs";
import { defaultResolver } from './utils/resolvePath.js'
import { fileIsExist } from './utils/helper.js'
import Module from './Module.js'

export default class Bundle {
    constructor(options) {
        this.entryPath = resolve(options.entry).replace(/\.js$/, '') + '.js';
        this.resolvePath = options.resolvePath
        this.entryModule = null
        this.modulePromises = {}  // 存放所有的模块
        this.statements = []
    }

    build() {
        return this.fetchModule(this.entryPath).then((entryModule) => {
            this.entryModule = entryModule
            return entryModule.expandAllStatements(true)
        }).then(statements => {
            this.statements = statements
        })
    }

    fetchModule(importee, importer) {
        return Promise.resolve(
            importee
        ).then(async (path) => {
            const isExist = await fileIsExist(path)
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
        })
    }

    generate(options = {}) {

    }

}