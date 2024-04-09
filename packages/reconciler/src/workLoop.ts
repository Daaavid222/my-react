import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects,
	createWorkInProgress
} from './fiber'
import { beginWork } from './beginWork'
import { compeleteWork } from './compeleteWork'
import { HostRoot } from './workTags'
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags'
import {
	commitHookEffectListCreate,
	commitHookEffectListDestory,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork'
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	lanesToSchedulePriority,
	markRootFinished,
	mergeLanes
} from './fiberLanes'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { scheduleMicrotask } from 'hostConfig'
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_cancelCallback
} from 'scheduler'
import { HookHasEffect, Passive } from './hookEffectTag'
import { unstable_shouldYield } from 'scheduler'

let workInProgress: FiberNode | null = null
let wipRootRenderLane: Lane = NoLane
let rootDoesHasPassiveEffects = false

type RootExistStatus = number
const RootInComplete: RootExistStatus = 1
const RootCompleted: RootExistStatus = 2
// TODO: 执行过程报错

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane
	root.finishedWork = null
	workInProgress = createWorkInProgress(root.current, {})
	wipRootRenderLane = lane
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	const root = markUpdateFromFiberToRoot(fiber)
	markRootUpdate(root, lane)
	// 调度阶段入口
	ensureRootIsSheduled(root)
}

function ensureRootIsSheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes)
	const existingCallback = root.callbackNode
	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback)
		}
		root.callbackNode = null
		root.callbackPriority = NoLane
		return
	}
	const currentPriority = updateLane
	const prevPriority = root.callbackPriority
	if (currentPriority === prevPriority) {
		return
	}

	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback)
	}
	let newCallbackNode = null

	if (__DEV__) {
		console.log(
			`在${updateLane === SyncLane ? '微' : '宏'}任务中调度，优先级：`,
			updateLane
		)
	}

	if (updateLane === SyncLane) {
		// 同步优先级，微任务调度
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
		scheduleMicrotask(flushSyncCallbacks)
	} else {
		// 其他优先级采用宏任务调度
		const schedulePriority = lanesToSchedulePriority(updateLane)
		newCallbackNode = scheduleCallback(
			schedulePriority,
			performConcurrentWorkOnRoot.bind(null, root)
		)
	}

	root.callbackNode = newCallbackNode
	root.callbackPriority = currentPriority
}

function markRootUpdate(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber
	let parent = node.return
	while (parent !== null) {
		node = parent
		parent = node.return
	}

	if (node.tag === HostRoot) {
		return node.stateNode
	}

	return null
}

function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	const curCallback = root.callbackNode
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects)
	if (didFlushPassiveEffect) {
		if (root.callbackNode !== curCallback) {
			return null
		}
	}

	const lane = getHighestPriorityLane(root.pendingLanes)
	const currentCallbackNode = root.callbackNode

	const needSync = lane === SyncLane || didTimeout

	const exitStatus = renderRoot(root, lane, !needSync)
	ensureRootIsSheduled(root)

	if (exitStatus === RootInComplete) {
		//中断
		if (root.callbackNode !== currentCallbackNode) {
			return null
		}
		return performConcurrentWorkOnRoot.bind(null, root)
	}
	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = lane
		wipRootRenderLane = NoLane

		commitRoot(root)
	} else {
		console.warn('还未实现并发更新结束状态')
	}
}

function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getHighestPriorityLane(root.pendingLanes)
	if (nextLane !== SyncLane) {
		// 其他比SyncLane低的优先级
		// NoLane
		ensureRootIsSheduled(root)
		return
	}

	const exitStatus = renderRoot(root, nextLane, false)

	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = nextLane
		wipRootRenderLane = NoLane
		commitRoot(root)
	} else {
		console.warn('还未实现同步更新状态')
	}
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.warn(`开始${shouldTimeSlice ? '并发' : '同步'}更新`)
	}
	if (wipRootRenderLane !== lane) {
		// 初始化
		prepareFreshStack(root, lane)
	}
	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync()
			break
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e)
			}
		}
	} while (true)

	// 执行完||render阶段中断
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete
	}
	// render阶段执行完
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error(`render阶段执行完时wip不应该为null`)
	}
	return RootCompleted
	// TODO: 报错
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork

	if (finishedWork === null) {
		return
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork)
	}

	const lane = root.finishedLane
	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finishedLane不应该是NoLane')
	}

	// 重置
	root.finishedWork = null
	root.finishedLane = NoLane

	markRootFinished(root, lane)
	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subTreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true
			// 调度副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects)
				return
			})
		}
	}

	// 判断是否存在3个子阶段需要执行的操作
	const subTreeHasEffect =
		(finishedWork.subTreeFlags & MutationMask) !== NoFlags
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags
	if (subTreeHasEffect || rootHasEffect) {
		// before mutation
		// mutation
		commitMutationEffects(finishedWork, root)
		root.current = finishedWork
		// layout
	} else {
		root.current = finishedWork
	}

	rootDoesHasPassiveEffects = false
	ensureRootIsSheduled(root)
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffect = false
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffectListUnmount(Passive, effect)
	})
	pendingPassiveEffects.unmount = []

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffectListDestory(Passive | HookHasEffect, effect)
	})
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffectListCreate(Passive | HookHasEffect, effect)
	})
	pendingPassiveEffects.update = []

	flushSyncCallbacks()
	return didFlushPassiveEffect
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}

function workLoopConcurrent() {
	while (workInProgress !== null && unstable_shouldYield()) {
		performUnitOfWork(workInProgress)
	}
}

function performUnitOfWork(fiber: FiberNode) {
	console.log('beginWork', fiber)
	const next = beginWork(fiber, wipRootRenderLane)
	fiber.memorizedProps = fiber.pendingProps

	if (next !== null) {
		workInProgress = next
	} else {
		compeleteUnitOfWork(fiber)
	}
}

function compeleteUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber
	do {
		console.log('completework', node)
		compeleteWork(node)
		const sibling = node.sibling
		if (sibling !== null) {
			workInProgress = sibling
			return
		}
		node = node.return
		workInProgress = node
	} while (node !== null)
}
