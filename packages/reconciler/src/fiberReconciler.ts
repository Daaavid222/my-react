import { Container } from 'hostConfig'
import { FiberNode, FiberRootNode } from './fiber'
import { createUpdate, createUpdateQueue, enqueueUpdate } from './updateQueue'
import { HostRoot } from './workTags'
import { ReactElementType } from 'shared/ReactTypes'
import { scheduleUpdateOnFiber } from './workLoop'
import { requestUpdateLanes } from './fiberLanes'
import { unstable_ImmediatePriority, unstable_runWithPriority } from 'scheduler'

export const createContainer = (container: Container) => {
	const hostRootFiber = new FiberNode(HostRoot, {}, null)
	const root = new FiberRootNode(container, hostRootFiber)
	hostRootFiber.updateQueue = createUpdateQueue()
	return root
}

export const updateContainer = (
	element: ReactElementType,
	root: FiberRootNode
) => {
	unstable_runWithPriority(unstable_ImmediatePriority, () => {
		const hostRootFiber = root.current
		const lane = requestUpdateLanes()
		const update = createUpdate<ReactElementType | null>(element, lane)
		enqueueUpdate(hostRootFiber.updateQueue, update)
		scheduleUpdateOnFiber(hostRootFiber, lane)
	})

	return element
}
