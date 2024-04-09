import { ReactElementType } from 'shared/ReactTypes'
import { FiberNode } from './fiber'
import { processUpdateQueue } from './updateQueue'
import {
	HostRoot,
	HostComponent,
	HostText,
	FunctionComponent,
	Fragment
} from './workTags'
import { mountChildFiber, reconcileChildFiber } from './childFibers'
import { renderWithHooks } from './fiberHooks'
import { Lane } from './fiberLanes'
import { Ref } from './fiberFlags'

export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane)
		case HostComponent:
			return updateHostComponent(wip)
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane)
		case HostText:
			return null
		case Fragment:
			return updateFragment(wip)
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型')
			}
			break
	}

	return null
}

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	const nextChildren = renderWithHooks(wip, renderLane)
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memorizedState
	const updateQueue = wip.updateQueue
	const update = updateQueue.shared.pending
	updateQueue.shared.pending = null
	const { memorizedState } = processUpdateQueue(baseState, update, renderLane)
	wip.memorizedState = memorizedState

	const nextChildren = wip.memorizedState
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps
	const nextChildren = nextProps.children
	markRef(wip.alternate, wip)
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate
	if (current !== null) {
		// update
		wip.child = reconcileChildFiber(wip, current?.child, children)
	} else {
		// mount
		wip.child = mountChildFiber(wip, null, children)
	}
}

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	const ref = workInProgress.ref
	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref === ref)
	) {
		workInProgress.flags |= Ref
	}
}
