import {
	Container,
	Instance,
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig'
import { FiberNode } from './fiber'
import {
	HostComponent,
	HostText,
	HostRoot,
	FunctionComponent,
	Fragment
} from './workTags'
import { NoFlags, Ref, Update } from './fiberFlags'

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update
}

function markRef(fiber: FiberNode) {
	fiber.flags |= Ref
}

export const compeleteWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps
	const current = wip.alternate

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
				// 需要比较props是否发生变化，通过数组保存key和value值，更新props
				markUpdate(wip)
				if (current.ref !== wip.ref) {
					markRef(wip)
				}
			} else {
				// 1. 构建DOM
				const instance = createInstance(wip.type, newProps)
				// 2. 将DOM插入到DOM树中
				appendAllChildren(instance, wip)
				wip.stateNode = instance
				if (wip.ref !== null) {
					markRef(wip)
				}
			}
			bubbleProperties(wip)
			return null
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memorizedProps?.content
				const newText = newProps.content
				if (oldText !== newText) {
					markUpdate(wip)
				}
			} else {
				// 1. 构建DOM
				const instance = createTextInstance(newProps.content)
				wip.stateNode = instance
			}
			bubbleProperties(wip)
			return null
		case HostRoot:
		case Fragment:
		case FunctionComponent:
			bubbleProperties(wip)
			return null
		default:
			if (__DEV__) {
				console.warn('未实现的compeleteWork类型', wip)
			}
			break
	}
}

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
	let node = wip.child

	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node?.stateNode)
		} else if (node.child !== null) {
			node.child.return = node
			node = node.child
			continue
		}

		if (node === wip) {
			return
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return
			}
			node = node?.return
		}
		node.sibling.return = node.return
		node = node.sibling
	}
}

function bubbleProperties(wip: FiberNode) {
	let subTreeFlags = NoFlags
	let child = wip.child

	while (child !== null) {
		subTreeFlags |= child.subTreeFlags
		subTreeFlags |= child.flags

		child.return = wip
		child = child.sibling
	}

	wip.subTreeFlags = subTreeFlags
}
