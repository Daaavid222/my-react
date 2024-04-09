import fs from 'fs'
import path from 'path'
import ts from 'rollup-plugin-typescript2'
import cjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'

const distPath = path.resolve(__dirname, '../../dist/node_modules')
const pkgPath = path.resolve(__dirname, '../../packages')

export function resolvePkgPath(pkgName, isDist) {
	if (isDist) {
		return `${distPath}/${pkgName}`
	} else {
		return `${pkgPath}/${pkgName}`
	}
}
export function getPackageJson(pkgName) {
	const path = `${resolvePkgPath(pkgName)}/package.json`
	const str = fs.readFileSync(path, 'utf-8')
	return JSON.parse(str)
}

export function getBaseRollupPlugins({
	alias = { __DEV__: true, preventAssignment: true },
	typescript = {}
} = {}) {
	return [replace(alias), cjs(), ts(typescript)]
}
