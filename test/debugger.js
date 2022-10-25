import path from "path";
import { rollup } from "../src/index.js";
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


let entry = path.resolve(__dirname, "./main.js");

const options = {
    dest: "bundle.js"
}

debugger

rollup(entry, options).then(res => {
    const result = res.generate(options)
    console.log( result )
    const code = result.code
    fs.writeFileSync('./bundle.js', code)
});
