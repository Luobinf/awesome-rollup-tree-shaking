import util from "node:util";
import fs from "node:fs";

export function fileIsExist(filePath) {
    return fs.existsSync(filePath)
}

export function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}




