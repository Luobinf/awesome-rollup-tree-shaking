import { resolve } from "path";
import fs from "fs";
import { defaultResolver } from "./utils/resolvePath.js";
import { fileIsExist } from "./utils/helper.js";
import Module from "./Module.js";
import MagicString, { Bundle as MagicStringBundle } from "magic-string";

export default class Bundle {
  constructor(options) {
    this.entryPath = resolve(options.entry).replace(/\.js$/, "") + ".js";
    this.resolvePath = options.resolvePath || defaultResolver;
    this.entryModule = null;
    // 存放所有的模块，用于模块缓存
    this.modules = new Map();
    this.statements = [];
    this.dest = options.dest;
  }

  build() {
    const entryModule = this.fetchModule(this.entryPath);
    this.entryModule = entryModule;
    const statements = entryModule.expandAllStatements(true);
    this.statements = statements;
    const code = this.generate(); //生成打包后的代码
    fs.writeFileSync(this.dest, code, {
      encoding: "utf-8",
    }); //写入文件系统
    // return statements
  }

  fetchModule(importee, importer) {
    const path = importer ? this.resolvePath(importee, importer) : importee;
    if (this.modules.has(path)) {
      return this.modules[path];
    }
    const isExist = fileIsExist(path);
    if (isExist) {
      const code = fs.readFileSync(path, {
        encoding: "utf8",
      });
      const module = new Module({
        code,
        path,
        bundle: this,
      });
      this.modules[path] = module;
      return module;
    } else {
      throw new Error(`file ${path} is not exist`);
    }
  }

  generate() {
    const { statements } = this;
    const bundle = new MagicStringBundle();
    const newLines = "\n";
    statements.forEach((statement) => {
      const source = statement._source.clone();
      if (statement.type === "ExportNamedDeclaration") {
        // remove `export` from `export var foo = 42`
        source.remove(statement.start, statement.declaration.start);
      }
      bundle.addSource({
        content: source,
        separator: newLines,
      });
    });
    return bundle.toString();
  }
}
