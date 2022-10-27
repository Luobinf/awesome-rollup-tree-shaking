import { dirname, isAbsolute, resolve } from 'path';

export function defaultResolver(importee, importer) {
    if (isAbsolute(importee)) return importee;

    return resolve(dirname(importer), importee).replace(/\.js$/, '') + '.js'
}