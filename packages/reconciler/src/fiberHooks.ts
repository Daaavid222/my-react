import { Dispatch, Dispatcher } from 'react/src/currentDispatcher'
import currentBatchConfig from 'react/src/currentBatchConfig'
import { FiberNode } from './fiber'
import internals from 'shared/internals'
import { scheduleUpdateOnFiber } from './workLoop'
import { Action } from 'shared/ReactTypes'
import {
	createUpdateQueue,
	UpdateQueue,
	createUpdate,
	enqueueUpdate,
	processUpdateQueue,
	Update
} from './updateQueue'
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes'
import { Flags, PassiveEffect } from './fiberFlags'
import { HookHasEffect, Passive } from './hookEffectTag'
let currentlyRenderingFiber: FiberNode | null = null
let workInprogressHook: Hook | null = null
let currentHook: Hook | null = null
let renderLane: Lane = NoLane

const { currentDispatcher } = internals

interface Hook {
	memorizedState: any
	updateQueue: unknown
	next: Hook | null
	baseState: any
	baseQueue: Update<any> | null
}
export interface Effect {
	tags: Flags
	create: EffectCallback | void
	destory: EffectCallback | void
	deps: EffectDeps
	next: Effect | null
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null
}

type EffectCallback = () => void
type EffectDeps = any[] | null

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	currentlyRenderingFiber = wip
	wip.memorizedState = null
	wip.updateQueue = null
	renderLane = lane

	const current = wip.alternate

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatchrOnUpdate
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount
	}
	console.log(wip.type, wip)
	const Component = wip.type
	const props = wip.pendingProps
	const children = Component(props)
	// 重置操作
	currentlyRenderingFiber = null
	currentHook = null
	workInprogressHook = null
	renderLane = NoLane
	return children
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect,
	useTransition: mountTransition,
	useRef: mountRef
}

const HooksDispatchrOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect,
	useTransition: updateTransition,
	useRef: updateRef
}

function mountTransition(): [boolean, (callback: () => void) => void] {
	const [isPending, setPending] = mountState(false)
	const hook = mountWorkInProgressHook()
	const start = startTransition.bind(null, setPending)
	hook.memorizedState = start
	return [isPending, start]
}

function updateTransition(): [boolean, (callback: () => void) => void] {
	const [isPending] = updateState()
	const hook = updateWorkInProgressHook()
	const start = hook.memorizedState
	return [isPending as boolean, start]
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
	setPending(true)
	const prevTransition = currentBatchConfig.transition
	currentBatchConfig.transition = 1

	callback()
	setPending(false)

	currentBatchConfig.transition = prevTransition
}
function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = mountWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect
	hook.memorizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	)
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = updateWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	let destory: EffectCallback | void

	if (currentHook !== null) {
		const prevEffect = currentHook.memorizedState as Effect
		destory = prevEffect.destory
		if (nextDeps !== null) {
			// 浅比较
			const prevDeps = prevEffect.deps
			if (areHookInputEqual(nextDeps, prevDeps)) {
				hook.memorizedState = pushEffect(Passive, create, destory, nextDeps)
				return
			}
		}
		// 浅比较不相等
		;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect
		hook.memorizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destory,
			nextDeps
		)
	}
}

// for循环通过Object.is比较deps是否发生改变
function areHookInputEqual(
	nextDeps: EffectDeps,
	prevDeps: EffectDeps
): boolean {
	if (prevDeps === null || nextDeps === null) {
		return false
	}
	for (let i = 0; i < nextDeps.length && i < prevDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue
		}
		return false
	}
	return true
}

