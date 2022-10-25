import Bundle from "./Bundle.js"

export function rollup(entry, options) {
    const bundle = new Bundle({
        entry, 
        resolvePath: options.resolvePath,
    })
    return bundle.build().then(() => {
        return {
            generate() {

            }
        }
    })
}

