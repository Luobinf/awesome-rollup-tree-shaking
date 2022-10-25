import util from "node:util";

export async function fileIsExist(filePath) {
    const stats = await util.promisify(fs.stat)(filePath);
    return stats.isFile()
}