function pushEffect(
	hookFlag: Flags,
	create: EffectCallback | void,
	destory: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tags: hookFlag,
		create,
		destory,
		deps,
		next: null
	}
	const fiber = currentlyRenderingFiber as FiberNode
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>
	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue()
		fiber.updateQueue = updateQueue
		effect.next = effect
		updateQueue.lastEffect = effect
	} else {
		// 插入hook
		const lastEffect = updateQueue.lastEffect
		if (lastEffect === null) {
			effect.next = effect
			updateQueue.lastEffect = effect
		} else {
			const firstEffect = lastEffect.next
			lastEffect.next = effect
			effect.next = firstEffect
			updateQueue.lastEffect = effect
		}
	}
	return effect
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>
	updateQueue.lastEffect = null
	return updateQueue
}

function updateState<State>(): [State, Dispatch<State>] {
	const hook = updateWorkInProgressHook()
	// 计算新的state
	const queue = hook.updateQueue as UpdateQueue<State>
	// const baseState = hook.baseState

	const pending = queue.shared.pending
	const current = currentHook as Hook
	let baseQueue = current.baseQueue

	if (pending !== null) {
		if (baseQueue !== null) {
			const baseFirst = baseQueue.next
			const pendingFirst = pending.next
			baseQueue.next = pendingFirst
			pending.next = baseFirst
		}
		baseQueue = pending
		current.baseQueue = pending
		queue.shared.pending = null
	}
	if (baseQueue !== null) {
		const {
			memorizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(hook.memorizedState, baseQueue, renderLane)
		hook.memorizedState = memorizedState
		hook.baseState = newBaseState
		hook.baseQueue = newBaseQueue
	}

	return [hook.memorizedState, queue.dispatch as Dispatch<State>]
}

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	const hook = mountWorkInProgressHook()
	let memorizedState

	if (initialState instanceof Function) {
		memorizedState = initialState()
	} else {
		memorizedState = initialState
	}

	const queue = createUpdateQueue<State>()
	hook.updateQueue = queue
	hook.memorizedState = memorizedState
	hook.baseState = memorizedState
	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue)
	queue.dispatch = dispatch

	return [memorizedState, dispatch]
}

function mountRef<T>(initialValue: T): { current: T } {
	const hook = mountWorkInProgressHook()
	const ref = { current: initialValue }
	hook.memorizedState = ref
	return ref
}

function updateRef<T>(initialValue: T): { current: T } {
	const hook = updateWorkInProgressHook()
	return hook.memorizedState
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLanes()
	const update = createUpdate(action, lane)
	enqueueUpdate(updateQueue, update)
	scheduleUpdateOnFiber(fiber, lane)
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memorizedState: null,
		updateQueue: null,
		next: null,
		baseState: null,
		baseQueue: null
	}

	if (workInprogressHook === null) {
		// mount第一次
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件中调用hook')
		} else {
			workInprogressHook = hook
			currentlyRenderingFiber.memorizedState = workInprogressHook
		}
	} else {
		// mount 后续hooks
		workInprogressHook.next = hook
		workInprogressHook = hook
	}
	return workInprogressHook
}

function updateWorkInProgressHook(): Hook {
	// TODO render阶段触发的更新
	let nextCurrentHook: Hook | null
	if (currentHook === null) {
		const current = currentlyRenderingFiber?.alternate
		if (current !== null) {
			nextCurrentHook = current?.memorizedState
		} else {
			nextCurrentHook = null
		}
	} else {
		nextCurrentHook = currentHook.next
	}

	if (nextCurrentHook === null) {
		if (__DEV__) {
			console.warn(
				`组件${currentlyRenderingFiber?.type}本次执行时的hook比上次多`
			)
		}
	}

	currentHook = nextCurrentHook as Hook

	const newHook = {
		memorizedState: currentHook.memorizedState,
		updateQueue: currentHook.updateQueue,
		next: null,
		baseState: currentHook.baseState,
		baseQueue: currentHook.baseQueue
	}

	if (workInprogressHook === null) {
		// mount第一次
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件中调用hook')
		} else {
			workInprogressHook = newHook
			currentlyRenderingFiber.memorizedState = workInprogressHook
		}
	} else {
		// mount 后续hooks
		workInprogressHook.next = newHook
		workInprogressHook = newHook
	}
	return workInprogressHook
}
