import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes'
import { Fragment, FunctionComponent, HostComponent, WorkTag } from './workTags'
import { Flags, NoFlags } from './fiberFlags'
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes'
import { Container } from 'hostConfig'
import { Effect } from './fiberHooks'
import { CallbackNode } from 'scheduler'

export class FiberNode {
	tag: WorkTag
	key: Key
	stateNode: any
	type: any
	return: FiberNode | null
	sibling: FiberNode | null
	child: FiberNode | null
	index: number
	ref: Ref
	pendingProps: Props
	memorizedProps: Props | null
	alternate: FiberNode | null
	flags: Flags
	subTreeFlags: Flags
	updateQueue: any
	memorizedState: any
	deletions: FiberNode[] | null

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		// 实例属性
		this.tag = tag
		this.key = key || null
		// 比如<div>对应的dom对象
		this.stateNode = null
		// fiber节点本身
		this.type = null

		// 构成树状结构
		this.return = null
		this.sibling = null
		this.child = null
		// 他是第几个元素
		this.index = 0

		this.ref = null

		// 作为工作单元
		this.updateQueue = null
		this.pendingProps = pendingProps
		this.memorizedProps = null
		this.memorizedState = null
		this.alternate = null

		// 副作用
		this.flags = NoFlags
		this.subTreeFlags = NoFlags
		this.deletions = null
	}
}
export interface PendingPassiveEffects {
	unmount: Effect[]
	update: Effect[]
}

export class FiberRootNode {
	container: Container
	current: FiberNode
	finishedWork: FiberNode | null
	pendingLanes: Lanes
	finishedLane: Lane
	pendingPassiveEffects: PendingPassiveEffects
	callbackNode: CallbackNode | null
	callbackPriority: Lane

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container
		this.current = hostRootFiber
		hostRootFiber.stateNode = this
		this.finishedWork = null
		this.pendingLanes = NoLanes
		this.finishedLane = NoLane
		this.callbackNode = null
		this.callbackPriority = NoLane

		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		}
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate

	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key)
		wip.alternate = current
		wip.stateNode = current.stateNode
		current.alternate = wip
	} else {
		// update
		wip.pendingProps = pendingProps
		wip.flags = NoFlags
		wip.subTreeFlags = NoFlags
		wip.deletions = null
	}
	wip.type = current.type
	wip.updateQueue = current.updateQueue
	wip.child = current.child
	wip.memorizedProps = current.memorizedProps
	wip.memorizedState = current.memorizedState
	return wip
}

export function createFiberFromElement(element: ReactElementType): FiberNode {
	const { type, key, props } = element
	let fiberTag: WorkTag = FunctionComponent

	if (typeof type === 'string') {
		fiberTag = HostComponent
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', type)
	}
	const fiber = new FiberNode(fiberTag, props, key)
	fiber.type = type
	return fiber
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key)
	return fiber
}
