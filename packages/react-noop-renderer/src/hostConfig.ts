import { FiberNode } from 'reconciler/src/fiber'
import { HostText } from 'reconciler/src/workTags'
import { Props } from 'shared/ReactTypes'

export interface Container {
	rootId: number
	children: (Instance | TextInstance)[]
}
export interface Instance {
	id: number
	type: string
	children: (Instance | TextInstance)[]
	parent: number
	props: Props
}
export interface TextInstance {
	text: string
	id: number
	parent: number
}

let instanceCounter = 0

export const createInstance = (type: string, props: any): Instance => {
	// 处理props
	const instance = {
		id: instanceCounter++,
		type: type,
		children: [],
		parent: -1,
		props
	}
	return instance
}

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	const prevParentId = child.parent
	const parentId = 'rootId' in parent ? parent.rootId : parent.id

	if (prevParentId !== -1 && prevParentId !== parentId) {
		throw new Error('不能重复挂载Id')
	}
	child.parent = parentId
	parent.children.push(child)
}

export const createTextInstance = (content: string) => {
	const textInstance = {
		text: content,
		id: instanceCounter++,
		parent: -1
	}
	return textInstance
}

export const appendChildToContainer = (parent: Container, child: Instance) => {
	const prevParentId = child.parent

	if (prevParentId !== -1 && prevParentId !== parent.rootId) {
		throw new Error('不能重复挂载Id')
	}
	child.parent = parent.rootId
	parent.children.push(child)
}

export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memorizedProps.content
			return commitTextUpdate(fiber.stateNode, text)
		default:
			if (__DEV__) {
				console.warn('未实现的update', fiber)
			}
			break
	}
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
	textInstance.text = content
}

export function removeChild(
	child: Instance | TextInstance,
	container: Container
) {
	const index = container.children.indexOf(child)
	if (index === -1) {
		throw new Error('child不存在')
	}
	container.children.splice(index, 1)
}

export function insertChildToContainer(
	child: Instance,
	container: Container,
	before: Instance
) {
	const beforeIndex = container.children.indexOf(before)
	if (beforeIndex === -1) {
		throw new Error('before不存在')
	}
	const childIndex = container.children.indexOf(child)
	if (childIndex !== -1) {
		container.children.splice(childIndex, 1)
	}
	container.children.splice(beforeIndex, 0, child)
}

export const scheduleMicrotask =
	typeof queueMicrotask === 'function'
		? queueMicrotask
		: typeof Promise === 'function'
		? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
		: setTimeout
